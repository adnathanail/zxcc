// The pyzx palettes (`pyzx.utils.*_colors`), and which entry each kind of
// thing is painted with. Purely presentation: the layouts never see a colour,
// `<zx-diagram>` resolves a scheme name to one of these, and the painters use
// whatever they are handed.
//
// The lookups live here rather than in either painter so that a spider and the
// blob standing for the same spider cannot end up different colours.

import type { DiagramEdgeKind, NodeKind } from './types'

// pyzx.utils.original_colors
export const ORIGINAL_COLORS: Record<string, string> = {
  edge: '#000000',
  Hedge: '#0088ff',
  Xedge: '#999999',
  boundary: '#000000',
  X: '#ff8888',
  Y: '#aabbff',
  Z: '#ccffcc',
  H: '#ffff66',
  W: '#000000',
  Zalt: '#ccffcc',
  Walt: '#000000',
  Xdark: '#ff8888',
  Ydark: '#aabbff',
  Zdark: '#99dd99',
}

// pyzx.utils.rgb_colors — original with Y/Z and Ydark/Zdark swapped and an
// orange Hadamard edge.
export const RGB_COLORS: Record<string, string> = {
  ...ORIGINAL_COLORS,
  Hedge: '#ff6600',
  Y: ORIGINAL_COLORS.Z,
  Z: ORIGINAL_COLORS.Y,
  Ydark: ORIGINAL_COLORS.Zdark,
  Zdark: ORIGINAL_COLORS.Ydark,
}

// pyzx.utils.grayscale_colors
export const GRAYSCALE_COLORS: Record<string, string> = {
  edge: '#000000',
  Hedge: '#888888',
  Xedge: '#dddddd',
  boundary: '#000000',
  X: '#666666',
  Y: '#9999dd',
  Z: '#dddddd',
  H: '#eeeeee',
  W: '#000000',
  Zalt: '#dddddd',
  Walt: '#000000',
  Xdark: '#666666',
  Ydark: '#9999dd',
  Zdark: '#dddddd',
}

export type ColorSchemeName = 'original' | 'rgb' | 'grayscale'

export const COLOR_SCHEMES: Record<ColorSchemeName, Record<string, string>> = {
  original: ORIGINAL_COLORS,
  rgb: RGB_COLORS,
  grayscale: GRAYSCALE_COLORS,
}

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

/** A colour per wire kind, the shape `<zx-diagram>`'s `edgeColors` takes.
 *  Partial, since naming one kind shouldn't mean restating the others. */
export type EdgeColors = Partial<Record<DiagramEdgeKind, string>>

/** Which palette entry each wire kind is painted with — the pyzx key names,
 *  which is why the override map is keyed by kind instead. This is the one
 *  place the mapping lives: `edgeColor` reads it and {@link withEdgeColors}
 *  writes through it, so an override lands on exactly the entry the lookup
 *  will come back for. */
const EDGE_KEY: Record<DiagramEdgeKind, string> = {
  simple: 'edge',
  hadamard: 'Hedge',
  'w-io': 'Xedge',
}

/** Colour for an edge — the wire the graph view strokes, and the dot the
 *  hypergraph view draws in its place. */
export function edgeColor(kind: DiagramEdgeKind, colors: Record<string, string>): string {
  return colors[EDGE_KEY[kind]] ?? colors.edge
}

/**
 * A palette with per-kind wire colours folded in.
 *
 * The overrides go into the palette rather than to each painter, so they ride
 * the one `edgeColor` lookup both views already share: the wire in the diagram
 * and the dot standing for that same wire in the dual cannot come out
 * different colours. It is the reason these lookups live here at all.
 */
export function withEdgeColors(
  colors: Record<string, string>,
  overrides: EdgeColors | null | undefined,
): Record<string, string> {
  if (!overrides) return colors
  const merged = { ...colors }
  for (const [kind, color] of Object.entries(overrides)) {
    const key = EDGE_KEY[kind as DiagramEdgeKind]
    if (key && color) merged[key] = color
  }
  return merged
}

/** Pauli-web strand colour. `I` has no palette entry — pyzx draws identity
 *  strands in a flat grey. */
export function webColor(kind: 'X' | 'Y' | 'Z' | 'I', colors: Record<string, string>): string {
  switch (kind) {
    case 'Y':
      return colors.Ydark
    case 'Z':
      return colors.Zdark
    case 'I':
      return '#dddddd'
    default:
      return colors.Xdark
  }
}
