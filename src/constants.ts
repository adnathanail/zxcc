// Constants for presentation properties: view modes, and colour palettes
//
// **This file should import nothing**
//   This is to allow it to be imported in any context (e.g. Node for SSG)

/** The values `<zx-diagram>`'s `view-mode` accepts. */
export const VIEW_MODES = ['graph', 'hypergraph', 'both-vertical', 'both-horizontal'] as const

export type ViewMode = (typeof VIEW_MODES)[number]

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
