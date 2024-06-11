"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Store chart data
const states = new WeakMap();
const getState = (chart) => {
    const state = states.get(chart);
    return state || null;
};
const setState = (chart, updatedState) => {
    const originalState = getState(chart);
    states.set(chart, Object.assign({}, originalState, updatedState));
    return updatedState;
};

// Store options
const pluginOptions = {
    colors: {
        selection: "#e8eff6",
        selectedElements: "#1f77b4",
        unselectedElements: "#cccccc"
    }
};


const addEventListeners = (chart, canvasElement) => {
    const startHandler = (e) => {
        if (!chart) return;

        // Get coordinates based on event type
        let clientX, clientY;
        if (e.type === 'mousedown') {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.type === 'touchstart') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault(); // Prevent default touch behavior
        } else {
            return;
        }


        // Get canvas position
        const rect = canvasElement.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;


        // Get elements
        const axisElements = chart.getElementsAtEventForMode(e, "index", { intersect: false });
        if (axisElements.length === 0) {
            return;
        }


        // Get axis value
        const axisIndex = axisElements[0].index;
        const axisValue = chart.data.labels[axisIndex];

        // Set selection origin
        setState(chart, {
            selectionXY: {
                drawing: true,
                start: { axisValue, axisIndex, x: offsetX, y: offsetY },
                end: {}
            }
        });
    };

    
    const endHandler = (e) => {
        if (!chart) return;

        // Get coordinates based on event type
        let clientX, clientY;
        if (e.type === 'mouseup') {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.type === 'touchend') {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
            e.clientX = clientX;
            e.clientY = clientY;
            e.preventDefault(); // Prevent default touch behavior
        } else {
            return;
        }

        // Get canvas position
        const rect = canvasElement.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        // Check drawing status
        const state = getState(chart);
        if (!state || !state.selectionXY?.drawing) {
            return;
        }

        // Get elements
        const axisElements = chart.getElementsAtEventForMode(e, "index", { intersect: false });
       
        const axisIndex = axisElements.length > 0 ? axisElements[0].index : chart.data.labels.length - 1;
        const axisValue = chart.data.labels[axisIndex];

        // Check values & set end origin
        if (state.selectionXY.start.axisValue > axisValue) {
            // Switch values - user has selected opposite way
            state.selectionXY.end = { ...state.selectionXY.start };
            state.selectionXY.start = { axisValue, axisIndex, x: offsetX, y: offsetY };
        } else {
            // Set end origin
            state.selectionXY.end = { axisValue, axisIndex, x: offsetX, y: offsetY };
        }

        // End drawing
        state.selectionXY.drawing = false;

        // Update bounding box
        const boundingBox = [
            state.selectionXY.start,
            [state.selectionXY.end.x, state.selectionXY.start.y],
            state.selectionXY.end,
            [state.selectionXY.start.x, state.selectionXY.end.y]
        ];

        setState(chart, state);

        // Render rectangle
        chart.update();

        // Emit event
        const selectCompleteCallback = chart?.config?.options?.plugins?.selectdrag?.onSelectComplete;
        if (selectCompleteCallback) {
            selectCompleteCallback({
                range: [state.selectionXY.start.axisValue, state.selectionXY.end.axisValue],
                boundingBox
            });
        }
    };


    const moveHandler = (e) => {
        if (!chart) return;

        // Get coordinates based on event type
        let clientX, clientY;
        if (e.type === 'mousemove') {
            clientX = e.clientX;
            clientY = e.clientY;
        } else if (e.type === 'touchmove') {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault(); // Prevent default touch behavior
        } else {
            return;
        }

        // Get canvas position
        const rect = canvasElement.getBoundingClientRect();
        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;

        // Check drawing status
        const state = getState(chart);
        if (!state || !state.selectionXY?.drawing) {
            return;
        }

        // Set end origin
        state.selectionXY.end = { x: offsetX, y: offsetY};
        chart.render();
        setState(chart, state);
    };

    canvasElement.addEventListener("mousedown", startHandler);
    window.addEventListener("mouseup", endHandler);
    canvasElement.addEventListener("mousemove", moveHandler);

    canvasElement.addEventListener("touchstart", startHandler);
    window.addEventListener("touchend", endHandler);
    canvasElement.addEventListener("touchmove", moveHandler);

    // Return a function to remove event listeners for cleanup
    return () => {
        canvasElement.removeEventListener("mousedown", startHandler);
        window.removeEventListener("mouseup", endHandler);
        canvasElement.removeEventListener("mousemove", moveHandler);

        canvasElement.removeEventListener("touchstart", startHandler);
        window.removeEventListener("touchend", endHandler);
        canvasElement.removeEventListener("touchmove", moveHandler);
    };
};


