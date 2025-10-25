
export function _evolve(object, changes) {
  return Object.assign(
    Object.create(Object.getPrototypeOf(object)), // create empty object with same prototype as original
    {
      ...object,
      ...changes,
    });
}
