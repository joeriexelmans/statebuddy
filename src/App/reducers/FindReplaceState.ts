// the part of the state that is preserved on app restart
export type FindReplaceState = {
  findText: string,
  replaceText: string,
};

export const defaultFindReplaceState = {
  findText: "",
  replaceText: "",
};
