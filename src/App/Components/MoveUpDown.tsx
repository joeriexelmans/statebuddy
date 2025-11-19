import { Dispatch, SetStateAction } from "react";
import { Tooltip } from "./Tooltip";

import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export function MoveUpDown<T>({i, ls, setter}: {i: number, ls: T[], setter: Dispatch<SetStateAction<T[]>>}) {
  return <>
    <Tooltip tooltip='move down' align='right'>
      <button disabled={i === ls.length-1}
        onClick={() => setter(ls => [...ls.slice(0, i), ls[i+1], ls[i], ...ls.slice(i+2)])}>
        <ArrowDownwardIcon fontSize='small'/>
      </button>
    </Tooltip>
    <Tooltip tooltip='move up' align='right'>
      <button disabled={i === 0}
        onClick={() => setter(ls => [...ls.slice(0, i-1), ls[i], ls[i-1], ...ls.slice(i+1)])}>
        <ArrowUpwardIcon fontSize='small'/>
      </button>
    </Tooltip>
  </>;
}
