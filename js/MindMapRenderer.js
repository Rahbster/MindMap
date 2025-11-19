export class MindMapRenderer {
    constructor(container) {
        this.container = container;
        this.svg = null;
        this.viewportG = null;
    }

    render(mindMapData, positions, baseFontSize, nodeMouseDownCallback) {
        const nodeRadius = baseFontSize * 2.5;
        const nodeSpacing = baseFontSize * 9;
        const textLineHeight = baseFontSize * 0.9;

        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.cursor = 'grab';
        this.container.innerHTML = '';
        this.container.appendChild(this.svg);

        this.viewportG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svg.appendChild(this.viewportG);

        const rootNode = mindMapData.nodes.root;
        if (!rootNode) return;

        // Layout Algorithm
        this.calculateLayout(mindMapData, positions, nodeSpacing);

        // Draw elements
        this.drawLines(mindMapData, positions);
        this.drawNodes(mindMapData, positions, nodeRadius, textLineHeight, nodeMouseDownCallback);

        // Return calculated pan and zoom for fitting
        return this.calculateZoomToFit(positions, nodeRadius);
    }

    calculateLayout(mindMapData, positions, nodeSpacing) {
        const rootNode = mindMapData.nodes.root;
        const nodeModifiers = {};

        const firstPass = (nodeId) => {
            const node = mindMapData.nodes[nodeId];
            const children = node.children || [];
            nodeModifiers[nodeId] = { x: 0, mod: 0 };
            if (children.length === 0) return;
            children.forEach(childId => firstPass(childId));

            let totalChildWidth = 0;
            children.forEach(childId => totalChildWidth += nodeModifiers[childId].x);

            let x = -totalChildWidth / 2;
            children.forEach(childId => {
                nodeModifiers[childId].x += x;
                x += nodeModifiers[childId].x + nodeSpacing;
            });
        };

        const secondPass = (nodeId, level, xOffset) => {
            const node = mindMapData.nodes[nodeId];
            const children = node.children || [];
            const x = (nodeModifiers[nodeId]?.x || 0) + xOffset;
            const y = level * nodeSpacing;
            if (!positions[nodeId]) {
                positions[nodeId] = { x, y };
            }
            children.forEach(childId => secondPass(childId, level + 1, x));
        };

        firstPass(rootNode.id);
        secondPass(rootNode.id, 1, 0);
    }

    drawLines(mindMapData, positions) {
        Object.values(mindMapData.nodes).forEach(node => {
            if (positions[node.id]) {
                const parent = Object.values(mindMapData.nodes).find(p => p.children?.includes(node.id));
                if (parent && positions[parent.id]) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', positions[parent.id].x);
                    line.setAttribute('y1', positions[parent.id].y);
                    line.setAttribute('x2', positions[node.id].x);
                    line.setAttribute('y2', positions[node.id].y);
                    line.classList.add('link-line');
                    line.dataset.childId = node.id;
                    this.viewportG.appendChild(line);
                }
            }
        });
    }

    drawNodes(mindMapData, positions, nodeRadius, textLineHeight, nodeMouseDownCallback) {
        Object.values(mindMapData.nodes).forEach(node => {
            if (positions[node.id]) {
                const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                group.setAttribute('transform', `translate(${positions[node.id].x}, ${positions[node.id].y})`);
                group.dataset.nodeId = node.id;
                group.classList.add('node-group');

                if (node.subModule) group.classList.add('has-submodule');
                if (node.id !== 'root') group.classList.add('is-child-node');

                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('r', nodeRadius);
                circle.classList.add('node-circle');

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.classList.add('node-text');
                const words = node.title.split(' ');
                const initialY = -((words.length - 1) * textLineHeight) / 2;
                words.forEach((word, index) => {
                    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    tspan.textContent = word;
                    tspan.setAttribute('x', 0);
                    tspan.setAttribute('dy', index === 0 ? `${initialY}px` : `${textLineHeight}px`);
                    text.appendChild(tspan);
                });

                group.append(circle, text);
                group.addEventListener('mousedown', (e) => nodeMouseDownCallback(e, node.id));
                this.viewportG.appendChild(group);
            }
        });
    }

    calculateZoomToFit(positions, nodeRadius) {
        const padding = nodeRadius;
        const allX = Object.values(positions).map(p => p.x);
        const allY = Object.values(positions).map(p => p.y);
        const minX = Math.min(...allX) - padding;
        const maxX = Math.max(...allX) + padding;
        const minY = Math.min(...allY) - padding;
        const maxY = Math.max(...allY) + padding;

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;
        const containerWidth = this.container.clientWidth;
        const containerHeight = this.container.clientHeight;

        const scaleX = contentWidth > 0 ? containerWidth / contentWidth : 1;
        const scaleY = contentHeight > 0 ? containerHeight / contentHeight : 1;
        const zoom = Math.min(scaleX, scaleY) * 0.9;
        const pan = {
            x: (containerWidth / 2) - ((minX + maxX) / 2) * zoom,
            y: (containerHeight / 2) - ((minY + maxY) / 2) * zoom
        };
        return { pan, zoom };
    }

    applyTransform(pan, zoom) {
        if (this.viewportG) {
            this.viewportG.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);
        }
    }

    updateConnectingLines(nodeId, position) {
        const lineToParent = this.container.querySelector(`line[data-child-id="${nodeId}"]`);
        if (lineToParent) {
            lineToParent.setAttribute('x2', position.x);
            lineToParent.setAttribute('y2', position.y);
        }

        const node = this.state.mindMapData.nodes[nodeId];
        (node.children || []).forEach(childId => {
            const lineToChild = this.container.querySelector(`line[data-child-id="${childId}"]`);
            if (lineToChild) {
                lineToChild.setAttribute('x1', position.x);
                lineToChild.setAttribute('y1', position.y);
            }
        });
    }
}