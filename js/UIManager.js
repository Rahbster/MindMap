/**
 * Unregisters service workers, clears caches, and optionally clears all local storage.
 * @param {boolean} clearAllStorage - If true, localStorage and sessionStorage will be cleared.
 */
async function resetApplication(clearAllStorage) {
    try {
        if ('serviceWorker' in navigator) {
            console.log('Unregistering service workers...');
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
            }
            console.log('Service workers unregistered.');
        }
        if ('caches' in window) {
            console.log('Clearing caches...');
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
            console.log('Caches cleared.');
        }
        if (clearAllStorage) {
            console.log('Clearing local and session storage...');
            localStorage.clear();
            sessionStorage.clear();
            console.log('Storage cleared.');
        }
        console.log('Reset complete. Reloading page.');
        window.location.reload();
    } catch (error) {
        console.error('Error during application reset:', error);
        alert('An error occurred during the reset process. Please check the console for details.');
    }
}

export class UIManager {
    constructor(appState, callbacks) {
        this.state = appState;
        this.callbacks = callbacks;

        this.moduleTitleEl = document.getElementById('module-title');
        this.contentDisplayEl = document.getElementById('content-display');
        this.quizContainer = document.getElementById('quiz-container');
        this.breadcrumbNav = document.getElementById('breadcrumb-nav');
        this.sidenav = document.getElementById('sidenav');
        this.mainContent = document.getElementById('main-content');
        this.moduleLoaderEl = document.getElementById('module-loader');
        this.nodeSearchInput = document.getElementById('node-search-input');
        this.searchResultsContainer = document.getElementById('search-results-container');
        this.saveModuleBtn = document.getElementById('save-module-btn');
        this.autoOrganizeBtn = document.getElementById('auto-organize-btn');

        // ReadMe Modal Elements
        this.readmeModal = document.getElementById('readme-modal');
        this.readmeDisplay = document.getElementById('readme-display');
        this.readmeSearchInput = document.getElementById('readme-search-input');
        this.readmeSearchCount = document.getElementById('readme-search-count');
        this.originalReadmeHTML = '';

        // Reset Modal Elements
        this.resetModal = document.getElementById('reset-modal');

        this.mainContainer = document.querySelector('.container');


        this.FONT_SIZE_KEY = 'mindmap-font-size';
        this.MAP_FONT_SIZE_KEY = 'mindmap-map-font-size';
        this.THEME_KEY = 'mindmap-theme';
        this.VIEW_MODE_KEY = 'mindmap-view-mode';

        // Define bounds for font size
        this.MIN_FONT_SIZE = 16;
        this.MAX_FONT_SIZE = 32;

        this.initListeners();
        this.applySavedFontSize();
        this.applySavedTheme();
        this.applySavedViewMode();
        this._injectBreadcrumbStyles();
    }

