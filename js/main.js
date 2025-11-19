import { MindMapRenderer } from './MindMapRenderer.js';
import { MindMapInteraction } from './MindMapInteraction.js';
import { UIManager } from './UIManager.js';
import { NodeManager } from './NodeManager.js';

document.addEventListener('DOMContentLoaded', () => {
    class MindMapApp {
        constructor() {
            this.state = {
                mindMapData: null,
                moduleStack: [],
                activeNodeId: null,
                positions: {},
                pan: { x: 0, y: 0 },
                zoom: 1,
            };

            this.availableModules = [
                { name: 'Artificial Intelligence', path: 'modules/ai.json' },
                { name: 'Machine Learning', path: 'modules/ml.json' },
                { name: 'Deep Learning', path: 'modules/deep-learning.json' },
                { name: 'Supervised Learning', path: 'modules/supervised.json' },
                { name: 'Unsupervised Learning', path: 'modules/unsupervised.json' },
                { name: 'Reinforcement Learning', path: 'modules/reinforcement.json' },
                { name: 'Learning Paradigms', path: 'modules/learning-paradigms.json' },
                { name: 'AI Applications', path: 'modules/applications.json' },
                { name: 'AI Ethics', path: 'modules/ethics.json' }
            ];

            this.mindmapContainer = document.getElementById('mindmap-svg-container');
            this.quizManager = new QuizManager(this.state);

            this.renderer = new MindMapRenderer(this.mindmapContainer);
            
            this.interaction = new MindMapInteraction(this.mindmapContainer, this.state, {
                onPanZoom: () => this.renderer.applyTransform(this.state.pan, this.state.zoom),
                onNodeDrag: (nodeId, position) => this.handleNodeDrag(nodeId, position),
                onNodeSelect: (nodeId) => this.selectNode(nodeId),
                onDragEnd: () => this.saveModuleToStorage(),
            });

            this.nodeManager = new NodeManager(this.state, {
                onDataUpdate: (resetView = false) => {
                    this.saveModuleToStorage();
                    if (resetView) {
                        this.state.activeNodeId = null;
                        document.getElementById('content-display').innerHTML = `<p>Select a node from the map to view its content.</p>`;
                        document.getElementById('quiz-container').classList.add('hidden');
                    }
                    this.renderMindMap();
                    this.uiManager.closeMenu();
                }
            });

            this.uiManager = new UIManager(this.state, {
                onModuleSelect: (path) => this.loadModuleAndResetStack(path),
                onBreadcrumbClick: (index) => this.navigateToStackIndex(index),
                onSearch: (term) => this.performSearch(term),
                onSearchResultClick: (nodeId) => this.goToNode(nodeId),
                onStartQuiz: (nodeId) => this.quizManager.startQuizForNode(nodeId),
                getActionButton: (type) => {
                    const button = document.createElement('button');
                    button.className = 'icon-button';
                    if (type === 'add') {
                        button.title = 'Add Child Node';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
                        button.onclick = () => this.nodeManager.addChildNode();
                    } else if (type === 'edit') {
                        button.title = 'Edit Node';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
                        button.onclick = () => this.nodeManager.openNodeEditor();
                    } else if (type === 'remove') {
                        button.className = 'icon-button destructive';
                        button.title = 'Remove Node';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
                        button.onclick = () => this.nodeManager.removeSelectedNode();
                    }
                    return button;
                },
                onFontSizeChange: () => {
                    if (this.state.mindMapData && this.state.mindMapData.positions) {
                        delete this.state.mindMapData.positions;
                        this.saveModuleToStorage();
                    }
                    this.renderMindMap();
                },
                onSaveModule: () => this.saveModuleToFile(),
                onLoadModuleFromFile: () => this.loadModuleFromFile(),
                onAutoOrganize: () => this.autoOrganize(),
            });

            this.uiManager.populateModuleLoader(this.availableModules);
            this.loadModule('modules/ai.json');
        }

        async loadModule(moduleSource) {
            try {
                let newModuleData;
                if (typeof moduleSource === 'string') {
                    const moduleId = moduleSource.split('/').pop().replace('.json', '');
                    const savedModule = this.getModuleFromStorage(moduleId);
                    newModuleData = savedModule || await (await fetch(moduleSource)).json();
                } else {
                    newModuleData = moduleSource;
                }

                if (this.state.mindMapData && typeof moduleSource === 'string') {
                    this.state.moduleStack.push(this.state.mindMapData);
                }

                this.state.mindMapData = newModuleData;
                this.quizManager.setMindMapData(this.state.mindMapData);
                this.renderMindMap();
                this.uiManager.updateOnModuleLoad();
                this.setActiveNode('root');
            } catch (error) {
                console.error('Failed to load module:', error);
            }
        }

        loadModuleAndResetStack(modulePath) {
            this.state.moduleStack.length = 0;
            this.loadModule(modulePath);
            this.uiManager.closeMenu();
        }

        renderMindMap() {
            if (!this.state.mindMapData) return;

            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dynamic-font-size'));
            this.state.positions = this.state.mindMapData.positions || {};

            const { pan, zoom } = this.renderer.render(
                this.state.mindMapData,
                this.state.positions,
                baseFontSize,
                (e, nodeId) => this.interaction.handleNodeMouseDown(e, nodeId)
            );

            this.state.pan = pan;
            this.state.zoom = zoom;
            this.renderer.applyTransform(this.state.pan, this.state.zoom);
        }

        setActiveNode(nodeId) {
            this.state.activeNodeId = nodeId;
            document.querySelectorAll('.node-circle').forEach(c => c.classList.remove('active'));
            const group = this.mindmapContainer.querySelector(`g[data-node-id="${nodeId}"]`);
            if (group) {
                group.querySelector('.node-circle').classList.add('active');
            }
            this.uiManager.displayNodeContent(nodeId);
        }

        selectNode(nodeId) {
            const node = this.state.mindMapData.nodes[nodeId];
            if (node.subModule) {
                this.loadModule(node.subModule);
            } else {
                this.setActiveNode(nodeId);
            }
        }

        navigateToStackIndex(index) {
            const modulesToPop = this.state.moduleStack.length - (index + 1);
            for (let i = 0; i < modulesToPop; i++) this.state.moduleStack.pop();
            const targetModule = this.state.moduleStack.pop();
            this.loadModule(targetModule);
        }

        handleNodeDrag(nodeId, position) {
            if (!this.state.mindMapData.positions) this.state.mindMapData.positions = {};
            this.state.mindMapData.positions[nodeId] = position;

            const draggedGroup = this.mindmapContainer.querySelector(`g[data-node-id="${nodeId}"]`);
            if (draggedGroup) {
                draggedGroup.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                this.renderer.updateConnectingLines(nodeId, position);
            }
        }

        saveModuleToStorage() {
            if (!this.state.mindMapData || !this.state.mindMapData.id) return;
            localStorage.setItem(`mindmap-module-${this.state.mindMapData.id}`, JSON.stringify(this.state.mindMapData));
        }

        getModuleFromStorage(moduleId) {
            const savedData = localStorage.getItem(`mindmap-module-${moduleId}`);
            return savedData ? JSON.parse(savedData) : null;
        }

        autoOrganize() {
            if (this.state.mindMapData && this.state.mindMapData.positions) {
                delete this.state.mindMapData.positions;
                this.saveModuleToStorage();
            }
            this.renderMindMap();
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
            this.uiManager.closeMenu();
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
            this.uiManager.closeMenu();
        }

        performSearch(term) {
            if (!term || term.length < 2) {
                this.renderSearchResults([]);
                return;
            }
            const searchTerm = term.toLowerCase();
            const results = [];
            Object.values(this.state.mindMapData.nodes).forEach(node => {
                const title = node.title.toLowerCase();
                const content = node.content.replace(/<[^>]*>/g, ' ').toLowerCase();
                let matchIndex = -1;
                let foundIn = '';
                if (title.includes(searchTerm)) {
                    matchIndex = title.indexOf(searchTerm);
                    foundIn = 'title';
                } else if (content.includes(searchTerm)) {
                    matchIndex = content.indexOf(searchTerm);
                    foundIn = 'content';
                }
                if (matchIndex > -1) {
                    const sourceText = foundIn === 'title' ? node.title : node.content.replace(/<[^>]*>/g, ' ');
                    const snippetStart = Math.max(0, matchIndex - 30);
                    const snippetEnd = Math.min(sourceText.length, matchIndex + term.length + 30);
                    let snippet = sourceText.substring(snippetStart, snippetEnd);
                    if (snippetStart > 0) snippet = '...' + snippet;
                    if (snippetEnd < sourceText.length) snippet = snippet + '...';
                    results.push({ nodeId: node.id, title: node.title, snippet: snippet });
                }
            });
            this.renderSearchResults(results);
        }

        renderSearchResults(results) {
            const container = document.getElementById('search-results-container');
            const input = document.getElementById('node-search-input');
            if (results.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = results.map(result => `
                <div class="search-result-item" data-node-id="${result.nodeId}">
                    <h4>${result.title}</h4>
                    <p>${result.snippet.replace(new RegExp(input.value, 'gi'), '<strong>$&</strong>')}</p>
                </div>
            `).join('');
        }

        goToNode(nodeId) {
            const nodePosition = this.state.positions[nodeId];
            if (!nodePosition) return;

            this.state.zoom = 1;
            this.state.pan.x = (this.mindmapContainer.clientWidth / 2) - (nodePosition.x * this.state.zoom);
            this.state.pan.y = (this.mindmapContainer.clientHeight / 2) - (nodePosition.y * this.state.zoom);
            this.renderer.applyTransform(this.state.pan, this.state.zoom);

            this.selectNode(nodeId);
            this.uiManager.closeMenu();
        }
    }

    new MindMapApp();
});
