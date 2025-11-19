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

        // ReadMe Modal Elements
        this.readmeModal = document.getElementById('readme-modal');
        this.readmeDisplay = document.getElementById('readme-display');
        this.readmeSearchInput = document.getElementById('readme-search-input');
        this.readmeSearchCount = document.getElementById('readme-search-count');
        this.originalReadmeHTML = '';

        this.FONT_SIZE_KEY = 'mindmap-font-size';
        // Define bounds for font size
        this.MIN_FONT_SIZE = 16;
        this.MAX_FONT_SIZE = 32;

        this.initListeners();
        this.applySavedFontSize();
    }

    initListeners() {
        document.getElementById('open-menu-btn').addEventListener('click', () => this.openMenu());
        document.getElementById('close-menu-btn').addEventListener('click', () => this.closeMenu());
        document.addEventListener('click', (e) => {
            if (this.sidenav.style.width === '250px' && !this.sidenav.contains(e.target) && !e.target.closest('#open-menu-btn')) {
                this.closeMenu();
            }
        });
        document.getElementById('increase-font-btn').addEventListener('click', () => this.changeFontSize(1));
        document.getElementById('decrease-font-btn').addEventListener('click', () => this.changeFontSize(-1));
        this.nodeSearchInput.addEventListener('input', (e) => this.callbacks.onSearch(e.target.value));
        this.searchResultsContainer.addEventListener('click', (e) => {
            const resultItem = e.target.closest('.search-result-item');
            if (resultItem) {
                this.callbacks.onSearchResultClick(resultItem.dataset.nodeId);
            }
        });
        this.saveModuleBtn.addEventListener('click', () => this.callbacks.onSaveModule());
        document.getElementById('load-module-btn').addEventListener('click', () => this.callbacks.onLoadModuleFromFile());
        document.getElementById('auto-organize-btn').addEventListener('click', () => this.callbacks.onAutoOrganize());
        document.getElementById('show-readme-btn').addEventListener('click', () => this.openReadmeModal());
        document.getElementById('close-readme-btn').addEventListener('click', () => this.closeReadmeModal());
        this.readmeSearchInput.addEventListener('input', () => this.performReadmeSearch());

    }

    openMenu() {
        this.sidenav.style.width = '250px';
        this.mainContent.classList.add('main-content-shifted');
    }

    closeMenu() {
        this.sidenav.style.width = '0';
        this.mainContent.classList.remove('main-content-shifted');
    }

    updateOnModuleLoad() {
        this.moduleTitleEl.textContent = this.state.mindMapData.name;
        this.renderBreadcrumbs();
        this.saveModuleBtn.classList.remove('hidden');
    }

    populateModuleLoader(availableModules) {
        this.moduleLoaderEl.innerHTML = '';
        availableModules.forEach(module => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = module.name;
            link.onclick = (e) => {
                e.preventDefault();
                this.callbacks.onModuleSelect(module.path);
            };
            this.moduleLoaderEl.appendChild(link);
        });
    }

    renderBreadcrumbs() {
        this.breadcrumbNav.innerHTML = '';
        if (this.state.moduleStack.length > 0) {
            this.state.moduleStack.forEach((module, index) => {
                const link = document.createElement('a');
                link.href = '#';
                link.textContent = module.name;
                link.className = 'breadcrumb-link';
                link.onclick = (e) => {
                    e.preventDefault();
                    this.callbacks.onBreadcrumbClick(index);
                };
                this.breadcrumbNav.appendChild(link);

                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '>';
                this.breadcrumbNav.appendChild(separator);
            });
        }
    }

    displayNodeContent(nodeId) {
        const node = this.state.mindMapData.nodes[nodeId];
        this.contentDisplayEl.innerHTML = node.content;

        const heading = this.contentDisplayEl.querySelector('h1, h2, h3, h4, h5, h6');
        if (heading) {
            const wrapper = document.createElement('div');
            wrapper.className = 'content-title-wrapper';
            const actions = document.createElement('div');
            actions.className = 'content-actions';
            actions.append(this.callbacks.getActionButton('add'), this.callbacks.getActionButton('edit'), this.callbacks.getActionButton('remove'));
            heading.parentNode.insertBefore(wrapper, heading);
            wrapper.append(heading, actions);
        }

        if (node.quiz && node.quiz.length > 0) {
            this.quizContainer.classList.remove('hidden');
            this.callbacks.onStartQuiz(nodeId);
        } else {
            this.quizContainer.classList.add('hidden');
        }
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

    async openReadmeModal() {
        if (this.readmeDisplay.innerHTML === '') {
            try {
                const response = await fetch('README.md');
                const markdown = await response.text();
                this.originalReadmeHTML = this.parseMarkdown(markdown);
                this.readmeDisplay.innerHTML = this.originalReadmeHTML;
            } catch (error) {
                this.readmeDisplay.innerHTML = '<p>Error: Could not load README.md file.</p>';
                console.error('Error fetching README:', error);
            }
        }
        this.readmeModal.classList.remove('hidden');
        this.closeMenu();
    }

    closeReadmeModal() {
        this.readmeModal.classList.add('hidden');
        this.readmeSearchInput.value = '';
        this.performReadmeSearch(); // Clear highlights
    }

    parseMarkdown(text) {
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/`{3}([\s\S]*?)`{3}/gim, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/gim, '<code>$1</code>')
            .replace(/^\* (.*$)/gim, '<ul>\n<li>$1</li>\n</ul>')
            .replace(/<\/ul>\n<ul>/gim, '') // Combine consecutive lists
            .replace(/\n/g, '<br>');
    }

    performReadmeSearch() {
        const term = this.readmeSearchInput.value;
        this.readmeDisplay.innerHTML = this.originalReadmeHTML; // Reset content

        if (!term || term.length < 2) {
            this.readmeSearchCount.textContent = '';
            return;
        }

        const regex = new RegExp(term, 'gi');
        let count = 0;

        const walker = document.createTreeWalker(this.readmeDisplay, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];
        while (node = walker.nextNode()) {
            if (node.textContent.match(regex)) {
                const newHTML = node.textContent.replace(regex, (match) => {
                    count++;
                    return `<mark>${match}</mark>`;
                });
                nodesToReplace.push({ node, newHTML });
            }
        }
        nodesToReplace.forEach(({ node, newHTML }) => {
            const span = document.createElement('span');
            span.innerHTML = newHTML;
            node.parentNode.replaceChild(span, node);
        });

        this.readmeSearchCount.textContent = `${count} matches`;
    }

    applySavedFontSize() {
        const savedSize = localStorage.getItem(this.FONT_SIZE_KEY);
        const defaultSize = '16px';
        document.documentElement.style.setProperty('--dynamic-font-size', savedSize ? `${savedSize}px` : defaultSize);
    }
}