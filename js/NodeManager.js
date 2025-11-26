export class NodeManager {
    constructor(appState, callbacks) {
        this.state = appState;
        this.callbacks = callbacks;

        this.editorModal = document.getElementById('node-editor-modal');
        this.titleInput = document.getElementById('node-title-input');
        this.contentEditor = null; // Quill instance

        this.initQuill();
        this.initQuizEditorModal();
        this.initListeners(); // Listeners now attached to dynamically created modals
    }

    initQuill() {
        if (!this.contentEditor) {
            this.contentEditor = new Quill('#node-content-editor', {
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
    }

    initQuizEditorModal() {
        if (document.getElementById('quiz-editor-modal')) return;

        const modalHTML = `
            <div id="quiz-editor-modal" class="modal hidden">
                <div class="modal-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>Quiz Editor</h3>
                        <button id="add-quiz-question-btn" class="button-secondary">Add Question</button>
                    </div>
                    <div id="quiz-editor-container"></div>
                    <div class="modal-buttons">
                        <button id="save-quiz-btn" class="button-primary">Save Quiz</button>
                        <button id="cancel-quiz-edit-btn" class="button-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.quizEditorModal = document.getElementById('quiz-editor-modal');
        this.quizEditorContainer = document.getElementById('quiz-editor-container');
    }

    initListeners() {
        document.getElementById('save-node-btn').addEventListener('click', () => this.saveNode());
        document.getElementById('cancel-node-edit-btn').addEventListener('click', () => this.closeNodeEditor());
        document.getElementById('add-quiz-question-btn').addEventListener('click', () => this.addQuizQuestionToEditor()); // This now correctly targets the button in the new modal
        document.getElementById('save-quiz-btn').addEventListener('click', () => this.saveQuiz());
        document.getElementById('cancel-quiz-edit-btn').addEventListener('click', () => this.closeQuizEditor());
    }

    openNodeEditor() {
        if (!this.state.activeNodeId) return;
        const node = this.state.mindMapData.nodes[this.state.activeNodeId];
        this.isNewNode = false;
        this.titleInput.value = node.title;
        this.contentEditor.root.innerHTML = node.content;
        this.editorModal.classList.remove('hidden');
    }

    openNewNodeEditor() {
        if (!this.state.activeNodeId) return;
        this.isNewNode = true;
        this.titleInput.value = 'New Node';
        this.contentEditor.root.innerHTML = '<p>New node content.</p>';
        this.editorModal.classList.remove('hidden');
    }

    closeNodeEditor() {
        this.editorModal.classList.add('hidden');
    }

    openQuizEditor() {
        if (!this.state.activeNodeId) return;
        const node = this.state.mindMapData.nodes[this.state.activeNodeId];
        this.populateQuizEditor(node.quiz);
        this.quizEditorModal.classList.remove('hidden');
    }

    closeQuizEditor() {
        this.quizEditorModal.classList.add('hidden');
    }

    saveNode() {
        const newTitle = this.titleInput.value;
        const newContent = this.contentEditor.root.innerHTML;

        if (this.isNewNode) {
            const parentId = this.state.activeNodeId;
            const parentNode = this.state.mindMapData.nodes[parentId];
            const newNodeId = `node-${Date.now()}`;
            const newNode = { id: newNodeId, title: newTitle, content: newContent, children: [], quiz: null };
            this.state.mindMapData.nodes[newNodeId] = newNode;
            if (!parentNode.children) parentNode.children = [];
            // CRITICAL FIX: When adding a new node, we must clear the existing positions
            // to force the renderer to calculate a new layout that includes the new node.
            this.state.mindMapData.positions = {};
            parentNode.children.push(newNodeId);
        } else {
            const node = this.state.mindMapData.nodes[this.state.activeNodeId];
            node.title = newTitle;
            node.content = newContent;
        }

        this.callbacks.onDataUpdate(true);
        this.closeNodeEditor();
    }

    saveQuiz() {
        if (!this.state.activeNodeId) return;
        const node = this.state.mindMapData.nodes[this.state.activeNodeId];
        node.quiz = this.collectQuizDataFromEditor();
        this.callbacks.onDataUpdate(false); // No need to reset view, just save data
        this.closeQuizEditor();
    }

    addChildNode() {
        if (!this.state.activeNodeId) return;
        this.openNewNodeEditor();
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

    populateQuizEditor(quizData = []) {
        this.quizEditorContainer.innerHTML = '';
        if (quizData && quizData.length > 0) {
            quizData.forEach(q => this.addQuizQuestionToEditor(q));
        }
    }

    addQuizQuestionToEditor(questionData = null) {
        const questionEl = document.createElement('div');
        questionEl.className = 'quiz-question-editor';

        const questionInput = this.createInput('text', 'Question', questionData?.question || '');
        const answerInput = this.createInput('text', 'Correct Answer', questionData?.answer || '');

        const optionsLabel = document.createElement('label');
        optionsLabel.textContent = 'Incorrect Options:';
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'quiz-options-container';

        const options = questionData?.options || [];
        options.forEach(opt => {
            optionsContainer.appendChild(this.createOptionInput(opt));
        });

        const addOptionBtn = document.createElement('button');
        addOptionBtn.textContent = 'Add Option';
        addOptionBtn.type = 'button';
        addOptionBtn.onclick = () => optionsContainer.appendChild(this.createOptionInput());

        const removeQuestionBtn = document.createElement('button');
        removeQuestionBtn.textContent = 'Delete Question';
        removeQuestionBtn.type = 'button';
        removeQuestionBtn.className = 'remove-quiz-question-btn';
        removeQuestionBtn.onclick = () => questionEl.remove();

        questionEl.append(questionInput.label, questionInput.input, answerInput.label, answerInput.input, optionsLabel, optionsContainer, addOptionBtn, removeQuestionBtn);
        this.quizEditorContainer.appendChild(questionEl);
    }

    createInput(type, labelText, value) {
        const label = document.createElement('label');
        label.textContent = labelText;
        const input = document.createElement('input');
        input.type = type;
        input.className = 'modal-input';
        input.value = value;
        input.placeholder = labelText; // Add placeholder
        return { label, input };
    }

    createOptionInput(value = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'quiz-option-item';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'modal-input quiz-option-input';
        input.value = value;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.type = 'button';
        removeBtn.className = 'remove-quiz-option-btn';
        removeBtn.onclick = () => wrapper.remove();
        wrapper.append(input, removeBtn);
        return wrapper;
    }

    collectQuizDataFromEditor() {
        const quizData = [];
        const questionEditors = this.quizEditorContainer.querySelectorAll('.quiz-question-editor');

        questionEditors.forEach(editor => {
            const questionInput = editor.querySelector('input[placeholder="Question"]');
            const answerInput = editor.querySelector('input[placeholder="Correct Answer"]');
            
            if (!questionInput || !answerInput) return;

            const question = questionInput.value.trim();
            const answer = answerInput.value.trim();
            const options = [];
            editor.querySelectorAll('.quiz-option-input').forEach(optInput => {
                const optionValue = optInput.value.trim();
                if (optionValue) options.push(optionValue);
            });

            if (question && answer) {
                quizData.push({ question, answer, options });
            }
        });

        return quizData.length > 0 ? quizData : null;
    }
}