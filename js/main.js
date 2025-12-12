import { MindMapRenderer } from './MindMapRenderer.js';
import { MindMapInteraction } from './MindMapInteraction.js';
import { QuizManager } from './QuizManager.js';
import { UIManager } from './UIManager.js';
import { NodeManager } from './NodeManager.js';
import { StateManager } from './StateManager.js';
import { ModuleLoader } from './ModuleLoader.js'; // Import the new manager
import { StorageManager } from './StorageManager.js';
import { SearchHandler } from './SearchHandler.js';
import { BreadcrumbManager } from './BreadcrumbManager.js';
import { ToastManager } from './ToastManager.js';

document.addEventListener('DOMContentLoaded', () => {
    // Immediately-invoked async function to initialize the app
    (async () => {
        await new MindMapApp().init();
    })();
});

    class MindMapApp {
        constructor() {
            /**
             * Logs detailed diagnostic information about the MindMap state to the console.
             * @param {string} source - The origin of the event (e.g., 'Node Click', 'Breadcrumb Click').
             * @param {string} nodeId - The ID of the selected node.
             */
            this.logDiagnostics = (source, nodeId) => {
                const nodeData = this.state.mindMapData?.nodes[nodeId];
                const svgElement = this.mindmapContainer.querySelector('svg');

                console.group(`[MindMap Diagnostics] - Event Source: ${source}`);
                console.log(`Timestamp: ${new Date().toISOString()}`);
                console.log(`🔹 Selected Node ID: ${nodeId}`);
                console.log('🔹 Selected Node Data:', nodeData);

                if (svgElement) {
                    const transform = this.state.mindMapData; // Pan/zoom are on the data object
                    console.group("SVG Transform State (at time of click)");
                    console.log(`Pan (x, y): (${transform.pan.x.toFixed(2)}, ${transform.pan.y.toFixed(2)})`);
                    console.log(`Zoom (k): ${transform.zoom.toFixed(2)}`);
                    console.groupEnd();
                }
                console.groupEnd();
            };
            this.stateManager = new StateManager();
            this.state = this.stateManager.getState();
            this.availableModules = []; // Will be populated from modules.json
        }

        async init() {
            this.mindmapContainer = document.getElementById('mindmap-svg-container');
            this.quizManager = new QuizManager(this.state);
            this.renderer = new MindMapRenderer(this.mindmapContainer, this.state);
            this.toastManager = new ToastManager();
            this.storageManager = new StorageManager(); // Instantiate the new manager
            
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

            // Initialize ModuleLoader first, as it's needed for discovery.
            this.moduleLoader = new ModuleLoader(this.stateManager, this.availableModules, this.storageManager, {
                onModuleLoaded: () => {
                    this.quizManager.setMindMapData(this.state.mindMapData);
                    this.renderMindMap();
                    // After rendering, generate breadcrumbs for the root of the new module.
                    this.searchHandler.callbacks.onGenerateBreadcrumbs('root', this.state.mindMapData.path);
                    this.uiManager.updateOnModuleLoad();
                    this.setActiveNode('root');
                },
                onModuleCreated: (newModule) => {
                    // This callback now receives the metadata for the new local module
                    const userModulesString = localStorage.getItem('mindmap-user-modules') || '[]';
                    const userModules = JSON.parse(userModulesString);
                    userModules.push(newModule);
                    localStorage.setItem('mindmap-user-modules', JSON.stringify(userModules));

                    // Add the newly created module to the application's master list
                    this.availableModules.push(newModule);
                    // Repopulate the UI list to show the new module
                    this.uiManager.populateModuleLoader(this.availableModules);
                    this.toastManager.show(`Module '${newModule.name}' created and added to list.`, 'success');
                },
                onModulesLinked: (linkedModules) => {
                    // 1. Save the manifest of the *new* linked modules.
                    const newModuleManifest = linkedModules.map(m => ({ name: m.name, path: m.path, isTopLevel: m.isTopLevel, isLocal: m.isLocal })); // isRemote is now implicitly handled by isLocal
                    localStorage.setItem('mindmap-user-modules', JSON.stringify(newModuleManifest));
                    
                    // 2. Rebuild the availableModules list from scratch to prevent duplicates.
                    // Use a Map to handle deduplication based on the module path.
                    const moduleMap = new Map();
                    // Start with base modules, then add the new manifest.
                    this.baseModules.forEach(m => moduleMap.set(m.path, m));
                    newModuleManifest.forEach(m => moduleMap.set(m.path, m)); // These are now all isLocal
                    
                    this.availableModules = Array.from(moduleMap.values());
                    
                    // CRITICAL FIX: Update the ModuleLoader's reference to the new array.
                    this.moduleLoader.availableModules = this.availableModules;

                    // 3. Repopulate the UI with the fresh list.
                    // At this point, no content is loaded, just the manifest.
                    this.uiManager.populateModuleLoader(this.availableModules);
                    this.toastManager.show(`Successfully linked manifest with ${linkedModules.length} modules.`, 'success');
                },
                onSaveSuccess: (message) => {
                    this.toastManager.show(message, 'success');
                },
                onMenuClose: () => this.uiManager.closeMenu(),
            });

            // --- DYNAMIC MODULE DISCOVERY ---
            try {
                const cachedModules = localStorage.getItem('mindmap-discovered-modules');
                // We no longer load base modules by default. The user must link them.
                this.baseModules = []; // Initialize as empty.
                
                // Load any modules the user has previously linked.
                const userModulesString = localStorage.getItem('mindmap-user-modules');
                if (userModulesString) {
                    this.availableModules.push(...JSON.parse(userModulesString));
                }
            } catch (error) {
                console.error("Fatal Error: Could not initialize application modules.", error);
                document.body.innerHTML = `<h1>Error</h1><p>Could not load and discover application modules. Please check the console for details and consider resetting the application.</p>`;
                return;
            }

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
                onGoToNode: (nodeId, targetPan, targetZoom) => {
                    this.renderer.animateToView(targetPan, targetZoom);
                    this.selectNode(nodeId);
                    this.uiManager.closeMenu();
                },
                getContainerWidth: () => this.mindmapContainer.clientWidth,
                getContainerHeight: () => this.mindmapContainer.clientHeight,
                onGenerateBreadcrumbs: async (nodeId, modulePath) => {
                    try {
                        const breadcrumbs = await this.breadcrumbManager.generateBreadcrumbs(nodeId, modulePath);
                        this.uiManager.renderBreadcrumbs(breadcrumbs);
                    } catch (error) {
                        console.error("Failed to generate breadcrumbs:", error);
                    }
                },
            });

            // Initialize BreadcrumbManager after module discovery so it has the full list of paths.
            this.breadcrumbManager = new BreadcrumbManager(this.availableModules.map(m => m.path), this.moduleLoader);

            this.uiManager = new UIManager(this.state, {
                onModuleSelect: (path) => {
                    this.moduleLoader.loadModuleAndResetStack(path);
                },
                onBreadcrumbClick: (index, modulePath) => {
                    this.logDiagnostics('Breadcrumb Click', 'root');
                    // The index from the UI represents the desired position in the stack.
                    // We navigate back by slicing the stack and then loading the target module.
                    this.moduleLoader.navigateToStackIndex(index, modulePath);
                },
                onSearch: (term) => this.searchHandler.performSearch(term),
                onSearchResultClick: (nodeId, modulePath) => {
                    // Find the path of the currently loaded module from the available modules list for a reliable comparison.
                    const currentModuleInfo = this.availableModules.find(m => m.name === this.state.mindMapData.name);
                    const currentModulePath = currentModuleInfo ? currentModuleInfo.path : null;

                    if (currentModulePath === modulePath) {
                        // Result is in the current module, just go to it.
                        this.searchHandler.goToNode(nodeId, true);
                    } else {
                        // Result is in a different module, load it and then go to the node.
                        // Use a callback to ensure goToNode is called *after* the module is loaded.
                        this.moduleLoader.loadModuleAndResetStack(modulePath, () => this.searchHandler.goToNode(nodeId, true));
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
                onAutoOrganize: () => this.autoOrganize(),
                onCreateModule: (moduleName, fileName) => {
                    // This is the new callback from UIManager
                    this.moduleLoader.createNewModule(moduleName, fileName);
                },
                onLinkFromUrl: (baseUrl) => {
                    // New callback to discover and add remote modules from a URL manifest
                    this.moduleLoader.linkModulesFromUrl(baseUrl);
                },
                onLinkFromDirectory: () => {
                    // We now use the more generic onModulesLinked callback for this.
                    this.moduleLoader.linkModulesFromDirectory(); // This will eventually call onModulesLinked.
                }
            });
            this.uiManager.callbacks.onStopAutoOrganize = (event) => this.stopAutoOrganize(event);
            this.renderer.callbacks = { onLayoutEnd: () => {
                // This callback is for when the animation finishes on its own (cools down).
                this._finalizeLayout();
            }};

            this.uiManager.populateModuleLoader(this.availableModules);
        }
        renderMindMap() {
            if (!this.state.mindMapData) return;

            // Check if positions exist before rendering.
            const hadPositions = this.state.mindMapData.positions && Object.keys(this.state.mindMapData.positions).length > 0;

            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mindmap-font-size')) || 24;

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
            // --- DIAGNOSTIC LOGGING ---
            this.logDiagnostics('Node Click', nodeId);

            const node = this.state.mindMapData.nodes[nodeId];
            if (node.subModule) {
                // This is a sub-module navigation.
                // CRITICAL FIX: Save the current module's state (with its new positions) before navigating away.
                this.stateManager.saveModuleToStorage();
                
                // When navigating forward, the current module becomes part of the history.
                // The stack should represent the path taken, so we ensure the current module is the last thing on it
                // before adding the new one. The ModuleLoader will handle adding the new module to the stack upon load.
                // The key is to NOT reset the stack here.
                // The existing `loadModule` logic correctly adds the current module to the stack.
                
                this.moduleLoader.loadModule(node.subModule); // Then load the new one, indicating forward navigation.
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
