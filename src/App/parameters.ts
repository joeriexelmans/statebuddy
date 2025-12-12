
export const ARROW_SNAP_THRESHOLD = 20;
export const TEXT_SNAP_THRESHOLD = 40;

export const ROUNTANGLE_RADIUS = 20;
export const MIN_ROUNTANGLE_SIZE = { x: ROUNTANGLE_RADIUS*2, y: ROUNTANGLE_RADIUS*2 };

// those hoverable green transparent circles in the corners of rountangles:
export const CORNER_HELPER_OFFSET = 4;
export const CORNER_HELPER_RADIUS = 16;

export const HISTORY_RADIUS = 20;

export const ZOOM_STEPS = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500];
export const ZOOM_MIN = 25;
export const ZOOM_MAX = 500;

export const TIMESCALE_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
export const TIMESCALE_MIN = 0.001;
export const TIMESCALE_MAX = 100;

// this parameter only impacts performance, not any observable behavior:
export const GRID_CELL_SIZE = 200;


// warning: making this smaller may brake compatibility with existing models!
export const EDITOR_WIDTH = 8000;
export const EDITOR_HEIGHT = 8000;