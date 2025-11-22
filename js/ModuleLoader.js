export class ModuleLoader {
    constructor(stateManager, callbacks) {
        this.stateManager = stateManager;
        this.state = stateManager.getState();
        this.callbacks = callbacks;
    }

    async loadModule(moduleSource) {
        try {
            let newModuleData;
            if (typeof moduleSource === 'string') {
                const moduleId = moduleSource.split('/').pop().replace('.json', '');
                const savedModule = this.stateManager.getModuleFromStorage(moduleId);
                newModuleData = savedModule || await (await fetch(moduleSource)).json();
            } else {
                newModuleData = moduleSource;
            }

            if (this.state.mindMapData && typeof moduleSource === 'string') {
                this.state.moduleStack.push(this.state.mindMapData);
            }

            this.state.mindMapData = newModuleData;
            this.callbacks.onModuleLoaded();
        } catch (error) {
            console.error('Failed to load module:', error);
        }
    }

    loadModuleAndResetStack(modulePath) {
        this.state.moduleStack.length = 0;
        this.loadModule(modulePath);
        this.callbacks.onMenuClose();
    }

    navigateToStackIndex(index) {
        const modulesToPop = this.state.moduleStack.length - (index + 1);
        for (let i = 0; i < modulesToPop; i++) this.state.moduleStack.pop();
        const targetModule = this.state.moduleStack.pop();
        this.loadModule(targetModule);
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