// Export main plugin
exports.default = {
    id: "selectdrag",
    start: (chart, _args, options) => {
        // Check if enabled
        if (!chart?.config?.options?.plugins?.selectdrag?.enabled) {
            return;
        }

        // Get chart canvas
        const canvasElement = chart.canvas;
        if (!canvasElement) {
            console.error("Chart canvas element is null.");
            return;
        }

        // Add event listeners
        const removeEventListeners = addEventListeners(chart, canvasElement);

        // Store cleanup function in the chart instance
        chart.$selectDragRemoveEventListeners = removeEventListeners;
    },
    beforeUpdate: (chart, args, options) => {
        // Check if enabled
        if (!chart?.config?.options?.plugins?.selectdrag?.enabled) {
            return;
        }

        // Check drawing status
        const state = getState(chart);

        // Set highlighted
        chart.data.datasets = chart.data.datasets.map((dataset) => {
            dataset.backgroundColor = chart.data.labels.map((value, index) => {
                if (!state || !state.selectionXY?.start?.x || !state.selectionXY?.end?.x) {
                    // Show default
                    return pluginOptions.colors.selectedElements;
                } else {
                    // Show selected/unselected
                    if (index >= state.selectionXY.start.axisIndex && index <= state.selectionXY.end.axisIndex) {
                        return pluginOptions.colors.selectedElements;
                    } else {
                        return pluginOptions.colors.unselectedElements;
                    }
                }
            });
            return dataset;
        });
    },
    afterDraw: (chart, args, options) => {
        // Check drawing status
        const state = getState(chart);
        if (!state || (state.selectionXY?.drawing === false && !state.selectionXY?.end?.x)) {
            return;
        }

        // Save canvas state
        const { ctx } = chart;
        ctx.save();

        // Draw user rectangle
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = pluginOptions.colors.selection;
        ctx.fillRect((state.selectionXY.start?.x || 0), chart.chartArea.top, (state.selectionXY.end?.x || 0) - (state.selectionXY.start?.x || 0), chart.chartArea.height);

        // Restore canvas
        ctx.restore();
    },
    stop: (chart) => {
        // Remove event listeners if present
        if (chart.$selectDragRemoveEventListeners) {
            chart.$selectDragRemoveEventListeners();
        }
    },
    setSelection: (chart, range = []) => {
        // Check has data
        if (chart.data.labels.length === 0 || chart.data.datasets.length === 0) {
            return;
        }

        // Check if new data blank
        if (range.length === 0) {
            // Clear selection
            setState(chart, null);
            chart.update();
        }

        // Create state
        const state = {
            selectionXY: {
                drawing: false,
                start: {},
                end: {}
            }
        };

        // Set start axis
        const startAxisIndex = chart.data.labels.findIndex((item) => item === range[0]);
        state.selectionXY.start = {
            axisValue: range[0],
            axisIndex: startAxisIndex,
            x: chart.scales.x.getPixelForValue(chart.data.labels[startAxisIndex]),
            y: 0
        };

        // Set end axis
        const endAxisIndex = chart.data.labels.findIndex((item) => item === range[1]);
        state.selectionXY.end = {
            axisValue: range[0],
            axisIndex: endAxisIndex,
            x: chart.scales.x.getPixelForValue(chart.data.labels[endAxisIndex]),
            y: chart.chartArea.height
        };

        setState(chart, state);
        chart.update();
    },
    clearSelection: (chart) => {
        // Clear state
        setState(chart, null);
        chart.update();
    }
};
