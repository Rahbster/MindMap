export class ModuleLoader {
    constructor(stateManager, availableModules, storageManager, callbacks) {
        this.stateManager = stateManager;
        this.state = stateManager.getState();
        this.availableModules = availableModules;
        this.storageManager = storageManager;
        this.callbacks = callbacks;
    }

    /**
     * Fetches or retrieves module data without triggering side effects.
     * This is the "silent" data-loading function for use by other managers.
     * @param {string | object} moduleSource - The path to the module file or the module object itself.
     * @returns {Promise<object|null>} The parsed module data.
     */
    async getModuleData(moduleSource) {
        try { // Handle FileSystemFileHandle
            if (typeof moduleSource === 'string') { // It's a path
                const moduleInfo = this.availableModules.find(m => m.path === moduleSource);
                const moduleId = moduleInfo?.id || moduleSource.split('/').pop().replace('.json', '');

                // Always check localStorage first, as this is where eager-loaded content will be.
                const cachedData = this.stateManager.getModuleFromStorage(moduleId, this.availableModules);
                if (cachedData) return cachedData;

                // If not in cache, determine how to fetch it.
                if (moduleInfo?.isLocal) {
                    const dirHandle = await this.storageManager.get('linkedDirectoryHandle');
                    if (!dirHandle) throw new Error('Cannot load local module: Directory access was not granted or has been lost.');
                    const fileHandle = await this._getLocalFileHandle(dirHandle, moduleInfo.path);
                    const file = await fileHandle.getFile();
                    return JSON.parse(await file.text());
                } else {
                    // Default to fetching from URL (for base modules or remote linked ones).
                    return await (await fetch(moduleSource)).json();
                }
            }
            return moduleSource; // It's already an object
        } catch (error) {
            console.error(`Failed to get module data for:`, moduleSource, error);
            return null;
        }
    }

    /**
     * A private helper to traverse a directory handle and get a file handle from a relative path.
     * @param {FileSystemDirectoryHandle} rootHandle The starting directory handle.
     * @param {string} relativePath The relative path to the file (e.g., 'modules/ai.json').
     * @returns {Promise<FileSystemFileHandle>} The handle to the requested file.
     * @private
     */
    async _getLocalFileHandle(rootHandle, relativePath) {
        const pathSegments = relativePath.split('/');
        let currentHandle = rootHandle;
        for (let i = 0; i < pathSegments.length - 1; i++) {
            const segment = pathSegments[i].trim();
            if (segment && segment !== '.') {
                // Check if the subdirectory actually exists before trying to access it.
                const subDirExists = await currentHandle.getDirectoryHandle(segment, { create: false }).then(() => true).catch(() => false);
                if (subDirExists) {
                    currentHandle = await currentHandle.getDirectoryHandle(segment);
                }
            }
        }
        const fileName = pathSegments[pathSegments.length - 1];
        return await currentHandle.getFileHandle(fileName);
    }

    /**
     * Clears all previously eager-loaded module content from localStorage.
     */
    _clearEagerLoadedModules() {
        console.log('[ModuleLoader] Clearing previously eager-loaded module content.');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('mindmap-module-')) {
                // Don't clear the manifest of user modules itself.
                if (key !== 'mindmap-user-modules') {
                    localStorage.removeItem(key);
                    i--; // Adjust index as length changes
                }
            }
        }
    }

    /**
     * Crawls a module and all its sub-modules, fetching their content and storing it in localStorage.
     * @param {string} startModulePath - The path of the top-level module to start crawling from.
     */
    async crawlAndCacheModuleHierarchy(startModulePath) {
        this._clearEagerLoadedModules();
        console.log(`[ModuleLoader] Starting eager load crawl from: ${startModulePath}`);

        const queue = [startModulePath];
        const visited = new Set();

        while (queue.length > 0) {
            const currentPath = queue.shift();
            if (visited.has(currentPath)) continue;
            visited.add(currentPath);

            const moduleData = await this.getModuleData(currentPath);
            if (moduleData) {
                localStorage.setItem(`mindmap-module-${moduleData.id}`, JSON.stringify(moduleData));
                console.log(`[ModuleLoader] Cached content for: ${moduleData.name} (${moduleData.id})`);
                Object.values(moduleData.nodes).forEach(node => {
                    if (node.subModule) queue.push(node.subModule);
                });
            }
        }
        console.log('[ModuleLoader] Eager load crawl complete.');
    }

    async loadModule(moduleSource, onComplete, { isNavigatingBack = false, isNewStack = false } = {}) {
        try {
            const newModuleData = await this.getModuleData(moduleSource);
            if (!newModuleData) throw new Error("Module data could not be retrieved.");

            // Only update the history stack on forward navigation.
            // On backward navigation, the stack has already been managed by navigateToStackIndex.
            // Also, do not push to the stack if we are starting a fresh one (e.g., from the side menu).
            if (!isNavigatingBack && !isNewStack && this.state.mindMapData && this.state.mindMapData.path) {
                this.stateManager.saveModuleToStorage();
                this.state.moduleStack.push({ name: this.state.mindMapData.name, path: this.state.mindMapData.path });
            }
            
            this.state.mindMapData = newModuleData;

            // Ensure pan, zoom, and positions are initialized if they don't exist on the loaded data.
            this.state.mindMapData.pan = this.state.mindMapData.pan || { x: 0, y: 0 };
            this.state.mindMapData.zoom = this.state.mindMapData.zoom || 1;
            this.state.mindMapData.positions = this.state.mindMapData.positions || {};

            this.state.mindMapData.path = typeof moduleSource === 'string' ? moduleSource : null;
            this.callbacks.onModuleLoaded();
            if (onComplete) onComplete(); // Execute the callback after loading is done.
        } catch (error) {
            console.error('Failed to load module:', error);
        }
    }

    async loadModuleAndResetStack(modulePath, onComplete) {
        this.state.moduleStack.length = 0; // Clear the history
        // Eagerly load the entire hierarchy for this module into localStorage.
        await this.crawlAndCacheModuleHierarchy(modulePath);
        this.loadModule(modulePath, onComplete, { isNewStack: true }); // Load the new module
        this.callbacks.onMenuClose();
    }

    navigateToStackIndex(index, modulePath) {
        // Save the state of the current module before navigating away.
        this.stateManager.saveModuleToStorage();

        // Truncate the stack to the level of the clicked breadcrumb.
        // The `index` corresponds to the position in the stack we want to return to.
        this.state.moduleStack = this.state.moduleStack.slice(0, index);

        // Reload the target module. The stack is now in the correct state.
        this.loadModule(modulePath, null, { isNavigatingBack: true }); // Pass true for isNavigatingBack
    }

    async saveModuleToFile() {
        if (!this.state.mindMapData) return;

        const currentModulePath = this.state.mindMapData.path;
        const moduleInfo = this.availableModules.find(m => m.path === currentModulePath);

        // Check if the module is a local one from a linked directory.
        if (moduleInfo && moduleInfo.isLocal) {
            const fileName = moduleInfo.path; // For local modules, path is the filename.
            if (!confirm(`This will overwrite the local file "${fileName}". Are you sure you want to save your changes?`)) {
                return;
            }

            try {
                const dirHandle = await this.storageManager.get('linkedDirectoryHandle');
                if (!dirHandle) {
                    throw new Error('Directory handle not found. Please re-link the local module folder.');
                }
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(this.state.mindMapData, null, 2));
                await writable.close();
                this.callbacks.onSaveSuccess(`Successfully saved changes to ${fileName}.`);
            } catch (error) {
                console.error('Error saving to local file:', error);
                alert(`Could not save file. Error: ${error.message}`);
            }
        } else {
            // Fallback to the standard download behavior for non-local modules.
            const dataStr = JSON.stringify(this.state.mindMapData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.state.mindMapData.id || 'custom-module'}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        this.callbacks.onMenuClose(); // Close the menu after the operation.
    }

    async linkModulesFromUrl(baseUrl) {
        // Ensure the base URL ends with a slash for proper path joining.
        if (!baseUrl.endsWith('/')) {
            baseUrl += '/';
        }
        const manifestUrl = baseUrl + 'modules.json';
        let dirHandle = null;

        try {
            // 1. Prompt user to select a local directory to save the modules.
            dirHandle = await window.showDirectoryPicker();
            await this.storageManager.set('linkedDirectoryHandle', dirHandle);

            // 2. Fetch the remote modules.json manifest.
            const manifestResponse = await fetch(manifestUrl);
            if (!manifestResponse.ok) {
                throw new Error(`Could not fetch manifest from ${manifestUrl}. Status: ${manifestResponse.status}`);
            }
            const remoteManifest = await manifestResponse.json();

            if (!Array.isArray(remoteManifest)) throw new Error('Remote manifest is not a valid array.');

            // 3. Save the modules.json manifest itself to the local directory.
            const localManifestFileHandle = await dirHandle.getFileHandle('modules.json', { create: true });
            const localManifestWritable = await localManifestFileHandle.createWritable();
            await localManifestWritable.write(JSON.stringify(remoteManifest, null, 2));
            await localManifestWritable.close();

            // 4. Eagerly fetch and save all individual module files.
            const newModules = [];
            for (const moduleInfo of remoteManifest) {
                const fullUrl = new URL(moduleInfo.path, manifestUrl).href;
                const moduleResponse = await fetch(fullUrl);
                if (!moduleResponse.ok) {
                    console.warn(`Failed to fetch module: ${fullUrl}. Skipping.`);
                    continue;
                }
                const moduleData = await moduleResponse.json();

                // Determine local path for saving.
                // If moduleInfo.path is "modules/ai.json", we need to create a "modules" subfolder.
                const pathSegments = moduleInfo.path.split('/');
                let currentHandle = dirHandle;
                for (let i = 0; i < pathSegments.length - 1; i++) {
                    currentHandle = await currentHandle.getDirectoryHandle(pathSegments[i], { create: true });
                }
                const fileName = pathSegments[pathSegments.length - 1];
                const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(JSON.stringify(moduleData, null, 2));
                await writable.close();

                // Store the full content in localStorage for immediate access.
                localStorage.setItem(`mindmap-module-${moduleData.id}`, JSON.stringify(moduleData));

                // Add to the list of new modules, flagged as local.
                newModules.push({
                    ...moduleInfo,
                    id: moduleData.id, // Ensure ID is from the file content
                    path: moduleInfo.path, // Path is now relative to the linked local directory
                    isLocal: true // Flag these as local modules.
                });
            }

            // Use the onModulesLinked callback to replace the existing user-linked modules.
            this.callbacks.onModulesLinked(newModules);

        } catch (error) {
            // Handle cases where the user cancels the picker or an error occurs
            if (error.name !== 'AbortError') {
                console.error('Error linking remote repository:', error);
                alert(`Failed to link remote repository.\n\nError: ${error.message}`);
            }
        } finally {
            this.callbacks.onMenuClose();
        }
    }

    /**
     * Discovers and adds modules from a user-selected local directory.
     */
    async linkModulesFromDirectory() {
        let dirHandle = null;
        try {
            // Use the File System Access API to get a directory handle
            dirHandle = await window.showDirectoryPicker();
            await this.storageManager.set('linkedDirectoryHandle', dirHandle);

            const manifestFileHandle = await dirHandle.getFileHandle('modules.json');
            const manifestFile = await manifestFileHandle.getFile();
            const manifestText = await manifestFile.text();
            const localManifest = JSON.parse(manifestText);

            if (!Array.isArray(localManifest)) throw new Error('Local manifest is not a valid array.');

            // Eagerly read all module content from the selected directory and cache it.
            const newModules = [];
            for (const moduleInfo of localManifest) {
                const fileHandle = await this._getLocalFileHandle(dirHandle, moduleInfo.path);
                const file = await fileHandle.getFile();
                const fileText = await file.text();
                const moduleData = JSON.parse(fileText);

                // Store the full content in localStorage.
                localStorage.setItem(`mindmap-module-${moduleData.id}`, JSON.stringify(moduleData));

                // Return metadata for the manifest. The path is just the filename.
                newModules.push({
                    ...moduleInfo,
                    id: moduleData.id,
                    isLocal: true // Flag these as user-provided local modules.
                });
            }

            // Instead of calling the callback in a loop, we call it once with the entire array.
            this.callbacks.onModulesLinked(newModules);

        } catch (error) {
            // Handle cases where the user cancels the picker or an error occurs
            if (error.name !== 'AbortError') {
                console.error('Error linking local module directory:', error);
                alert(`Failed to link local directory.\n\nError: ${error.message}`);
            }
        } finally {
            this.callbacks.onMenuClose();
        }
    }

    /**
     * Creates a new top-level module file and loads it.
     * @param {string} moduleName - The user-facing name of the module.
     * @param {string} fileName - The filename for the new module (e.g., 'my-project.json').
     */
    async createNewModule(moduleName, fileName) {
        if (!moduleName || !fileName) {
            alert('Module Name and Filename are required.');
            return;
        }

        // Ensure the filename ends with .json
        if (!fileName.endsWith('.json')) {
            fileName += '.json';
        }

        const moduleId = fileName.replace('.json', '');

        const newModuleTemplate = {
            id: moduleId,
            name: moduleName,
            isTopLevel: true,
            nodes: {
                root: {
                    id: "root",
                    title: moduleName,
                    content: `<h2>Welcome to ${moduleName}</h2><p>This is the root node of your new module. Select this node and click the 'Add' (+) icon to start building your mind map!</p>`,
                    children: []
                }
            },
            positions: {}
        };

        try {
            // Use the File System Access API to get a directory handle
            const dirHandle = await window.showDirectoryPicker();
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(newModuleTemplate, null, 2));
            await writable.close();

            // Notify the main app that a new module is available to be added to the list
            this.callbacks.onModuleCreated({
                name: moduleName,
                path: fileName, // The path is just the filename for locally created files.
                isLocal: true   // Add a flag to distinguish it from packaged modules.
            });

            alert(`Successfully created '${fileName}'! It will now be loaded.`);
            this.loadModuleAndResetStack(newModuleTemplate);

        } catch (error) {
            // Handle cases where the user cancels the picker or an error occurs
            if (error.name !== 'AbortError') {
                console.error('Error creating new module file:', error);
                alert('Could not create the module file. See the console for more details.');
            }
        }
    }
}