    initListeners() {
        document.getElementById('open-menu-btn').addEventListener('click', () => this.openMenu());
        document.getElementById('close-menu-btn').addEventListener('click', () => this.closeMenu());
        document.addEventListener('click', (e) => {
            if (this.sidenav.style.width === '250px' && !this.sidenav.contains(e.target) && !e.target.closest('#open-menu-btn')) {
                this.closeMenu();
            }
        });
        // Event delegation for dynamically added font buttons
        this.initFontControlListeners();
        this.nodeSearchInput.addEventListener('input', (e) => this.callbacks.onSearch(e.target.value));
        this.searchResultsContainer.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.search-result-item');
            if (resultItem) {
                this.callbacks.onSearchResultClick(resultItem.dataset.nodeId, resultItem.dataset.modulePath);
            }
        });
        this.saveModuleBtn.addEventListener('click', () => this.callbacks.onSaveModule());
        document.getElementById('load-module-btn').addEventListener('click', () => this.callbacks.onLoadModuleFromFile());
        
        // Change Auto-Organize to press-and-hold
        this.autoOrganizeBtn.addEventListener('mousedown', () => {
            this.startOrganizeIndicator();
            this.callbacks.onAutoOrganize();
        });
        this.autoOrganizeBtn.addEventListener('mouseup', (event) => {
            // Only trigger stop if it was actually running.
            if (this.autoOrganizeBtn.classList.contains('organizing')) {
                this.callbacks.onStopAutoOrganize(event);
            }
        });
        this.autoOrganizeBtn.addEventListener('mouseleave', (event) => {
            // Only trigger stop if it was actually running.
            if (this.autoOrganizeBtn.classList.contains('organizing')) {
                this.callbacks.onStopAutoOrganize(event);
            }
        });

        // Add touch equivalents for iPad/touch devices
        this.autoOrganizeBtn.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent mouse event emulation and scrolling
            this.startOrganizeIndicator();
            this.callbacks.onAutoOrganize();
        });
        this.autoOrganizeBtn.addEventListener('touchend', (event) => {
            // Only trigger stop if it was actually running.
            if (this.autoOrganizeBtn.classList.contains('organizing')) {
                this.callbacks.onStopAutoOrganize(event);
            }
        });

        document.getElementById('show-readme-btn').addEventListener('click', () => this.openReadmeModal());
        document.getElementById('close-readme-btn').addEventListener('click', () => this.closeReadmeModal());
        this.readmeSearchInput.addEventListener('input', () => this.performReadmeSearch());
        
        // Theme switcher
        document.getElementById('theme-switch').addEventListener('change', (e) => {
            this.setTheme(e.target.checked ? 'dark' : 'light');
        });

        // Reset Modal Listeners
        document.getElementById('open-reset-modal-btn').addEventListener('click', () => {
            this.resetModal.classList.remove('hidden');
            this.resetModal.style.display = 'flex'; // Use flex for centering
        });
        document.getElementById('reset-cancel-btn').addEventListener('click', () => {
            this.resetModal.classList.add('hidden');
        });
        document.getElementById('reset-preserve-btn').addEventListener('click', () => {
            // Save the current module path to restore it after reload
            const currentModule = this.state.moduleStack[this.state.moduleStack.length - 1];
            if (currentModule) {
                sessionStorage.setItem('mindmap-last-module', currentModule.path);
            }
            // false = don't clear all storage (localStorage, etc.)
            resetApplication(false);
        });
        document.getElementById('reset-full-btn').addEventListener('click', () => {
            resetApplication(true); // true = clear all storage
        });
        this.resetModal.addEventListener('click', (event) => {
            if (event.target === this.resetModal) {
                this.resetModal.classList.add('hidden');
            }
        });
    }

    initFontControlListeners() {
        // Use event delegation on the body for all font controls to avoid conflicts.
        document.body.addEventListener('click', (event) => {
            const button = event.target.closest('button');
            if (!button) return;

            switch (button.id) {
                case 'decrease-font-btn':
                    this.changeFontSize(-1);
                    break;
                case 'increase-font-btn':
                    this.changeFontSize(1);
                    break;
                case 'decrease-map-font-btn':
                    this.changeMapFontSize(-1);
                    break;
                case 'increase-map-font-btn':
                    this.changeMapFontSize(1);
                    break;
            }
        });
    }

    initViewModeControls() {
        const wrapper = document.querySelector('.title-actions-wrapper');
        if (!wrapper || document.getElementById('view-mode-controls')) return;

        const viewModeControls = document.createElement('div');
        viewModeControls.id = 'view-mode-controls';
        viewModeControls.className = 'view-mode-controls';

        viewModeControls.innerHTML = `
            <button id="view-content-btn" class="icon-button" title="Show Content Only">C</button>
            <button id="view-quiz-btn" class="icon-button" title="Show Quiz Only">Q</button>
            <button id="view-both-btn" class="icon-button" title="Show Both">C+Q</button>
        `;

        // Prepend to the wrapper so it appears before font controls
        wrapper.prepend(viewModeControls);

        document.getElementById('view-content-btn').addEventListener('click', () => this.setViewMode('content-only'));
        document.getElementById('view-quiz-btn').addEventListener('click', () => this.setViewMode('quiz-only'));
        document.getElementById('view-both-btn').addEventListener('click', () => this.setViewMode('both'));

        this.applySavedViewMode(); // Apply saved mode after creating buttons
    }

    openMenu() {
        this.sidenav.style.width = '250px';
        this.mainContent.classList.add('main-content-shifted');
    }

    closeMenu() {
        this.sidenav.style.width = '0';
        this.mainContent.classList.remove('main-content-shifted');
    }

    startOrganizeIndicator() {
        this.autoOrganizeBtn.classList.add('organizing');
    }

    stopOrganizeIndicator() {
        this.autoOrganizeBtn.classList.remove('organizing');
    }

    updateOnModuleLoad() {
        this.moduleTitleEl.textContent = this.state.mindMapData.name;
        this.updateActiveModuleInLoader();
        this.renderBreadcrumbs();
        this.saveModuleBtn.classList.remove('hidden');
    }

    async populateModuleLoader(availableModules) {
        this.moduleLoaderEl.innerHTML = '';

        // 1. Fetch the content of all available modules to check the 'isTopLevel' flag.
        const moduleContents = await Promise.all(
            availableModules.map(m => fetch(m.path).then(res => res.json()).catch(() => null))
        );

        // 2. Filter modules where isTopLevel is explicitly true.
        const topLevelModules = availableModules.filter((module, index) => {
            const content = moduleContents[index];
            return content && content.isTopLevel === true;
        });

        // 3. Sort the list alphabetically by name.
        topLevelModules.sort((a, b) => a.name.localeCompare(b.name));

        // 4. Render the filtered and sorted list.
        topLevelModules.forEach(module => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = module.name;
            link.dataset.path = module.path; // Add data attribute for easy selection
            link.onclick = (e) => {
                e.preventDefault();
                this.callbacks.onModuleSelect(module.path);
            };
            this.moduleLoaderEl.appendChild(link);
        });
        this.updateActiveModuleInLoader();
    }

    renderSearchResults(results) {
        if (results.length === 0) {
            this.searchResultsContainer.innerHTML = '';
            return;
        }

        // Group results by module
        const groupedResults = results.reduce((acc, result) => {
            if (!acc[result.moduleName]) {
                acc[result.moduleName] = [];
            }
            acc[result.moduleName].push(result);
            return acc;
        }, {});

        let html = '';
        for (const moduleName in groupedResults) {
            html += `<h4 class="search-group-header">In ${moduleName}</h4>`;
            html += groupedResults[moduleName].map(result => `
                <div class="search-result-item" data-node-id="${result.nodeId}" data-module-path="${result.modulePath}">
                    <h5>${result.title}</h5>
                    <p>${result.snippet.replace(new RegExp(this.nodeSearchInput.value, 'gi'), '<strong>$&</strong>')}</p>
                </div>
            `).join('');
        }
        this.searchResultsContainer.innerHTML = html;
    }

    updateActiveModuleInLoader() {
        const currentModule = this.state.moduleStack[this.state.moduleStack.length - 1];
        if (!currentModule) return;

        const links = this.moduleLoaderEl.querySelectorAll('a');
        links.forEach(link => {
            if (link.dataset.path === currentModule.path) {
                link.classList.add('active-module');
            } else {
                link.classList.remove('active-module');
            }
        });
    }

    renderBreadcrumbs(breadcrumbs) {
        this.breadcrumbNav.innerHTML = '';
        if (!breadcrumbs || breadcrumbs.length === 0) return;

        const ol = document.createElement('ol');

        breadcrumbs.forEach((crumb, index) => {
            const li = document.createElement('li');

            if (index === breadcrumbs.length - 1) {
                li.textContent = crumb.title;
                li.setAttribute('aria-current', 'page');
            } else {
                const a = document.createElement('a');
                a.href = '#';
                a.textContent = crumb.title;
                a.dataset.nodeId = crumb.nodeId;
                a.dataset.modulePath = crumb.modulePath;

                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.callbacks.onSearchResultClick(crumb.nodeId, crumb.modulePath);
                });

                li.appendChild(a);
            }
            ol.appendChild(li);
        });

        this.breadcrumbNav.appendChild(ol);
    }

    /**
     * Injects the necessary CSS for the breadcrumb navigation.
     * This makes the component self-contained.
     * @private
     */
    _injectBreadcrumbStyles() {
        const styleId = 'breadcrumb-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #breadcrumb-nav ol {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                align-items: center;
                flex-wrap: wrap;
            }
            #breadcrumb-nav li + li::before {
                content: '>';
                margin: 0 0.6em;
                color: var(--text-color-secondary);
                opacity: 0.7;
            }
            #breadcrumb-nav a {
                color: var(--link-color);
            }
        `;
        document.head.appendChild(style);
    }

    displayNodeContent(nodeId) {
        const node = this.state.mindMapData.nodes[nodeId];
        const titleWrapper = this.contentDisplayEl.parentElement.querySelector('.content-title-wrapper');
        
        // Clear previous dynamic content
        titleWrapper.querySelector('h2')?.remove(); // Keep this
        const actionsWrapper = titleWrapper.querySelector('.title-actions-wrapper');
        // Always clear old action buttons regardless of the node.
        if (actionsWrapper) actionsWrapper.querySelector('.content-actions')?.remove();

        // Create and add the title
        const title = document.createElement('h2');
        title.textContent = node.title;
        titleWrapper.insertBefore(title, titleWrapper.firstChild);

        // Create the container for the action buttons.
        const actions = document.createElement('div');
        actions.className = 'content-actions';

        // Add and Edit are always available.
        actions.append(this.callbacks.getActionButton('add'), this.callbacks.getActionButton('edit'), this.callbacks.getActionButton('quiz'));

        // Only add the Remove button if it's not the root of a top-level module.
        if (!(node.id === 'root' && this.state.mindMapData.isTopLevel)) actions.appendChild(this.callbacks.getActionButton('remove'));

        // Append the newly created buttons to the wrapper.
        if (actionsWrapper) actionsWrapper.appendChild(actions);

        if (node.quiz && node.quiz.length > 0) {
            this.quizContainer.classList.remove('hidden');
            this.callbacks.onStartQuiz(nodeId);
        } else {
            this.quizContainer.classList.add('hidden');
        }

        // Display the main content
        this.contentDisplayEl.innerHTML = node.content;

        // Ensure view mode controls are present
        this.initViewModeControls();
    }

    changeFontSize(amount) {
        const rootStyle = getComputedStyle(document.documentElement);
        const currentSize = parseFloat(rootStyle.getPropertyValue('--dynamic-font-size'));
        let newSize = currentSize + amount;

        // Enforce the min and max font size
        newSize = Math.max(this.MIN_FONT_SIZE, Math.min(newSize, this.MAX_FONT_SIZE));

        document.documentElement.style.setProperty('--dynamic-font-size', `${newSize}px`);
        localStorage.setItem(this.FONT_SIZE_KEY, newSize);
        this.callbacks.onFontSizeChange();
    }

    changeMapFontSize(amount) {
        const rootStyle = getComputedStyle(document.documentElement);
        const currentSize = parseFloat(rootStyle.getPropertyValue('--mindmap-font-size')) || 24;
        let newSize = currentSize + amount;

        // Enforce the min and max font size
        newSize = Math.max(this.MIN_FONT_SIZE, Math.min(newSize, this.MAX_FONT_SIZE));

        document.documentElement.style.setProperty('--mindmap-font-size', `${newSize}px`);
        localStorage.setItem(this.MAP_FONT_SIZE_KEY, newSize);
    }

    async openReadmeModal() {
        this.readmeModal.classList.remove('hidden');
        this.closeMenu();

        // Only fetch and parse the content once.
        if (this.originalReadmeHTML === '') {
            this.readmeDisplay.innerHTML = '<p>Loading...</p>';
            try {
                const response = await fetch('README.md');
                if (!response.ok) throw new Error('README.md file not found.');

                const markdown = await response.text();
                this.originalReadmeHTML = this.parseMarkdown(markdown);
                this.readmeDisplay.innerHTML = this.originalReadmeHTML;
            } catch (error) {
                this.readmeDisplay.innerHTML = '<p>Error: Could not load README.md file.</p>';
                console.error('Error fetching README:', error);
            }
        }
    }

    closeReadmeModal() {
        this.readmeModal.classList.add('hidden');
        this.readmeSearchInput.value = '';
        this.performReadmeSearch(); // Clear highlights
    }

    parseMarkdown(markdown) {
        const lines = markdown.split('\n');
        let html = '';
        let listStack = [];

        const closeOpenLists = (currentLineIndent, currentLineType = null) => {
            while (listStack.length > 0) {
                const topOfStack = listStack[listStack.length - 1];
                if (topOfStack.indent > currentLineIndent || (topOfStack.indent === currentLineIndent && currentLineType && topOfStack.type !== currentLineType) || !currentLineType) {
                    html += `</${topOfStack.type}>`;
                    listStack.pop();
                } else {
                    break;
                }
            }
        };

        for (const line of lines) {
            let processedLine = line;
            const currentLineIndent = line.match(/^\s*/)[0].length;

            if (/^### (.*)/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += `<h3>${processedLine.substring(4)}</h3>`;
            } else if (/^##### (.*)/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += `<h5>${processedLine.substring(6)}</h5>`;
            } else if (/^#### (.*)/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += `<h4>${processedLine.substring(5)}</h4>`;
            } else if (/^## (.*)/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += `<h2>${processedLine.substring(3)}</h2>`;
            } else if (/^# (.*)/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += `<h1>${processedLine.substring(2)}</h1>`;
            } else if (/^---/.test(line)) {
                closeOpenLists(currentLineIndent);
                html += '<hr>';
            } else if (/^(\s*)[*-]+\s+(.*)/.test(line)) {
                const match = line.match(/^(\s*)[*-]+\s+(.*)/);
                const itemIndent = match[1].length;
                let itemContent = match[2];
                // Apply inline formatting *after* identifying the list item content
                itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
                closeOpenLists(itemIndent, 'ul');
                if (listStack.length === 0 || listStack[listStack.length - 1].indent < itemIndent || listStack[listStack.length - 1].type !== 'ul') {
                    html += '<ul>';
                    listStack.push({ type: 'ul', indent: itemIndent });
                }
                html += `<li>${itemContent}</li>`;
            } else if (/^(\s*)(\d+\.)\s+(.*)/.test(line)) {
                const match = line.match(/^(\s*)(\d+\.)\s+(.*)/);
                const itemIndent = match[1].length;
                let itemContent = match[3];
                itemContent = itemContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
                closeOpenLists(itemIndent, 'ol');
                if (listStack.length === 0 || listStack[listStack.length - 1].indent < itemIndent || listStack[listStack.length - 1].type !== 'ol') {
                    html += '<ol>';
                    listStack.push({ type: 'ol', indent: itemIndent });
                }
                html += `<li>${itemContent}</li>`;
            } else if (line.trim() === '') {
                closeOpenLists(currentLineIndent);
                html += '<br>';
            } else {
                closeOpenLists(currentLineIndent);
                // Apply inline formatting for paragraphs
                processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
                html += `<p>${processedLine}</p>`;
            }
        }
        closeOpenLists(0);
        return html;
    }

    performReadmeSearch() {
        const searchTerm = this.readmeSearchInput.value.trim();
        this.readmeDisplay.innerHTML = this.originalReadmeHTML; // Reset content

        if (searchTerm === '') {
            this.readmeSearchCount.textContent = '';
            return;
        }

        const regex = new RegExp(searchTerm, 'gi');
        let matches = 0;
        const newHTML = this.originalReadmeHTML.replace(regex, (match) => {
            matches++;
            return `<mark>${match}</mark>`;
        });
        this.readmeDisplay.innerHTML = newHTML;
        this.readmeSearchCount.textContent = `${matches} found`;
        const firstMark = this.readmeDisplay.querySelector('mark');
        if (firstMark) firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    applySavedFontSize() {
        const savedContentSize = localStorage.getItem(this.FONT_SIZE_KEY);
        const savedMapSize = localStorage.getItem(this.MAP_FONT_SIZE_KEY);
        const defaultContentSize = '16px';
        const defaultMapSize = '24px';
        document.documentElement.style.setProperty('--dynamic-font-size', savedContentSize ? `${savedContentSize}px` : defaultContentSize);
        document.documentElement.style.setProperty('--mindmap-font-size', savedMapSize ? `${savedMapSize}px` : defaultMapSize);
    }

    applySavedTheme() {
        const savedTheme = localStorage.getItem(this.THEME_KEY) || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            document.getElementById('theme-switch').checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            document.getElementById('theme-switch').checked = false;
        }
        localStorage.setItem(this.THEME_KEY, theme);
    }

    applySavedViewMode() {
        const savedMode = localStorage.getItem(this.VIEW_MODE_KEY) || 'both';
        this.setViewMode(savedMode);
    }

    setViewMode(mode) {
        this.mainContainer.classList.remove('view-mode-content-only', 'view-mode-quiz-only', 'view-mode-both');
        this.mainContainer.classList.add(`view-mode-${mode}`);

        // Update active state on buttons
        const viewModeControls = document.getElementById('view-mode-controls');
        if (viewModeControls) {
            viewModeControls.querySelectorAll('.icon-button').forEach(btn => btn.classList.remove('active'));
            // Correct the ID construction to match the actual button IDs.
            // e.g., for mode 'content-only', it should look for 'view-content-btn'.
            const buttonId = `view-${mode.replace('-only', '')}-btn`;
            const activeBtn = document.getElementById(buttonId);
            if (activeBtn) {
                activeBtn.classList.add('active');
            }
        }

        localStorage.setItem(this.VIEW_MODE_KEY, mode);
    }
}