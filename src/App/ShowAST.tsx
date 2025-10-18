import { ConcreteState, PseudoState, stateDescription, Transition } from "../statecharts/abstract_syntax";
import { Action, Expression } from "../statecharts/label_ast";
import { RT_Statechart } from "../statecharts/runtime_types";

import "./AST.css";

export function ShowTransition(props: {transition: Transition}) {
  return <>➝ {stateDescription(props.transition.tgt)}</>;
}

export function ShowExpr(props: {expr: Expression}) {
  if (props.expr.kind === "literal") {
    return <>{props.expr.value}</>;
  }
  else if (props.expr.kind === "ref") {
    return <>{props.expr.variable}</>;
  }
  else if (props.expr.kind === "unaryExpr") {
    return <>{props.expr.operator}<ShowExpr expr={props.expr.expr}/></>;
  }
  else if (props.expr.kind === "binaryExpr") {
    return <><ShowExpr expr={props.expr.lhs}/>{props.expr.operator}<ShowExpr expr={props.expr.rhs}/></>;
  }
}

export function ShowAction(props: {action: Action}) {
  if (props.action.kind === "raise") {
    return <>^{props.action.event}</>;
  }
  else if (props.action.kind === "assignment") {
    return <>{props.action.lhs} = <ShowExpr expr={props.action.rhs}/>;</>;
  }
}

export function ShowAST(props: {root: ConcreteState | PseudoState, transitions: Map<string, Transition[]>, rt: RT_Statechart | undefined, highlightActive: Set<string>}) {
  const description = stateDescription(props.root);
  const outgoing = props.transitions.get(props.root.uid) || [];

  return <details open={true} className={props.highlightActive.has(props.root.uid) ? "active" : ""}>
    <summary>{props.root.kind}: {description}</summary>

    {props.root.kind !== "pseudo" && props.root.entryActions.length>0 &&
        props.root.entryActions.map(action =>
          <div>&emsp;entry / <ShowAction action={action}/></div>
        )
    }
    {props.root.kind !== "pseudo" && props.root.exitActions.length>0 &&
        props.root.exitActions.map(action =>
          <div>&emsp;exit / <ShowAction action={action}/></div>
        )
    }
    {props.root.kind !== "pseudo" && props.root.children.length>0 &&
          props.root.children.map(child => 
            <ShowAST root={child} transitions={props.transitions} rt={props.rt} highlightActive={props.highlightActive} />
          )
    }
    {outgoing.length>0 &&
        outgoing.map(transition => <>&emsp;<ShowTransition transition={transition}/><br/></>)
    }
  </details>
}
