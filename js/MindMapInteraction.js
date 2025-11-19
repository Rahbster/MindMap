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

        this.initListeners();
    }

    initListeners() {
        this.container.addEventListener('mousedown', this.handlePanStart.bind(this));
        this.container.addEventListener('mousemove', this.handlePanMove.bind(this));
        this.container.addEventListener('mouseup', this.handlePanEnd.bind(this));
        this.container.addEventListener('mouseleave', this.handlePanEnd.bind(this));
        this.container.addEventListener('wheel', this.handleZoom.bind(this));
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
}