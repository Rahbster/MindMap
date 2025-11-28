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

    getModuleFromStorage(moduleId) {
        const key = `mindmap-module-${moduleId}`;
        const savedDataString = localStorage.getItem(key);
        return savedDataString ? JSON.parse(savedDataString) : null;
    }
}