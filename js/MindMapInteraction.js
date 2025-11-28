export class MindMapInteraction {
    constructor(container, app, callbacks) {
        this.container = container;
        this.app = app;
        this.callbacks = callbacks;

        this.isPanning = false;
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.startPanPoint = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.initialPinchDistance = null;

        this.initListeners();
    }

    get state() {
        return this.app.getState();
    }

    initListeners() {
        this.container.addEventListener('mousedown', this.handlePanStart.bind(this));
        this.container.addEventListener('mousemove', this.handlePanMove.bind(this));
        this.container.addEventListener('mouseup', this.handlePanEnd.bind(this));
        this.container.addEventListener('mouseleave', this.handlePanEnd.bind(this));
        this.container.addEventListener('wheel', this.handleZoom.bind(this));

        // Add touch event listeners for mobile/tablet support
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    handleNodeMouseDown(event, nodeId) {
        event.stopPropagation();

        this.isDraggingNode = true;
        this.draggedNodeId = nodeId;
        // CRITICAL FIX: Always use the main container's SVG for consistent coordinate transformations,
        // not the event.target, which can be a child element with a different CTM.
        const CTM = this.container.querySelector('svg').getScreenCTM();
        const mouseX = (event.clientX - CTM.e) / CTM.a;
        const mouseY = (event.clientY - CTM.f) / CTM.d;

        // Robustness: If positions haven't been populated yet (e.g., during a fast module load), default to 0 to prevent NaN.
        const nodePosition = this.state.mindMapData.positions[nodeId];
        this.dragOffset.x = (nodePosition?.x || 0) - mouseX;
        this.dragOffset.y = (nodePosition?.y || 0) - mouseY;

        this.startPanPoint = { x: event.clientX, y: event.clientY };
    }

    handlePanStart(event) {
        if (event.target.closest('.node-group')) return;
        this.isPanning = true;
        this.startPanPoint = { x: event.clientX, y: event.clientY };
        this.container.style.cursor = 'grabbing';
    }

    handlePanMove(event) {
        if (this.isDraggingNode && this.draggedNodeId) {
            // CRITICAL FIX: Always use the main container's SVG for consistent coordinate transformations,
            // not event.target, which can be inconsistent between mouse and mocked touch events.
            const CTM = this.container.querySelector('svg').getScreenCTM();
            const mouseX = (event.clientX - CTM.e) / CTM.a;
            const mouseY = (event.clientY - CTM.f) / CTM.d;

            const newPosition = {
                x: mouseX + this.dragOffset.x,
                y: mouseY + this.dragOffset.y
            };

            this.callbacks.onNodeDrag(this.draggedNodeId, newPosition);
        } else if (this.isPanning) {
            const dx = event.clientX - this.startPanPoint.x;
            const dy = event.clientY - this.startPanPoint.y;
            this.state.mindMapData.pan.x += dx;
            this.state.mindMapData.pan.y += dy;
            this.startPanPoint = { x: event.clientX, y: event.clientY };
        }

        this.callbacks.onPanZoom(this.state.mindMapData.pan, this.state.mindMapData.zoom);
    }

    handlePanEnd(event) {
        if (this.isDraggingNode) {
            const dx = Math.abs(this.startPanPoint.x - event.clientX);
            const dy = Math.abs(this.startPanPoint.y - event.clientY);
            if (dx < 5 && dy < 5) {
                this.callbacks.onNodeSelect(this.draggedNodeId);
            } else {
                this.callbacks.onDragEnd();
            }
        } else if (this.isPanning) {
            // If we were panning the background, save the final state.
            this.callbacks.onDragEnd();
        }
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.isPanning = false;
        this.container.style.cursor = 'grab';
    }

    handleZoom(event) {
        event.preventDefault();
        const zoomFactor = 1.1;
        const { clientX, clientY } = event;
        const svgRect = this.container.getBoundingClientRect();

        const pointBeforeZoom = {
            x: (clientX - svgRect.left - this.state.mindMapData.pan.x) / this.state.mindMapData.zoom,
            y: (clientY - svgRect.top - this.state.mindMapData.pan.y) / this.state.mindMapData.zoom
        };

        if (event.deltaY < 0) {
            this.state.mindMapData.zoom *= zoomFactor;
        } else {
            this.state.mindMapData.zoom /= zoomFactor;
        }

        this.state.mindMapData.pan.x = (clientX - svgRect.left) - pointBeforeZoom.x * this.state.mindMapData.zoom;
        this.state.mindMapData.pan.y = (clientY - svgRect.top) - pointBeforeZoom.y * this.state.mindMapData.zoom;

        this.callbacks.onPanZoom(this.state.mindMapData.pan, this.state.mindMapData.zoom);
    }

    // --- Touch Event Handlers ---

    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            // Single touch could be a drag or a pan
            const touch = e.touches[0];
            const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);

            if (targetElement && targetElement.closest('.node-group')) {
                // For touch, we need to manually set the target on the event object
                // so that handleNodeMouseDown can find the SVG element and call stopPropagation.
                const eventWithTarget = {
                    target: targetElement,
                    // Manually copy properties as {...touch} doesn't work on Touch objects
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault()
                };
                this.handleNodeMouseDown(eventWithTarget, targetElement.closest('.node-group').dataset.nodeId);
            } else {
                // This was missing. It's needed to start a pan.
                this.handlePanStart(touch);
            }
        } else if (e.touches.length === 2) {
            // Two touches for pinch-to-zoom
            this.isPanning = false; // Stop panning if it was active
            this.isDraggingNode = false; // Stop dragging if it was active
            this.initialPinchDistance = this.getPinchDistance(e);
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && (this.isDraggingNode || this.isPanning)) {
            // Create a mock event with a target for handlePanMove, which is used for both dragging and panning.
            const touch = e.touches[0];
            const eventWithTarget = {
                target: document.elementFromPoint(touch.clientX, touch.clientY),
                // Manually copy properties as {...touch} doesn't work on Touch objects
                clientX: touch.clientX,
                clientY: touch.clientY
            };
            this.handlePanMove(eventWithTarget);
        } else if (e.touches.length === 1 && this.isPanning) {
            const touch = e.touches[0];
            const dx = touch.clientX - this.startPanPoint.x;
            const dy = touch.clientY - this.startPanPoint.y;
            this.state.mindMapData.pan.x += dx;
            this.state.mindMapData.pan.y += dy;
            this.startPanPoint = { x: touch.clientX, y: touch.clientY };
            this.callbacks.onPanZoom(this.state.mindMapData.pan, this.state.mindMapData.zoom);
        } else if (e.touches.length === 2 && this.initialPinchDistance) {
            const newPinchDistance = this.getPinchDistance(e);
            const zoomFactor = newPinchDistance / this.initialPinchDistance;

            const oldZoom = this.state.mindMapData.zoom;
            this.state.mindMapData.zoom = Math.max(0.1, Math.min(5, oldZoom * zoomFactor));

            // Zoom towards the center of the pinch
            const CTM = this.container.querySelector('svg').getScreenCTM();
            const pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            const svgRect = this.container.getBoundingClientRect();
            const pointBeforeZoom = {
                x: (pinchCenterX - svgRect.left - this.state.mindMapData.pan.x) / oldZoom,
                y: (pinchCenterY - svgRect.top - this.state.mindMapData.pan.y) / oldZoom
            };

            this.state.mindMapData.pan.x = (pinchCenterX - svgRect.left) - pointBeforeZoom.x * this.state.mindMapData.zoom;
            this.state.mindMapData.pan.y = (pinchCenterY - svgRect.top) - pointBeforeZoom.y * this.state.mindMapData.zoom;

            this.callbacks.onPanZoom(this.state.mindMapData.pan, this.state.mindMapData.zoom);
            this.initialPinchDistance = newPinchDistance; // Update for continuous zoom
        }
    }

    handleTouchEnd(e) {
        if (this.isDraggingNode) {
            const dx = Math.abs(this.startPanPoint.x - e.changedTouches[0].clientX);
            const dy = Math.abs(this.startPanPoint.y - e.changedTouches[0].clientY);
            if (dx < 5 && dy < 5) {
                this.callbacks.onNodeSelect(this.draggedNodeId);
            } else {
                this.callbacks.onDragEnd();
            }
        }

        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.isPanning = false;
        this.container.style.cursor = 'grab';

        // Reset pinch zoom state
        if (e.touches.length < 2) {
            this.initialPinchDistance = null;
        }
    }

    getPinchDistance(e) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    handleZoom(event) {
        event.preventDefault();
        const zoomFactor = 1.1;
        const { clientX, clientY } = event;
        const svgRect = this.container.getBoundingClientRect();

        const pointBeforeZoom = {
            x: (clientX - svgRect.left - this.state.mindMapData.pan.x) / this.state.mindMapData.zoom,
            y: (clientY - svgRect.top - this.state.mindMapData.pan.y) / this.state.mindMapData.zoom
        };

        if (event.deltaY < 0) {
            this.state.mindMapData.zoom *= zoomFactor;
        } else {
            this.state.mindMapData.zoom /= zoomFactor;
        }

        this.state.mindMapData.pan.x = (clientX - svgRect.left) - pointBeforeZoom.x * this.state.mindMapData.zoom;
        this.state.mindMapData.pan.y = (clientY - svgRect.top) - pointBeforeZoom.y * this.state.mindMapData.zoom;

        this.callbacks.onPanZoom(this.state.mindMapData.pan, this.state.mindMapData.zoom);
    }
}