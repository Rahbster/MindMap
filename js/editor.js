class MindMapEditor {
    constructor(loadModuleCallback) {
        this.loadModuleCallback = loadModuleCallback;

        this.editorView = document.getElementById('editor-view');
        this.jsonEditor = document.getElementById('json-editor');
        this.mindmapContainer = document.querySelector('.mindmap-container');
        this.contentContainer = document.querySelector('.content-container');

        document.getElementById('edit-module-btn').addEventListener('click', () => this.openEditor());
        document.getElementById('save-editor-btn').addEventListener('click', () => this.save());
        document.getElementById('cancel-editor-btn').addEventListener('click', () => this.closeEditor());
    }

    openEditor() {
        // We need the raw JSON string of the current module
        const currentModuleData = window.mindMap.getCurrentModuleData();
        if (!currentModuleData) {
            alert('No module loaded to edit.');
            return;
        }

        this.jsonEditor.value = JSON.stringify(currentModuleData, null, 2);
        this.mindmapContainer.classList.add('hidden');
        this.contentContainer.classList.add('hidden');
        this.editorView.classList.remove('hidden');
        window.mindMap.closeMenu();
    }

    closeEditor() {
        this.editorView.classList.add('hidden');
        this.mindmapContainer.classList.remove('hidden');
        this.contentContainer.classList.remove('hidden');
    }

    save() {
        try {
            const updatedJson = JSON.parse(this.jsonEditor.value);
            // Pass the updated JSON object directly to be reloaded
            this.loadModuleCallback(updatedJson);
            this.closeEditor();
        } catch (error) {
            console.error('Invalid JSON:', error);
            alert('Error: Invalid JSON format. Please check your syntax.\n\n' + error.message);
        }
    }
}