export class StateManager {
    constructor() {
        this.state = {
            mindMapData: null,
            moduleStack: [],
            activeNodeId: null,
            positions: {},
            pan: { x: 0, y: 0 },
            zoom: 1,
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
        localStorage.setItem(`mindmap-module-${this.state.mindMapData.id}`, JSON.stringify(this.state.mindMapData));
    }

    getModuleFromStorage(moduleId) {
        const savedData = localStorage.getItem(`mindmap-module-${moduleId}`);
        return savedData ? JSON.parse(savedData) : null;
    }
}