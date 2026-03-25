import styles from "../../App.module.css";

import { memo, useState } from "react";
import { ConcreteState, OrState, UnstableState, stateDescription } from "../../../statecharts/abstract_syntax";
import { PseudoStateIcon, RountangleIcon } from "../../TopPanel/Icons";

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


export const StateTreePanel = memo(function StateTreePanel(props: {root: OrState}) {
  return <div className={styles.stateTree}>
    <ul>
      <StateTree root={props.root} dashed={false}/>
    </ul>
  </div>
});
