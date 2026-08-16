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

/** @deprecated use {@link ORIGINAL_COLORS}. */
export const COLORS = ORIGINAL_COLORS

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

/** Colour for an edge — the wire the graph view strokes, and the dot the
 *  hypergraph view draws in its place. */
export function edgeColor(kind: DiagramEdgeKind, colors: Record<string, string>): string {
  switch (kind) {
    case 'hadamard':
      return colors.Hedge
    case 'w-io':
      return colors.Xedge
    default:
      return colors.edge
  }
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
