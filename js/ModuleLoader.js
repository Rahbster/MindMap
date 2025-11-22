export class ModuleLoader {
    constructor(stateManager, availableModules, callbacks) {
        this.stateManager = stateManager;
        this.state = stateManager.getState();
        this.availableModules = availableModules;
        this.callbacks = callbacks;
    }

    async loadModule(moduleSource, onComplete) {
        try {
            let newModuleData;
            if (typeof moduleSource === 'string') {
                const moduleId = moduleSource.split('/').pop().replace('.json', '');
                const savedModule = this.stateManager.getModuleFromStorage(moduleId);
                newModuleData = savedModule || await (await fetch(moduleSource)).json();
            } else {
                newModuleData = moduleSource;
            }

            this.state.mindMapData = newModuleData;
            this.state.mindMapData.path = typeof moduleSource === 'string' ? moduleSource : null;
            this.callbacks.onModuleLoaded();
            if (onComplete) onComplete(); // Execute the callback after loading is done.
        } catch (error) {
            console.error('Failed to load module:', error);
        }
    }

    loadModuleAndResetStack(modulePath, onComplete) {
        this.state.moduleStack.length = 0;
        this.loadModule(modulePath, onComplete);
        this.callbacks.onMenuClose();
    }

    navigateToStackIndex(index) {
        // Get the module data for the breadcrumb link that was clicked.
        const targetModule = this.state.moduleStack[index];
        // Truncate the stack to the level of the clicked breadcrumb.
        this.state.moduleStack = this.state.moduleStack.slice(0, index);

        // Reload the target module. The stack is now in the correct state.
        this.loadModule(targetModule.path || targetModule);
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