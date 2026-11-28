import { ensureSelectionWithinEditorBounds, rawMoveSelection } from "@/languages/statecharts/concrete_syntax";
import { Vec2D } from "../../../../util/geometry";
import { Parts, Selection, VisualEditorState } from "../VisualEditor.state";

export function translateSelection(s: VisualEditorState, delta: Vec2D) {
  const translated = rawMoveSelection(s, delta);
  return ensureSelectionWithinEditorBounds(translated) as VisualEditorState;
}

export function applyTranslation<G, T extends G & {uid: string}>(
  shapes: T[],
  selection: Selection,
  delta: Vec2D,
  f: (shape: T, delta: Vec2D, parts: Parts) => readonly [G, Parts],
) {
  let anythingChanged = false;
  const updatedSelection = new Map(selection);
  const translated = shapes.map(shape => {
    const parts = getParts(selection, shape.uid);
    if (parts.size > 0) {
      anythingChanged = true;
      const [translatedGeometry, newParts] = f(shape, delta, parts);
      updatedSelection.set(shape.uid, newParts);
      return {
        ...shape,
        ...translatedGeometry,
      };
    }
    return shape;
  });
  if (anythingChanged) {
    return [translated, updatedSelection] as const;
  }
  return [shapes, selection] as const; // <-- don't break memoization if nothing changed
}

const getParts = (selection: Selection, uid: string) => {
  return selection.get(uid) || new Set();
}
