export class MindMapInteraction {
    constructor(container, state, callbacks) {
        this.container = container;
        this.state = state;
        this.callbacks = callbacks;

        this.isPanning = false;
        this.isDraggingNode = false;
        this.draggedNodeId = null;
        this.startPanPoint = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.initialPinchDistance = null;

        this.initListeners();
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
        const CTM = event.target.closest('svg').getScreenCTM();
        const mouseX = (event.clientX - CTM.e) / CTM.a;
        const mouseY = (event.clientY - CTM.f) / CTM.d;
        this.dragOffset.x = this.state.positions[nodeId].x - mouseX;
        this.dragOffset.y = this.state.positions[nodeId].y - mouseY;
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
            const CTM = event.target.closest('svg').getScreenCTM();
            const mouseX = (event.clientX - CTM.e) / CTM.a;
            const mouseY = (event.clientY - CTM.f) / CTM.d;

            this.state.positions[this.draggedNodeId].x = mouseX + this.dragOffset.x;
            this.state.positions[this.draggedNodeId].y = mouseY + this.dragOffset.y;

            this.callbacks.onNodeDrag(this.draggedNodeId, this.state.positions[this.draggedNodeId]);
        } else if (this.isPanning) {
            const dx = event.clientX - this.startPanPoint.x;
            const dy = event.clientY - this.startPanPoint.y;
            this.state.pan.x += dx;
            this.state.pan.y += dy;
            this.startPanPoint = { x: event.clientX, y: event.clientY };
        }

        this.callbacks.onPanZoom();
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
            x: (clientX - svgRect.left - this.state.pan.x) / this.state.zoom,
            y: (clientY - svgRect.top - this.state.pan.y) / this.state.zoom
        };

        if (event.deltaY < 0) {
            this.state.zoom *= zoomFactor;
        } else {
            this.state.zoom /= zoomFactor;
        }

        this.state.pan.x = (clientX - svgRect.left) - pointBeforeZoom.x * this.state.zoom;
        this.state.pan.y = (clientY - svgRect.top) - pointBeforeZoom.y * this.state.zoom;

        this.callbacks.onPanZoom();
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
                    ...touch,
                    target: targetElement,
                    stopPropagation: () => e.stopPropagation(),
                    preventDefault: () => e.preventDefault()
                };
                this.handleNodeMouseDown(eventWithTarget, targetElement.closest('.node-group').dataset.nodeId);
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
        if (e.touches.length === 1 && this.isDraggingNode) {
            const touch = e.touches[0];
            const CTM = this.container.querySelector('svg').getScreenCTM();
            const newPos = {
                x: (touch.clientX - CTM.e) / this.state.zoom - this.dragOffset.x,
                y: (touch.clientY - CTM.f) / this.state.zoom - this.dragOffset.y
            };
            this.callbacks.onNodeDrag(this.draggedNodeId, newPos);
        } else if (e.touches.length === 1 && this.isPanning) {
            const touch = e.touches[0];
            const dx = touch.clientX - this.startPanPoint.x;
            const dy = touch.clientY - this.startPanPoint.y;
            this.state.pan.x += dx;
            this.state.pan.y += dy;
            this.startPanPoint = { x: touch.clientX, y: touch.clientY };
            this.callbacks.onPanZoom();
        } else if (e.touches.length === 2 && this.initialPinchDistance) {
            const newPinchDistance = this.getPinchDistance(e);
            const zoomFactor = newPinchDistance / this.initialPinchDistance;

            const oldZoom = this.state.zoom;
            this.state.zoom = Math.max(0.1, Math.min(5, oldZoom * zoomFactor));

            // Zoom towards the center of the pinch
            const CTM = this.container.querySelector('svg').getScreenCTM();
            const pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

            const svgRect = this.container.getBoundingClientRect();
            const pointBeforeZoom = {
                x: (pinchCenterX - svgRect.left - this.state.pan.x) / oldZoom,
                y: (pinchCenterY - svgRect.top - this.state.pan.y) / oldZoom
            };

            this.state.pan.x = (pinchCenterX - svgRect.left) - pointBeforeZoom.x * this.state.zoom;
            this.state.pan.y = (pinchCenterY - svgRect.top) - pointBeforeZoom.y * this.state.zoom;

            this.callbacks.onPanZoom();
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
            x: (clientX - svgRect.left - this.state.pan.x) / this.state.zoom,
            y: (clientY - svgRect.top - this.state.pan.y) / this.state.zoom
        };

        if (event.deltaY < 0) {
            this.state.zoom *= zoomFactor;
        } else {
            this.state.zoom /= zoomFactor;
        }

        this.state.pan.x = (clientX - svgRect.left) - pointBeforeZoom.x * this.state.zoom;
        this.state.pan.y = (clientY - svgRect.top) - pointBeforeZoom.y * this.state.zoom;

        this.callbacks.onPanZoom();
    }
}