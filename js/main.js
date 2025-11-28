import { MindMapRenderer } from './MindMapRenderer.js';
import { MindMapInteraction } from './MindMapInteraction.js';
import { QuizManager } from './QuizManager.js';
import { UIManager } from './UIManager.js';
import { NodeManager } from './NodeManager.js';
import { StateManager } from './StateManager.js';
import { ModuleLoader } from './ModuleLoader.js';
import { SearchHandler } from './SearchHandler.js';
import { ToastManager } from './ToastManager.js';

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
                { name: 'Modern Web Development', path: 'modules/web-development.json' },
                { name: 'Learning Paradigms', path: 'modules/ai/learning-paradigms.json' },
                { name: 'Programming with AI', path: 'modules/ai/programming-with-ai.json' },
                // New .NET Development Modules
                { name: 'Modern .NET Development', path: 'modules/dotnet.json' },
                { name: 'Web Rendering Models', path: 'modules/dotnet/web-rendering-models.json' },
                { name: 'Blazor Framework', path: 'modules/dotnet/blazor.json' },
                { name: 'Razor Syntax', path: 'modules/dotnet/razor-syntax.json' }
            ];

            this.mindmapContainer = document.getElementById('mindmap-svg-container');
            this.quizManager = new QuizManager(this.state);
            this.renderer = new MindMapRenderer(this.mindmapContainer, this.state);
            this.toastManager = new ToastManager();
            
            this.interaction = new MindMapInteraction(this.mindmapContainer, this, {
                onPanZoom: (pan, zoom) => this.renderer.applyTransform(pan, zoom),
                onNodeDrag: (nodeId, position) => {
                    this.renderer.runLayoutAnimation(false); // Stop auto-layout on manual drag
                    this.handleNodeDrag(nodeId, position);
                },
                onNodeSelect: (nodeId) => this.selectNode(nodeId),
                onDragEnd: () => {
                    this.stateManager.saveModuleToStorage();
                },
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
                    } else if (type === 'quiz') {
                        button.title = 'Edit Quiz';
                        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
                        button.onclick = () => this.nodeManager.openQuizEditor();
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
            this.uiManager.callbacks.onStopAutoOrganize = (event) => this.stopAutoOrganize(event);
            this.renderer.callbacks = { onLayoutEnd: () => {
                // This callback is for when the animation finishes on its own (cools down).
                this._finalizeLayout();
            }};

            this.uiManager.populateModuleLoader(this.availableModules);
            this.moduleLoader.loadModule('modules/ai.json');
        }

        renderMindMap() {
            if (!this.state.mindMapData) return;

            // Check if positions exist before rendering.
            const hadPositions = this.state.mindMapData.positions && Object.keys(this.state.mindMapData.positions).length > 0;

            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mindmap-font-size')) || 24;
            this.state.mindMapData.positions = this.state.mindMapData.positions || {};
            this.state.mindMapData.pan = this.state.mindMapData.pan || { x: 0, y: 0 };
            this.state.mindMapData.zoom = this.state.mindMapData.zoom || 1;

            this.renderer.render(
                this.state.mindMapData,
                this.state.mindMapData.positions,
                baseFontSize,
                (e, nodeId) => this.interaction.handleNodeMouseDown(e, nodeId)
            );

            this.renderer.applyTransform(this.state.mindMapData.pan, this.state.mindMapData.zoom);

            // If positions did not exist before, save the newly generated ones.
            if (!hadPositions) {
                this.stateManager.saveModuleToStorage();
            }
        }

        getState() {
            return this.state;
        }

        setActiveNode(nodeId) {
            this.stateManager.setActiveNode(nodeId);
            this.mindmapContainer.querySelectorAll('.node-circle').forEach(c => c.classList.remove('active'));
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
                // CRITICAL FIX: Save the current module's state (with its new positions) before navigating away.
                this.stateManager.saveModuleToStorage();
                
                // Push only the identifier for the current module, not the full data object.
                // This prevents stale data from being stored in the stack.
                this.state.moduleStack.push({ name: this.state.mindMapData.name, path: this.state.mindMapData.path });
                
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
            // Ensure positions object exists and pass it to the animation.
            // The renderer will mutate this object directly.
            if (!this.state.mindMapData.positions) this.state.mindMapData.positions = {};
            this.renderer.runLayoutAnimation(true, this.state.mindMapData.positions);
        }

        stopAutoOrganize(event) {
            if (event) {
                // Stop the mouseup event from bubbling to the interaction handler
                // and triggering a drag-end event.
                event.stopPropagation();
            }
            this.renderer.runLayoutAnimation(false); // Stop the animation
            this._finalizeLayout();
        }

        /**
         * A helper function called after any layout operation (auto or manual stop).
         * It ensures the final state is captured, saved, and the UI is updated.
         * @private
         */
        _finalizeLayout() {
            // When stopping manually, we need to get the final animated state from the renderer.
            const finalState = this.renderer.getFinalLayoutState();
            if (finalState) {
                this.state.mindMapData.pan = finalState.pan;
                this.state.mindMapData.zoom = finalState.zoom;
            }
            // Now, save the fully updated state.
            this.stateManager.saveModuleToStorage();
            this.uiManager.stopOrganizeIndicator(); // Stop the blinking indicator
        }
    }

    new MindMapApp();
});
