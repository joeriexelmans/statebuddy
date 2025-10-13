import { ConcreteState, stateDescription, Transition } from "../statecharts/abstract_syntax";
import { Action, Expression } from "../statecharts/label_ast";

export function ShowTransition(props: {transition: Transition}) {
  return <>&#10132; {stateDescription(props.transition.tgt)}</>;
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

export function AST(props: {root: ConcreteState, transitions: Map<string, Transition[]>}) {
  const description = stateDescription(props.root);
  const outgoing = props.transitions.get(props.root.uid) || [];

  return <details open={true}>
    <summary>{props.root.kind}: {description}</summary>

    {props.root.entryActions.length>0 &&
        props.root.entryActions.map(action =>
          <div>&emsp;entry / <ShowAction action={action}/></div>
        )
    }
    {props.root.exitActions.length>0 &&
        props.root.exitActions.map(action =>
          <div>&emsp;exit / <ShowAction action={action}/></div>
        )
    }
    {props.root.children.length>0 &&
          props.root.children.map(child => 
            <AST root={child} transitions={props.transitions} />
          )
    }
    {outgoing.length>0 &&
        outgoing.map(transition => <>&emsp;<ShowTransition transition={transition}/><br/></>)
    }
  </details>
}
