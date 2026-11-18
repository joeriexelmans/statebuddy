import { area, translateAnchored, translateLine, translateRect, Vec2D } from "../../../util/geometry";
import { Parts, Selection, VisualEditorState } from "../VisualEditor.state";

export function translateSelection({rountangles, diamonds, history, arrows, texts, selection, ...rest}: VisualEditorState, delta: Vec2D) {
  let newSelection = selection;
  let newRountangles;
  [newRountangles, newSelection] = applyTranslation(rountangles, newSelection, delta, translateRect);
  // console.time('sort rountangles');
  newRountangles = (newRountangles === rountangles) ? rountangles : newRountangles.sort((a,b) => area(b) - area(a));
  // console.timeEnd('sort rountangles');
  let newDiamonds;
  [newDiamonds, newSelection] = applyTranslation(diamonds, newSelection, delta, translateRect);
  let newHistory;
  [newHistory, newSelection] = applyTranslation(history, newSelection, delta, translateAnchored);
  let newArrows;
  [newArrows, newSelection] = applyTranslation(arrows, newSelection, delta, translateLine);
  let newTexts;
  [newTexts, newSelection] = applyTranslation(texts, newSelection, delta, translateAnchored);
  return {
    rountangles: newRountangles,
    diamonds: newDiamonds,
    history: newHistory,
    arrows: newArrows,
    texts: newTexts,
    selection: newSelection,
    ...rest,
  } as VisualEditorState;
}

function applyTranslation<G, T extends G & {uid: string}>(
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
      console.log({newParts});
      
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
