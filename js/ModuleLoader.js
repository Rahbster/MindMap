export class ModuleLoader {
    constructor(stateManager, availableModules, callbacks) {
        this.stateManager = stateManager;
        this.state = stateManager.getState();
        this.availableModules = availableModules;
        this.callbacks = callbacks;
    }

    /**
     * Fetches or retrieves module data without triggering side effects.
     * This is the "silent" data-loading function for use by other managers.
     * @param {string | object} moduleSource - The path to the module file or the module object itself.
     * @returns {Promise<object|null>} The parsed module data.
     */
    async getModuleData(moduleSource) {
        try {
            if (typeof moduleSource === 'string') {
                const moduleId = moduleSource.split('/').pop().replace('.json', '');
                const savedModule = this.stateManager.getModuleFromStorage(moduleId);
                return savedModule ? savedModule : await (await fetch(moduleSource)).json();
            }
            return moduleSource; // It's already an object
        } catch (error) {
            console.error(`Failed to get module data for:`, moduleSource, error);
            return null;
        }
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

    loadModuleAndResetStack(modulePath, onComplete) {
        this.state.moduleStack.length = 0;
        this.loadModule(modulePath, onComplete, { isNewStack: true });
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

    saveModuleToFile() {
        if (!this.state.mindMapData) return;
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
        this.callbacks.onMenuClose();
    }

    loadModuleFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const newModule = JSON.parse(event.target.result);
                    this.state.moduleStack.length = 0; // Reset stack for file load
                    this.loadModule(newModule);
                } catch (error) {
                    alert('Error: Could not parse the JSON file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
        this.callbacks.onMenuClose();
    }
}