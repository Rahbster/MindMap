export class SearchHandler {
    constructor(stateManager, callbacks) {
        this.state = stateManager.getState();
        this.callbacks = callbacks;
    }

    performSearch(term) {
        if (!term || term.length < 2) {
            this.callbacks.onSearchResults([]);
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
        this.callbacks.onSearchResults(results);
    }

    goToNode(nodeId) {
        const nodePosition = this.state.positions[nodeId];
        if (!nodePosition) return;

        this.state.zoom = 1;
        this.state.pan.x = (this.callbacks.getContainerWidth() / 2) - (nodePosition.x * this.state.zoom);
        this.state.pan.y = (this.callbacks.getContainerHeight() / 2) - (nodePosition.y * this.state.zoom);
        
        this.callbacks.onGoToNode(nodeId);
    }
}