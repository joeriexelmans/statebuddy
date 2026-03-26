import { ConcreteSyntax } from "@/statecharts/concrete_syntax";
import { Rect2D } from "../../util/geometry";

export type VisualEditorState = ConcreteSyntax & {
  nextID: number;
  selection: Map<string, Parts>; // uid of shape -> selected parts
  makingSelection?: Rect2D;
};

export type Parts = ReadonlySet<string>;
export type Selection = Map<string, Parts>;
