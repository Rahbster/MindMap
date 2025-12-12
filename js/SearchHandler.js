export class SearchHandler {
    constructor(stateManager, availableModules, callbacks) {
        this.state = stateManager.getState();
        this.availableModules = availableModules;
        this.callbacks = callbacks;
    }

    async performSearch(term) {
        if (!term || term.length < 2) {
            this.callbacks.onSearchResults([]);
            return;
        }
        const searchTerm = term.toLowerCase();
        const allResults = [];

        // This search is now more robust. It will use cached data if available,
        // but will fetch module data on-the-fly if it's not in the cache.
        const searchPromises = this.availableModules.map(async (moduleInfo) => {
            try {
                const moduleData = await this.callbacks.getModuleData(moduleInfo.path);
                if (!moduleData) return;

                Object.values(moduleData.nodes).forEach(node => {
                    const title = node.title.toLowerCase();
                    const content = (node.content || '').replace(/<[^>]*>/g, ' ').toLowerCase();
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
                        let snippet = sourceText.substring(snippetStart, snippetEnd).trim();
                        if (snippetStart > 0) snippet = '...' + snippet;
                        if (snippetEnd < sourceText.length) snippet = snippet + '...';
                        allResults.push({ nodeId: node.id, title: node.title, snippet: snippet, moduleName: moduleData.name, modulePath: moduleInfo.path });
                    }
                });
            } catch (error) {
                console.warn(`Could not load module ${moduleInfo.path} for search:`, error);
            }
        });

        await Promise.all(searchPromises);
        this.callbacks.onSearchResults(allResults);
    }

    /**
     * Navigates the view to a specific node and optionally updates the breadcrumb trail.
     * @param {string} nodeId The ID of the node to navigate to.
     * @param {boolean} [updateBreadcrumbs=false] Whether to generate and update the full breadcrumb trail.
     */
    goToNode(nodeId, updateBreadcrumbs = false) {
        const nodePosition = this.state.mindMapData?.positions?.[nodeId];
        if (!nodePosition) return;

        this.state.mindMapData.zoom = 1;
        this.state.mindMapData.pan.x = (this.callbacks.getContainerWidth() / 2) - (nodePosition.x * this.state.mindMapData.zoom);
        this.state.mindMapData.pan.y = (this.callbacks.getContainerHeight() / 2) - (nodePosition.y * this.state.mindMapData.zoom);

        if (updateBreadcrumbs) {
            this.callbacks.onGenerateBreadcrumbs(nodeId, this.state.mindMapData.path);
        }

        this.callbacks.onGoToNode(nodeId, this.state.mindMapData.pan, this.state.mindMapData.zoom);
    }
}