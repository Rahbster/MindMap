export class MindMapRenderer {
    constructor(container, state) {
        this.container = container;
        this.layoutAnimationId = null;
        this.state = state;
        this.svg = null;
        this.starLayers = [];
        this.viewportG = null;

        // --- CONFIGURABLE GRID PARAMETERS ---
        this.GRID_SIZE = 50; // The distance between grid lines.
        this.GRID_STRENGTH = 0.02; // How strongly nodes are pulled to the grid. Keep this value low.

        this._injectStyles();
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

        // CRITICAL FIX: Initialize the text measurement helper element.
        this._textMeasureEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        this._textMeasureEl.setAttribute('style', 'position:absolute; visibility:hidden; pointer-events:none;');
        this.svg.appendChild(this._textMeasureEl);

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
        this.drawNodes(mindMapData, positions, nodeRadius, baseFontSize, nodeMouseDownCallback);

        // No longer needs to return pan/zoom as they are part of the mindMapData object.
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
            // Always reset the temperature to its initial high value to re-energize the system.
            this.temperature = 100.0;
            return;
        }

        // Store the current pan/zoom to be animated during the layout.
        this.currentPan = { ...this.state.mindMapData.pan };
        this.currentZoom = this.state.mindMapData.zoom;

        const nodes = Object.values(this.state.mindMapData.nodes);
        const positions = this.state.mindMapData.positions; // Use the module's positions object
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

                    // --- Improved Straightening Logic ---
                    // Instead of applying a force, we dampen velocity that moves the node off-axis.
                    // This is more effective at "snapping" nodes into a grid without fighting other forces.
                    const DAMPING_FACTOR = 0.5; // How strongly to dampen off-axis velocity.
                    const angle = Math.atan2(dy, dx); // Angle in radians
                    const snapThreshold = 0.2; // Radians (about 11 degrees)

                    // If close to horizontal, dampen vertical velocity.
                    if (Math.abs(angle) < snapThreshold || Math.abs(Math.abs(angle) - Math.PI) < snapThreshold) {
                        node._ui.vy *= DAMPING_FACTOR;
                    }
                    // If close to vertical, dampen horizontal velocity.
                    if (Math.abs(Math.abs(angle) - Math.PI / 2) < snapThreshold) {
                        node._ui.vx *= DAMPING_FACTOR;
                    }

                    targetNode._ui.fx -= fx;
                    targetNode._ui.fy -= fy;
                });
            }
            
            // --- Global Alignment Force (User Suggestion) ---
            // This force encourages any two nodes that are close on an axis to snap to the same line.
            const K_ALIGN = 0.05; // Increased strength of the alignment pull.
            const SNAP_DISTANCE = 30; // Increased range for the force to activate.

            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    const posA = positions[nodeA.id];
                    const posB = positions[nodeB.id];

                    // Check for vertical alignment (close X values)
                    if (Math.abs(posA.x - posB.x) < SNAP_DISTANCE) {
                        const avgX = (posA.x + posB.x) / 2;
                        nodeA._ui.fx += (avgX - posA.x) * K_ALIGN;
                        nodeB._ui.fx += (avgX - posB.x) * K_ALIGN;
                    }

                    // Check for horizontal alignment (close Y values)
                    if (Math.abs(posA.y - posB.y) < SNAP_DISTANCE) {
                        const avgY = (posA.y + posB.y) / 2;
                        nodeA._ui.fy += (avgY - posA.y) * K_ALIGN;
                        nodeB._ui.fy += (avgY - posB.y) * K_ALIGN;
                    }
                }
            }

            // --- Grid Attraction Force ---
            // Gently pulls each node towards the nearest point on a hidden grid.
            for (const node of nodes) {
                // We can exclude the root node to let it center more freely if desired.
                if (node.id === 'root') continue;

                const pos = positions[node.id];
                const nearestGridX = Math.round(pos.x / this.GRID_SIZE) * this.GRID_SIZE;
                const nearestGridY = Math.round(pos.y / this.GRID_SIZE) * this.GRID_SIZE;
                node._ui.fx += (nearestGridX - pos.x) * this.GRID_STRENGTH;
                node._ui.fy += (nearestGridY - pos.y) * this.GRID_STRENGTH;
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

            // --- DYNAMIC ZOOM-TO-FIT (User Suggestion) ---
            // In each frame, calculate the ideal pan/zoom and smoothly move the camera towards it.
            const baseFontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mindmap-font-size')) || 24;
            const nodeRadius = baseFontSize * 2.5;
            const { pan: targetPan, zoom: targetZoom } = this.calculateZoomToFit(positions, nodeRadius);

            // Smoothly interpolate the current pan and zoom towards the target.
            const LERP_FACTOR = 0.08; // Controls the smoothness of the camera motion.
            this.currentPan.x += (targetPan.x - this.currentPan.x) * LERP_FACTOR;
            this.currentPan.y += (targetPan.y - this.currentPan.y) * LERP_FACTOR;
            this.currentZoom += (targetZoom - this.currentZoom) * LERP_FACTOR;

            // Apply the interpolated transform to the view.
            this.applyTransform(this.currentPan, this.currentZoom);

            this.temperature *= COOLING_RATE;

            if (this.temperature > 0.1) {
                this.layoutAnimationId = requestAnimationFrame(step);
            } else {
                // --- CRITICAL FIX: Round final positions to integers ---
                // This cleans up the data without any noticeable visual impact.
                for (const nodeId in positions) {
                    positions[nodeId].x = Math.round(positions[nodeId].x);
                    positions[nodeId].y = Math.round(positions[nodeId].y);
                }

                // On completion, update the main state with the final pan and zoom.
                this.state.mindMapData.pan = this.currentPan;
                this.state.mindMapData.zoom = this.currentZoom;

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

    drawNodes(mindMapData, positions, nodeRadius, baseFontSize, nodeMouseDownCallback) {
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
                text.textContent = node.title; // Set initial text for wrapping

                group.append(circle, text);
                group.addEventListener('mousedown', (e) => nodeMouseDownCallback(e, node.id));
                this.viewportG.appendChild(group);

                // Apply text wrapping after the element is in the DOM
                this.fitTextInCircle(text, nodeRadius, baseFontSize);
            }
        });
    }

    /**
     * Wraps SVG text to a given width.
     * @param {SVGTextElement} textElement - The SVG text element to wrap.
     * @param {number} radius - The radius of the containing circle.
     * @param {number} baseFontSize - The ideal font size to start with.
     */
    fitTextInCircle(textElement, radius, baseFontSize) {
        const text = (textElement.textContent || "").trim();
        if (!text) return;

        const INSET = radius * 0.1; // 10% inset from the edge
        const LINE_CUT = 3; // Affects when a new line is created.
        const MAX_SCALE = 1.2; // Allow font to be slightly larger than base if it fits
        const FONT_HEIGHT_RATIO = 1.0; // Ratio for line height based on font size.

        // --- 1. Pre-measure words at the base font size ---
        textElement.style.fontSize = `${baseFontSize}px`;
        const spaceWidth = this.measureText(' ', baseFontSize);
        const words = text.split(" ").map((wordText, i, arr) => ({
            text: wordText,
            width: this.measureText(wordText, baseFontSize),
            space: i < arr.length - 1 ? spaceWidth : 0
        }));
        const totalWidth = words.reduce((acc, w) => acc + w.width + w.space, 0) - words[words.length - 1].space;

        // --- 2. Determine line breaks and calculate bounding radius ---
        const lines = [];

        if (words.length > 0) {
            let currentLine = { from: 0, to: 1 };
            for (let i = 1; i < words.length; i++) {
                // Check width of the current line if we add the next word
                const testLineWords = words.slice(currentLine.from, i + 1);
                const testLineWidth = testLineWords.reduce((acc, w) => acc + w.width + w.space, 0) - testLineWords[testLineWords.length - 1].space;

                // If the line is too long, finalize the previous line and start a new one
                const breakThreshold = radius * 2.2;
                
                // --- New, more aggressive breaking logic ---
                // Condition 1: The line is absolutely too long.
                const isTooLong = testLineWidth > breakThreshold;
                // Condition 2: The line is getting full. This encourages wrapping for better balance.
                const isGoodToBreak = testLineWidth > breakThreshold * 0.55; // Use a 55% threshold as a good general-purpose starting point.
                // Exception: Don't do a "good break" if the line is still short. This prevents "with AI" from breaking unnecessarily.
                const isShort = testLineWidth < breakThreshold * 0.65;

                // Break if the line is too long, OR if it's a good break point AND not a short line.
                if (isTooLong || (isGoodToBreak && !isShort)) {
                    lines.push({ from: currentLine.from, to: i });
                    currentLine = { from: i, to: i + 1 };
                } else {
                    currentLine.to = i + 1;
                }
            }
            lines.push(currentLine); // Add the last line

            let boundRadius = 0;
            const lineMetrics = lines.map((line, i) => {
                const lineWidth = line.to > line.from ? words.slice(line.from, line.to).reduce((acc, w) => acc + w.width + w.space, 0) - words[line.to - 1].space : 0;
                const lineHeight = (-(lines.length - 1) * 0.5 + i) * baseFontSize * FONT_HEIGHT_RATIO;
                const lineTop = lineHeight - (baseFontSize * FONT_HEIGHT_RATIO * 0.5);
                const lineBottom = lineHeight + (baseFontSize * FONT_HEIGHT_RATIO * 0.5);
                boundRadius = Math.max(boundRadius, Math.hypot(lineWidth * 0.5, lineTop), Math.hypot(lineWidth * 0.5, lineBottom));
                return { width: lineWidth, y: lineHeight };
            });

            var scale = (radius - INSET) / boundRadius;
            lines.forEach((line, i) => {
                line.x = -lineMetrics[i].width * 0.5;
                line.y = lineMetrics[i].y;
            });

        } else { // Single line
            // This case is handled by the loop above, so this block is no longer needed.
            var scale = Math.min(MAX_SCALE, ((radius - INSET) * 2) / totalWidth);
        }

        const finalFontSize = baseFontSize * scale;
        // --- 3. Render the final text with calculated scale and layout ---
        const finalLineHeight = finalFontSize * FONT_HEIGHT_RATIO;
        textElement.textContent = null; // Clear original text
        textElement.style.fontSize = `${finalFontSize}px`;

        lines.forEach((line, i) => {
            const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
            tspan.setAttribute('x', 0);
            // The 'y' attribute on the text element handles vertical centering, so dy is just for line breaks.
            tspan.setAttribute('dy', i === 0 ? 0 : `${finalLineHeight}px`);
            tspan.textContent = words.slice(line.from, line.to).map(w => w.text).join(' ');
            textElement.appendChild(tspan);
        });

        // Final vertical centering of the entire text block
        const totalTextHeight = (lines.length) * finalLineHeight;
        // To center the block, we shift it up by half its total height,
        // then shift it down by half the height of a single line to account for the baseline.
        textElement.setAttribute('y', `-${(totalTextHeight / 2) - (finalLineHeight / 2)}`);
    }

    // Helper to measure text width without relying on an existing element in the main SVG.
    measureText(text, fontSize) {
        // Self-healing: If the helper element doesn't exist or is detached from the current SVG, recreate it.
        if (!this._textMeasureEl || !this.svg.contains(this._textMeasureEl)) {
            this._textMeasureEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            this._textMeasureEl.setAttribute('style', 'position:absolute; visibility:hidden; pointer-events:none;');
            this.svg.appendChild(this._textMeasureEl);
        }
        this._textMeasureEl.style.fontSize = `${fontSize}px`;
        this._textMeasureEl.textContent = text;
        return this._textMeasureEl.getComputedTextLength();
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

    /**
     * Smoothly animates the viewport to a target pan and zoom.
     * @param {object} targetPan - The destination pan object {x, y}.
     * @param {number} targetZoom - The destination zoom level.
     */
    animateToView(targetPan, targetZoom) {
        const duration = 500; // Animation duration in ms
        const startPan = { ...this.state.mindMapData.pan };
        const startZoom = this.state.mindMapData.zoom;
        let startTime = null;

        const animationStep = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic function

            // Interpolate pan and zoom
            const currentPan = {
                x: startPan.x + (targetPan.x - startPan.x) * ease,
                y: startPan.y + (targetPan.y - startPan.y) * ease
            };
            const currentZoom = startZoom + (targetZoom - startZoom) * ease;

            this.state.mindMapData.pan = currentPan;
            this.state.mindMapData.zoom = currentZoom;
            this.applyTransform(currentPan, currentZoom);

            if (progress < 1) {
                requestAnimationFrame(animationStep);
            }
        };

        requestAnimationFrame(animationStep);
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

    /**
     * Returns the final state of the layout animation, including pan and zoom.
     * This is used when the animation is stopped manually.
     */
    getFinalLayoutState() {
        return {
            pan: this.currentPan,
            zoom: this.currentZoom
        };
    }

    /**
     * Injects the necessary CSS for styling mind map elements, like sub-module nodes.
     * This makes the component self-contained.
     * @private
     */
    _injectStyles() {
        const styleId = 'mindmap-renderer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            /* Style for nodes that link to a sub-module */
            .node-group.has-submodule .node-circle {
                fill: var(--submodule-node-bg, var(--node-bg-color-alt));
                stroke: var(--submodule-node-stroke, var(--accent-color));
                stroke-width: 3px;
                transition: stroke-width 0.2s ease-in-out;
            }

            /* Add a hover effect to make them more interactive */
            .node-group.has-submodule:hover .node-circle {
                stroke-width: 5px;
            }
        `;
        document.head.appendChild(style);
    }
}