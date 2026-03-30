import styles from "../../App.module.css";
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { memo, useState } from "react";
import { ConcreteState, OrState, Statechart, Transition, TransitionSrcTgt, UnstableState, stateDescription } from "../../../statecharts/abstract_syntax";
import { PseudoStateIcon, RountangleIcon } from "../../TopPanel/Icons";
import { Tooltip } from "../../Components/Tooltip";
import { downloadObjectAsJson } from "../../../util/download_json";

export const StateTree = memo(function StateTree(props: {root: ConcreteState | UnstableState, dashed: boolean}) {
  const description = stateDescription(props.root);

  const [expanded, setExpanded] = useState(false);

  const hasChildren = props.root.kind !== "pseudo" && props.root.children.length > 0;

  return <li style={{cursor: 'default'}} onClick={e => {setExpanded(e => !e); e.stopPropagation()}}>
    <div className={styles.stateTreeDescription}>
      <div style={{width: 16, display: 'inline-block'}}>{hasChildren && (expanded ? "▾ " : "▸ ")}</div>
      <div style={{display: 'inline-block', verticalAlign: 'middle'}}>
      {{
        "and": <RountangleIcon kind="and" dashed={props.dashed}/>,
        "or": <RountangleIcon kind="or" dashed={props.dashed}/>,
        "pseudo": <PseudoStateIcon/>,
      }[props.root.kind]}
      </div>
      &nbsp;
      {description}
    </div>
    {hasChildren &&
      <ul style={{display: expanded ? undefined : 'none'}}>
        {/* @ts-ignore */}
        {props.root.children!.map(child => 
          <StateTree key={child.uid} root={child} dashed={props.root.kind === "and"} />
        )}
      </ul>
    }
  </li>;
});


export const StateTreePanel = memo(function StateTreePanel({abstractSyntax}: {abstractSyntax: Statechart}) {
  return <div className={styles.stateTree}>
    <div style={{float: 'right'}}>
    <Tooltip tooltip="export abstract syntax (JSON)" align="right">
      <button
        onClick={() => {
          downloadObjectAsJson({
            root: removeCycles(abstractSyntax.root),
            transitions: [...abstractSyntax.transitions.values()].flatMap(ts => ts.map(removeCyclesT)),
            inputEvents: abstractSyntax.inputEvents.map(i => i.event),
            outputEvents: [...abstractSyntax.outputEvents],
            internalEvents: abstractSyntax.internalEvents.map(i => i.event),
          }, 'abstract_syntax.json');
        }}
      >
        <SaveAltIcon fontSize="small"/>
      </button>
    </Tooltip>
    </div>
    <ul>
      <StateTree root={abstractSyntax.root} dashed={false}/>
    </ul>
  </div>
});

// @ts-ignore
function removeCycles(state: TransitionSrcTgt) {
  const common = {
    uid: state.uid,
    kind: state.kind,
    comments: state.comments,
    depth: state.depth,
    entryActions: state.entryActions,
    exitActions: state.exitActions,
  }
  if (state.kind === "pseudo") {
    return common;
  }
  else {
    return {
      ...common,
      children: state.children.map(removeCycles),
      history: state.history.map(h => ({
        uid: h.uid,
        kind: h.kind,
        depth: h.depth,
      })),
      timers: state.timers,
    }
  }
}

function removeCyclesT(t: Transition) {
  return {
    uid: t.uid,
    src: t.src.uid,
    tgt: t.tgt.uid,
    arena: t.arena.uid,
    label: t.label,
  }
}
