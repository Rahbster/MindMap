export class MindMapRenderer {
    constructor(container, state) {
        this.container = container;
        this.layoutAnimationId = null;
        this.state = state;
        this.svg = null;
        this.temperature = 0;
        this.starLayers = [];
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

        // --- Starfield Background (inspired by TeamSudoku) ---
        const starGroups = [
            { id: 'star-layer-far', factor: 0.1, count: 150, minSize: 0.5, maxSize: 1.2 },
            { id: 'star-layer-mid', factor: 0.3, count: 80, minSize: 0.8, maxSize: 1.8 },
            { id: 'star-layer-near', factor: 0.6, count: 40, minSize: 1.2, maxSize: 2.5 }
        ];

        const createStars = (count, minSize, maxSize, group) => {
            const areaSize = 3000; // A large area for stars to exist in
            for (let i = 0; i < count; i++) {
                const star = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                star.setAttribute('class', 'mindmap-bg-star');
                star.setAttribute('cx', Math.random() * areaSize - areaSize / 2);
                star.setAttribute('cy', Math.random() * areaSize - areaSize / 2);
                star.setAttribute('r', (Math.random() * (maxSize - minSize) + minSize).toFixed(2));
                star.style.opacity = (Math.random() * 0.7 + 0.1).toFixed(2);
                group.appendChild(star);
            }
        };

        this.starLayers = starGroups.map(config => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.id = config.id;
            this.svg.appendChild(group);
            createStars(config.count, config.minSize, config.maxSize, group);
            return { group, factor: config.factor };
        });

        this.viewportG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.svg.appendChild(this.viewportG);

        const rootNode = mindMapData.nodes.root;
        if (!rootNode) return;

        // Determine if we need to run the layout animation.
        const needsLayout = Object.keys(positions).length === 0;

        if (needsLayout) {
            this.calculateInitialLayout(mindMapData, positions);
        }

        // Always draw the elements first.
        this.drawLines(mindMapData, positions);
        this.drawNodes(mindMapData, positions, nodeRadius, textLineHeight, nodeMouseDownCallback);

        // Always return the current pan/zoom. The layout is now only triggered manually.
        return { pan: this.state.pan, zoom: this.state.zoom };
    }

    calculateInitialLayout(mindMapData, positions) {
        const nodes = mindMapData.nodes;
        const rootId = 'root';
        const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mindmap-font-size'));
        const centerX = this.container.clientWidth / 2;
        const centerY = this.container.clientHeight / 2;

        const placeChildren = (parentId, parentX, parentY, level) => {
            const parentNode = nodes[parentId];
            if (!parentNode || !parentNode.children) return;

            const children = parentNode.children.filter(id => nodes[id]);
            const numChildren = children.length;
            if (numChildren === 0) return;

            const radius = 250 * Math.pow(level, 0.7); // Use a base radius that matches the physics simulation's IDEAL_LENGTH.
            const angleIncrement = (2 * Math.PI) / numChildren;

            children.forEach((childId, index) => {
                if (!positions[childId]) { // Avoid replacing already placed nodes
                    const angle = index * angleIncrement;
                    const childX = parentX + radius * Math.cos(angle);
                    const childY = parentY + radius * Math.sin(angle);
                    positions[childId] = { x: childX, y: childY };
                    placeChildren(childId, childX, childY, level + 1);
                }
            });
        };

        positions[rootId] = { x: centerX, y: centerY };
        placeChildren(rootId, centerX, centerY, 1);
    }

    runLayoutAnimation(start = true, initialPositions = null) {
        if (!start) {
            if (this.layoutAnimationId) cancelAnimationFrame(this.layoutAnimationId);
            this.layoutAnimationId = null;
            return;
        }

        // If an animation is already running, just boost the temperature.
        if (this.layoutAnimationId) {
            this.temperature = Math.min(200, this.temperature + 100); // Add energy, with a cap.
            console.log(`[Renderer] Auto-organize boosted. New temperature: ${this.temperature.toFixed(2)}`);
            return;
        }

        const nodes = Object.values(this.state.mindMapData.nodes);
        const positions = this.state.positions; // Use the main state positions object
        const { clientWidth: width, clientHeight: height } = this.container;

        // Initialize physics properties for all nodes.
        // If initialPositions are provided (from Auto-Organize), use them.
        // Otherwise, use the existing state positions or randomize.
        nodes.forEach(node => {
            if (initialPositions?.[node.id]) {
                positions[node.id] = { ...initialPositions[node.id] };
            } else if (!positions[node.id]) {
                // If a node has no position at all, give it a random starting point.
                positions[node.id] = { x: Math.random() * width, y: Math.random() * height };
            }
            node._ui = { vx: 0, vy: 0, fx: 0, fy: 0 }; // Physics properties
        });

        const K_REPEL = 180000; // Increased repulsion for better spacing
        const K_ATTRACT = 0.03;
        const IDEAL_LENGTH = 250; // Increased ideal spring length
        const GRAVITY = 0.05;
        this.temperature = 100.0;
        const COOLING_RATE = 0.99;

        const step = () => {
            // 1. Calculate Forces
            for (const node of nodes) {
                node._ui.fx = 0;
                node._ui.fy = 0;

                // Gravity towards center
                node._ui.fx += (width / 2 - positions[node.id].x) * GRAVITY;
                node._ui.fy += (height / 2 - positions[node.id].y) * GRAVITY;

                // Repulsion from other nodes
                for (const otherNode of nodes) {
                    if (node === otherNode) continue;
                    const dx = positions[node.id].x - positions[otherNode.id].x;
                    const dy = positions[node.id].y - positions[otherNode.id].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const repulsion = K_REPEL / (distance * distance);
                    node._ui.fx += (dx / distance) * repulsion;
                    node._ui.fy += (dy / distance) * repulsion;
                }

                // Attraction to connected nodes
                (node.children || []).forEach(childId => {
                    const targetNode = this.state.mindMapData.nodes[childId];
                    if (!targetNode || !positions[targetNode.id]) return;
                    const dx = positions[targetNode.id].x - positions[node.id].x;
                    const dy = positions[targetNode.id].y - positions[node.id].y;
                    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                    const attraction = K_ATTRACT * (distance - IDEAL_LENGTH);
                    const fx = (dx / distance) * attraction;
                    const fy = (dy / distance) * attraction;
                    node._ui.fx += fx;
                    node._ui.fy += fy;

                    // Add a tangential force to encourage circular arrangement
                    const tangentialForce = 0.5;
                    // The tangential vector is (-dy, dx)
                    const tx = -dy / distance;
                    const ty = dx / distance;
                    node._ui.fx += tx * tangentialForce;
                    node._ui.fy += ty * tangentialForce;

                    targetNode._ui.fx -= fx;
                    targetNode._ui.fy -= fy;
                });
            }

            // 2. Apply Forces and Update Positions
            for (const node of nodes) {
                node._ui.vx = (node._ui.vx + node._ui.fx * 0.01) * 0.9; // Damping
                node._ui.vy = (node._ui.vy + node._ui.fy * 0.01) * 0.9;

                const speed = Math.sqrt(node._ui.vx * node._ui.vx + node._ui.vy * node._ui.vy);

                if (speed > this.temperature) {
                    node._ui.vx = (node._ui.vx / speed) * this.temperature;
                    node._ui.vy = (node._ui.vy / speed) * this.temperature;
                }

                positions[node.id].x += node._ui.vx;
                positions[node.id].y += node._ui.vy;
                this.updateNodeAndLines(node.id, positions[node.id]);
            }

            this.temperature *= COOLING_RATE;

            if (this.temperature > 0.1) {
                this.layoutAnimationId = requestAnimationFrame(step);
            } else {
                console.log('--- Auto Organize Complete: Final Node Positions ---');
                console.log(JSON.stringify(positions, null, 2));
                console.log('----------------------------------------------------');
                this.state.mindMapData.positions = positions;
                this.callbacks.onLayoutEnd();
            }
        };
        step();
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

    updateNodeAndLines(nodeId, position) {
        const group = this.container.querySelector(`g[data-node-id="${nodeId}"]`);
        if (group) {
            group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
            this.updateConnectingLines(nodeId, position);
        }
    }

    applyTransform(pan, zoom) {
        if (this.viewportG) {
            this.viewportG.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);

            // Apply parallax effect to star layers
            this.starLayers.forEach(layer => {
                const transform = `translate(${pan.x * layer.factor}, ${pan.y * layer.factor})`;
                layer.group.setAttribute('transform', transform);
            });
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