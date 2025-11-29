export class StateManager {
    constructor() {
        this.state = {
            mindMapData: null,
            moduleStack: [],
            activeNodeId: null,
        };
    }

    getState() {
        return this.state;
    }

    setActiveNode(nodeId) {
        this.state.activeNodeId = nodeId;
    }

    saveModuleToStorage() {
        if (!this.state.mindMapData || !this.state.mindMapData.id) return;
        const moduleId = this.state.mindMapData.id;
        const key = `mindmap-module-${moduleId}`;
        try {
            localStorage.setItem(key, JSON.stringify(this.state.mindMapData));
        } catch (error) {
            console.error(`[StateManager] Failed to save module '${moduleId}' to localStorage:`, error);
        }
    }

    getModuleFromStorage(moduleId, availableModules) {
        const key = `mindmap-module-${moduleId}`;
        const savedDataString = localStorage.getItem(key);
        if (!savedDataString) return null;

        const savedModule = JSON.parse(savedDataString);

        // CRITICAL FIX: If the saved module doesn't have a path (e.g., from an old save or file upload),
        // find its original path from the master list of available modules. This is essential for
        // breadcrumb navigation to function correctly.
        if (!savedModule.path) {
            const moduleInfo = availableModules.find(m => m.path.includes(`${moduleId}.json`));
            if (moduleInfo) savedModule.path = moduleInfo.path;
        }
        return savedModule;
    }
}