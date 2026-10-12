// Registering a custom element under a name that is already taken throws, and
// the throw takes the whole module down with it. That happens whenever zxcc is
// evaluated twice on one page — two separately bundled scripts that each carry
// their own copy, say. Every element zxcc defines is registered through here
// instead, so a second copy finds the name taken, leaves it be, and its pages
// use the elements the first copy registered. If the copies are different
// versions, whichever loaded first is the one drawn.

/** Registers `cls` as `name` unless something already holds that name. */
export function defineOnce(name: string, cls: CustomElementConstructor) {
  if (customElements.get(name) === undefined) customElements.define(name, cls)
}
