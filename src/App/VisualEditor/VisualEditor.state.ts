import { ConcreteSyntax } from "@/statecharts/concrete_syntax";

export type VisualEditorState<SelectionType = Selection> = ConcreteSyntax & {
  nextID: number;
  selection: SelectionType;
};

export class Parts extends Set<string> {}

export class Selection extends Map<string, Parts> {
  toJSON() {
    // we still serialize to our old format, to remain compatible
    return 
  }
}

export type SerializableSelection = (readonly [string, string] | {uid: string, part: string})[];


export function deserializeSelection(selection: SerializableSelection) {
  const result = new Selection();
  for (const item of selection) {
    // i kind of fucked things up by introducing over time 2 ways to serialize the selection, meaning that there are two formats that have to be supported (for backwards compatibility):
    let uid, part;
    if (Array.isArray(item)) {
      [uid, part] = item;
    }
    else {
      // @ts-ignore
      ({uid, part} = item);
    }
    result.set(uid, (result.get(uid) || new Parts()).add(part));
  }
  return result;
}

export function deserializeEditorState(state: VisualEditorState<SerializableSelection>): VisualEditorState {
  return {
    ...state,
    selection: deserializeSelection(state.selection),
  };
}

export function serializeEditorState(state: VisualEditorState): VisualEditorState<SerializableSelection> {
  return {
    ...state,
    selection: [...state.selection.entries()].flatMap(([uid, parts]) => [...parts].map(part => [uid, part] as const)),
  }
}
