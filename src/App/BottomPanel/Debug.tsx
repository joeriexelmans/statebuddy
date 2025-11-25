import CloseIcon from '@mui/icons-material/Close';
import { Tooltip } from "../Components/Tooltip";
import { Setters } from "../makePartialSetter";
import { GRID_CELL_SIZE } from '../parameters';

export type DebugState = {
  showBBox: boolean,
  showGrid: boolean,
  showCells: boolean,
}

export const defaultDebugState: DebugState = {
  showBBox: false,
  showGrid: false,
  showCells: false,
}

type DebugProps = DebugState & Setters<DebugState> & {
  hide: () => void,
};

export function DebugPanel({showBBox, showGrid, showCells, hide, ...setters}: DebugProps) {
  return <div className="toolbar" style={{display: 'flex'}}>
    <div className="toolbarGroup">
      <Tooltip tooltip='The entire canvas is conceptually partitioned into a grid of equally sized cells.' align='left' above>
        <label>
          <input type="checkbox"
            checked={showGrid}
            onChange={e  => setters.setShowGrid(e.target.checked)} 
            />
          grid
        </label>
      </Tooltip>
      <Tooltip tooltip='Every shape has a "fat" bounding box. Only if the "fat" bounding boxes of two shapes overlap, can there be an interaction between them.' align='left' above>
      <label>
        <input type="checkbox"
          checked={showBBox}
          onChange={e  => setters.setShowBBox(e.target.checked)} 
          />
        bounding box
      </label>
      </Tooltip>
      <Tooltip tooltip='Every shape occupies those cells of the grid that overlap with its fat bounding box. We maintain a (sparse) mapping from every cell to a list of shapes occupying that cell. Only when two shapes occupy the same cell, do we check for interactions (e.g., an arrow connecting to the side of a rountangle). This is much more scalable than naively checking every pair of shapes.' align='left' above>
      <label>
        <input type="checkbox"
          checked={showCells}
          onChange={e  => setters.setShowCells(e.target.checked)} 
          />
        occupied cells
        </label>
      </Tooltip>
    </div>
    &emsp;
    <div className="toolbarGroup">
      <label>
        <Tooltip tooltip='This is a hardcoded parameter. Too small a value results in too many "buckets" (degrading performance). Too large a value and many shapes will occupy the same buckets (also degrading performance)' above>
          <input id="time"
            // disabled={true}
            value={GRID_CELL_SIZE}
            readOnly={true}
            className="readonlyTextBox" />
        </Tooltip>
        cell size
      </label>
    </div>
    <div style={{flexGrow:1}}/>
    <div className="toolbarGroup" style={{flex: '0 0 content'}}>
        <Tooltip tooltip="hide" above={true}>
          <button
              type="button" // <-- prevent form submission on click
              onClick={hide}
              style={{width: 60}}
              >
            <CloseIcon fontSize="small"/>
          </button>
        </Tooltip>
    </div>
  </div>;
}