import { translateAnchored, translateLine, translateRect, Vec2D } from "../../../util/geometry";
import { Parts, Selection, VisualEditorState } from "../VisualEditor.state";

export function translateSelection({rountangles, diamonds, history, arrows, texts, selection, ...rest}: VisualEditorState, delta: Vec2D) {
  return {
    rountangles: applyTranslation(rountangles, selection, delta, translateRect),
    diamonds: applyTranslation(diamonds, selection, delta, translateRect),
    history: applyTranslation(history, selection, delta, translateAnchored),
    arrows: applyTranslation(arrows, selection, delta, translateLine),
    texts: applyTranslation(texts, selection, delta, translateAnchored),

    selection,
    ...rest,
  } as VisualEditorState;
}

function applyTranslation<G, T extends G & {uid: string}>(
  shapes: T[],
  selection: Selection,
  delta: Vec2D,
  f: (shape: T, delta: Vec2D, parts: Parts) => G,
) {
  let anythingChanged = false;
  return shapes.map(shape => {
    const parts = getParts(selection, shape.uid);
    if (parts.size > 0) {
      anythingChanged = true;
      return {
        ...shape,
        ...f(shape, delta, parts),
      };
    }
    return shape;
  })
}

const getParts = (selection: Selection, uid: string) => {
  return selection.get(uid) || new Set();
}
