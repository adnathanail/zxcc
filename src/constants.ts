// Constants for presentation properties: view modes and colour palettes, plus
// the fixed colours that sit outside any palette and so stay put under every
// `color-scheme`. Which palette entry each kind of thing is painted with is
// `colors.ts`'s job; this is only the values.
//
// **This file should import nothing**
//   This is to allow it to be imported in any context (e.g. Node for SSG)

/** The values `<zx-diagram>`'s `view-mode` accepts. */
export const VIEW_MODES = ['graph', 'hypergraph', 'both-vertical', 'both-horizontal'] as const

export type ViewMode = (typeof VIEW_MODES)[number]

// pyzx.utils.original_colors (plus `Idark`)
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
  Idark: '#dddddd',
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

// pyzx.utils.grayscale_colors (plus `Idark`, and `Zdark` darkened to not collide)
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
  Zdark: '#aaaaaa',
  Idark: '#dddddd',
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

/** Fill for a node's vdata entries — the extra key/value lines a diagram can
 *  hang above a node. A red, so they read as annotation rather than as part of
 *  the diagram, and no palette entry, so they stay put under any
 *  `color-scheme`. */
export const VDATA_FILL = '#c66'
