export class NodeManager {
    constructor(appState, callbacks) {
        this.state = appState;
        this.callbacks = callbacks;

        this.nodeEditorModal = document.getElementById('node-editor-modal');
        this.nodeTitleInput = document.getElementById('node-title-input');
        this.saveNodeBtn = document.getElementById('save-node-btn');
        this.cancelNodeEditBtn = document.getElementById('cancel-node-edit-btn');
        this.quillEditor = null;

        this.saveNodeBtn.addEventListener('click', () => this.saveNodeChanges());
        this.cancelNodeEditBtn.addEventListener('click', () => this.closeNodeEditor());
    }

    openNodeEditor() {
        if (!this.state.activeNodeId) return;

        const node = this.state.mindMapData.nodes[this.state.activeNodeId];
        this.nodeTitleInput.value = node.title;

        if (!this.quillEditor) {
            this.quillEditor = new Quill('#node-content-editor', {
                theme: 'snow',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                    ]
                }
            });
        }
        this.quillEditor.root.innerHTML = node.content;
        this.nodeEditorModal.classList.remove('hidden');
    }

    closeNodeEditor() {
        this.nodeEditorModal.classList.add('hidden');
    }

    saveNodeChanges() {
        if (!this.state.activeNodeId) return;

        const node = this.state.mindMapData.nodes[this.state.activeNodeId];
        node.title = this.nodeTitleInput.value;
        node.content = this.quillEditor.root.innerHTML;

        this.callbacks.onDataUpdate();
        this.closeNodeEditor();
    }

    addChildNode() {
        if (!this.state.activeNodeId) return;

        const newTitle = prompt("Enter a title for the new child node:");
        if (!newTitle) return;

        const parentNode = this.state.mindMapData.nodes[this.state.activeNodeId];
        const newId = `node-${Date.now()}`;

        const newNode = {
            id: newId,
            title: newTitle,
            content: `<p>Content for ${newTitle}.</p>`,
            children: [],
            quiz: []
        };

        this.state.mindMapData.nodes[newId] = newNode;
        if (!parentNode.children) parentNode.children = [];
        parentNode.children.push(newId);

        this.callbacks.onDataUpdate();
    }

    removeSelectedNode() {
        if (!this.state.activeNodeId || this.state.activeNodeId === 'root') {
            if (this.state.activeNodeId === 'root') alert("Cannot remove the root node of a module.");
            return;
        }
        if (!confirm(`Are you sure you want to remove the node "${this.state.mindMapData.nodes[this.state.activeNodeId].title}" and all its children?`)) {
            return;
        }

        const parent = Object.values(this.state.mindMapData.nodes).find(p => p.children?.includes(this.state.activeNodeId));
        if (parent) {
            parent.children = parent.children.filter(childId => childId !== this.state.activeNodeId);
        }

        const deleteRecursive = (nodeId) => {
            const node = this.state.mindMapData.nodes[nodeId];
            if (!node) return;
            (node.children || []).forEach(childId => deleteRecursive(childId));
            delete this.state.mindMapData.nodes[nodeId];
        };

        deleteRecursive(this.state.activeNodeId);
        this.callbacks.onDataUpdate(true); // Pass true to reset view
    }
}