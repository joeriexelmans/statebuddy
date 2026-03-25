import styles from "../../App.module.css";

import { memo, useState } from "react";
import { ConcreteState, OrState, UnstableState, stateDescription } from "../../../statecharts/abstract_syntax";
import { PseudoStateIcon, RountangleIcon } from "../../TopPanel/Icons";

export const StateTree = memo(function StateTree(props: {root: ConcreteState | UnstableState}) {
  const description = stateDescription(props.root);

  const [expanded, setExpanded] = useState(false);

  return <li style={{verticalAlign: 'middle', cursor: 'default'}} onClick={e => {setExpanded(e => !e); e.stopPropagation()}}>
    {expanded ? "▾" : "▸"}&nbsp;
    {{
      "and": <RountangleIcon kind="and"/>,
      "or": <RountangleIcon kind="or"/>,
      "pseudo": <PseudoStateIcon/>,
    }[props.root.kind]}
    &nbsp;
    {description}
    {expanded && props.root.kind !== "pseudo" && props.root.children.length>0 &&
      <ul>
        {props.root.children.map(child => 
          <StateTree key={child.uid} root={child} />
        )}
      </ul>
    }
  </li>;
});


export const StateTreePanel = memo(function StateTreePanel(props: {root: OrState}) {
  return <div className={styles.stateTree}>
    <ul>
      <StateTree root={props.root}/>
    </ul>
  </div>
});
