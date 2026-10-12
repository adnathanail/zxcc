// Registering a custom element under a name that is already taken throws, and
// the throw takes the whole module down with it. That happens whenever zxcc is
// evaluated twice on one page — two separately bundled scripts that each carry
// their own copy, say. Every element zxcc defines is registered through here
// instead, so a second copy of the *same* version finds the name taken, leaves
// it be, and uses the elements the first copy registered.
//
// A second copy of a *different* version is refused outright. A name can be
// registered only once per page, so the second copy would silently draw with
// the first one's elements — an older copy loaded first would quietly cost the
// newer one its features, and which one won would depend on load order. The
// error names both versions so the mismatch is found where it is caused.
//
// Each registered class is tagged with its version under a `Symbol.for` key,
// which every copy resolves to the same symbol, since separate copies share
// nothing else.

const VERSION = Symbol.for('zxcc.version')

type Tagged = CustomElementConstructor & { [VERSION]?: string }

/** Registers `cls` as `name`, or does nothing if the same version of zxcc
 *  already has. Throws if anything else holds the name. */
export function defineOnce(
  name: string,
  cls: CustomElementConstructor,
  version: string = __ZXCC_VERSION__,
) {
  const existing: Tagged | undefined = customElements.get(name)
  if (existing === undefined) {
    ;(cls as Tagged)[VERSION] = version
    customElements.define(name, cls)
    return
  }
  const theirs = existing[VERSION]
  if (theirs === version) return
  const holder =
    theirs === undefined
      ? 'something other than this version of zxcc (another library, or zxcc 0.5.0 or earlier)'
      : `zxcc ${theirs}`
  throw new Error(
    `zxcc ${version} cannot register <${name}>: it is already registered by ${holder}. ` +
      'Only one version of zxcc can be loaded on a page.',
  )
}
