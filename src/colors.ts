// Which palette entry each kind of thing is painted with, plus the handful of
// fixed colours that sit outside any palette. The palettes themselves are in
// `constants.ts`. Purely presentation: the layouts never see a colour,
// `<zx-diagram>` resolves a scheme name to a palette, and the painters use
// whatever they are handed.
//
// The lookups live here rather than in either painter so that a spider and the
// blob standing for the same spider cannot end up different colours.

import type { DiagramEdgeKind, NodeKind } from './types'

/** Fill for a node's phase text */
export const PHASE_FILL = '#00d'

/** Fill for graph node ids and hypergraph wire ids
 *  (and the `×` in front of the scalar)
 */
export const LABEL_FILL = '#999'

/** Stroke for whatever the last click selected — a node in the graph view, a
 *  blob and its leader line in the hypergraph — so a selection looks the same
 *  whichever view you are in.
 */
export const SELECTED_STROKE = '#00f'

/** The canvas the drawing sits on: `<zx-diagram>` paints the SVG with it, and
 *  `<zx-viewer>` strokes with it to knock a gap between a selected edge and
 *  its casing. Shared so those two cannot drift apart — a gap in any other
 *  colour would be a stripe rather than a gap. */
export const CANVAS_FILL = '#fcfcfd'

/** Fill for a node — and for the hypergraph blob standing for that same node,
 *  which is why this is shared rather than private to `<zx-viewer>`. */
export function nodeColor(kind: NodeKind, colors: Record<string, string>): string {
  switch (kind) {
    case 'z-spider':
      return colors.Z
    case 'x-spider':
      return colors.X
    case 'hadamard':
      return colors.H
    case 'w-input':
      return colors.W
    case 'w-output':
      return colors.Walt
    case 'z-box':
      return colors.Zalt
    default:
      return colors.boundary
  }
}

/** A colour per wire kind — the built-in three, kinds of your own, or both.
 *  Partial, since naming one kind shouldn't mean restating the others. */
export type EdgeColors = Partial<Record<DiagramEdgeKind, string>>

/** The palette entry each *built-in* wire kind falls back to. A custom kind has
 *  no entry — the palettes are pyzx's and a kind of your own is not in them —
 *  which is why `edgeColors` is consulted first and keyed by kind rather than
 *  by these names. */
const EDGE_KEY = new Map<DiagramEdgeKind, string>([
  ['simple', 'edge'],
  ['hadamard', 'Hedge'],
  ['w-io', 'Xedge'],
])

/**
 * Colour for an edge — the wire the graph view strokes, and the dot the
 * hypergraph view draws in its place.
 *
 * `edgeColors` wins, then the palette entry for a built-in kind, then the plain
 * wire colour. That last step is what lets a diagram carry a kind nobody has
 * given a colour to: it draws like an ordinary wire rather than failing or
 * coming out undefined.
 *
 * Both painters call this rather than reading a colour off anything of their
 * own, so a wire and the dot standing for that same wire cannot disagree.
 *
 * A kind is any string, so both lookups have to be by *own* key: `kind:
 * 'toString'` reaches `Object.prototype` through a plain object and comes back
 * as a function to paint with. Hence `Object.hasOwn` for `edgeColors`, whose
 * shape is the caller's, and a `Map` for `EDGE_KEY`, which is ours.
 */
export function edgeColor(
  kind: DiagramEdgeKind,
  colors: Record<string, string>,
  edgeColors?: EdgeColors | null,
): string {
  const named = edgeColors && Object.hasOwn(edgeColors, kind) ? edgeColors[kind] : undefined
  if (named) return named
  const key = EDGE_KEY.get(kind)
  return (key && colors[key]) || colors.edge
}

/** Pauli-web strand colour. */
export function webColor(kind: 'X' | 'Y' | 'Z' | 'I', colors: Record<string, string>): string {
  switch (kind) {
    case 'Y':
      return colors.Ydark
    case 'Z':
      return colors.Zdark
    case 'I':
      return colors.Idark
    default:
      return colors.Xdark
  }
}
