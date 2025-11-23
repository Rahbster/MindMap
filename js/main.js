import { MindMapRenderer } from './MindMapRenderer.js';
import { MindMapInteraction } from './MindMapInteraction.js';
import { QuizManager } from './QuizManager.js';
import { UIManager } from './UIManager.js';
import { NodeManager } from './NodeManager.js';
import { StateManager } from './StateManager.js';
import { ModuleLoader } from './ModuleLoader.js';
import { SearchHandler } from './SearchHandler.js';

document.addEventListener('DOMContentLoaded', () => {
    class MindMapApp {
        constructor() {
            this.stateManager = new StateManager();
            this.state = this.stateManager.getState();

            this.availableModules = [
                { name: 'Artificial Intelligence', path: 'modules/ai.json' }, // Main entry point
                // ... other modules
                { name: 'Machine Learning', path: 'modules/ai/ml.json' },
                { name: 'Deep Learning', path: 'modules/ai/ml/deep-learning.json' },
                { name: 'Natural Language Processing', path: 'modules/ai/applications/nlp.json' },
                { name: 'History of AI', path: 'modules/ai/history-of-ai.json' },
                { name: 'Computer Vision', path: 'modules/ai/applications/computer-vision.json' },
                { name: 'Generative AI', path: 'modules/ai/applications/generative-ai.json' },
                { name: 'AI Applications', path: 'modules/ai/applications.json' },
                { name: 'AI Ethics', path: 'modules/ai/ethics.json' },
                { name: 'Modern Web Development', path: 'modules/web-development.json' }
            ];

            this.mindmapContainer = document.getElementById('mindmap-svg-container');
            this.quizManager = new QuizManager(this.state);
            this.renderer = new MindMapRenderer(this.mindmapContainer, this.state);
            
            this.interaction = new MindMapInteraction(this.mindmapContainer, this.state, {
                onPanZoom: () => this.renderer.applyTransform(this.state.pan, this.state.zoom),
                onNodeDrag: (nodeId, position) => {
                    this.renderer.runLayoutAnimation(false); // Stop auto-layout on manual drag
                    this.handleNodeDrag(nodeId, position);
                },
                onNodeSelect: (nodeId) => this.selectNode(nodeId),
                onDragEnd: () => this.stateManager.saveModuleToStorage(),
            });

            this.moduleLoader = new ModuleLoader(this.stateManager, this.availableModules, {
                onModuleLoaded: () => {
                    this.quizManager.setMindMapData(this.state.mindMapData);
                    this.renderMindMap();
                    this.uiManager.updateOnModuleLoad();
                    this.setActiveNode('root');
                },
                onMenuClose: () => this.uiManager.closeMenu(),
            });

            this.nodeManager = new NodeManager(this.state, {
                onDataUpdate: (resetView = false) => {
                    this.stateManager.saveModuleToStorage();
                    if (resetView) {
                        this.stateManager.setActiveNode(null);
                        document.getElementById('content-display').innerHTML = `<p>Select a node from the map to view its content.</p>`;
                        document.getElementById('quiz-container').classList.add('hidden');
                    }
                    this.renderMindMap();
                    this.uiManager.closeMenu();
                }
            });

            this.searchHandler = new SearchHandler(this.stateManager, this.availableModules, {
                onSearchResults: (results) => this.uiManager.renderSearchResults(results),
                onGoToNode: (nodeId) => {
                    this.renderer.applyTransform(this.state.pan, this.state.zoom);
                    this.selectNode(nodeId);
                    this.uiManager.closeMenu();
                },
                getContainerWidth: () => this.mindmapContainer.clientWidth,
                getContainerHeight: () => this.mindmapContainer.clientHeight,
            });

            this.uiManager = new UIManager(this.state, {
                onModuleSelect: (path) => this.moduleLoader.loadModuleAndResetStack(path),
                onBreadcrumbClick: (index) => this.moduleLoader.navigateToStackIndex(index),
                onSearch: (term) => this.searchHandler.performSearch(term),
                onSearchResultClick: (nodeId, modulePath) => {
                    // Find the path of the currently loaded module from the available modules list for a reliable comparison.
                    const currentModuleInfo = this.availableModules.find(m => m.name === this.state.mindMapData.name);
                    const currentModulePath = currentModuleInfo ? currentModuleInfo.path : null;

                    if (currentModulePath === modulePath) {
                        // Result is in the current module, just go to it.
                        this.searchHandler.goToNode(nodeId);
                    } else {
                        // Result is in a different module, load it and then go to the node.
                        // Use a callback to ensure goToNode is called *after* the module is loaded.
                        this.moduleLoader.loadModuleAndResetStack(modulePath, () => this.searchHandler.goToNode(nodeId));
                    }
                },
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
                    // Re-render the mind map to adjust for any size changes, but do not delete positions.
                    this.renderMindMap();
                },
                onSaveModule: () => this.moduleLoader.saveModuleToFile(),
                onLoadModuleFromFile: () => this.moduleLoader.loadModuleFromFile(),
                onAutoOrganize: () => this.autoOrganize(),
            });
            this.uiManager.callbacks.onStopAutoOrganize = () => this.stopAutoOrganize();
            this.renderer.callbacks = { onLayoutEnd: () => {
                this.stateManager.saveModuleToStorage();
                this.uiManager.stopOrganizeIndicator();
            }};

            this.uiManager.populateModuleLoader(this.availableModules);
            this.moduleLoader.loadModule('modules/ai.json');
        }

        renderMindMap() {
            if (!this.state.mindMapData) return;

            // Check if positions exist before rendering.
            const hadPositions = this.state.mindMapData.positions && Object.keys(this.state.mindMapData.positions).length > 0;

            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mindmap-font-size'));
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

            // If positions did not exist before, save the newly generated ones.
            if (!hadPositions) {
                this.stateManager.saveModuleToStorage();
            }
        }

        setActiveNode(nodeId) {
            this.stateManager.setActiveNode(nodeId);
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
                // This is a sub-module navigation.
                // To prevent duplicates, only push the current module if it's not already at the top of the stack.
                const stackTop = this.state.moduleStack[this.state.moduleStack.length - 1];
                if (!stackTop || stackTop.id !== this.state.mindMapData.id) {
                    this.state.moduleStack.push(this.state.mindMapData);
                }

                this.moduleLoader.loadModule(node.subModule); // Then load the new one.
            } else {
                this.setActiveNode(nodeId);
            }
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

        autoOrganize() {
            // This will either start a new animation or boost the existing one.
            this.renderer.runLayoutAnimation(true, this.state.positions);
        }

        stopAutoOrganize() {
            this.renderer.runLayoutAnimation(false); // Stop the animation
            // CRITICAL FIX: Sync the final animated positions back to the main data object before saving.
            this.state.mindMapData.positions = this.state.positions;
            this.uiManager.stopOrganizeIndicator(); // Stop the blinking
            this.stateManager.saveModuleToStorage(); // Save the final positions
        }
    }

    new MindMapApp();
});
