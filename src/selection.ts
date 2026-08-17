// What is picked out, stated in the terms the two views share.
//
// A selection is held in the *diagram's* language — ZX node ids, and indices
// into `diagram.edges` — rather than in either painter's own. That is what
// lets the two track each other: the same selection means "spider 2 and the
// edge 1—2" to `<zx-viewer>` and "the blob standing for node 2, and the dot
// standing for that edge" to `<zx-hypergraph-viewer>`, so neither painter has
// to know the other exists. Translating happens where each painter draws.
//
// `<zx-diagram>` owns the value and hands it down to both painters, which are
// controlled: a painter announces the selection a gesture *would* make with
// {@link SELECTION_EVENT} and draws whatever comes back.

/** ZX node ids and edge indices, the two things a selection can name. Held as
 *  sets because both painters ask "is this one in it?" per mark drawn. */
export interface Selection {
  readonly nodes: ReadonlySet<number>
  readonly edges: ReadonlySet<number>
}

export const EMPTY_SELECTION: Selection = { nodes: new Set(), edges: new Set() }

/** Announced by a painter when a gesture selects something; `<zx-diagram>`
 *  listens, stores the detail, and hands it back to both painters. */
export const SELECTION_EVENT = 'zx-selection'

export function selectionEvent(selection: Selection): CustomEvent<Selection> {
  return new CustomEvent<Selection>(SELECTION_EVENT, { detail: selection })
}

/** A selection naming nodes alone — what a press in the diagram view makes,
 *  and what a press on a blob makes. */
export function nodeSelection(nodes: Iterable<number>): Selection {
  return { nodes: new Set(nodes), edges: new Set() }
}

/** A selection naming edges alone — what a press on a hypergraph dot makes,
 *  since a dot *is* an edge. */
export function edgeSelection(edges: Iterable<number>): Selection {
  return { nodes: new Set(), edges: new Set(edges) }
}
