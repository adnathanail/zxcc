// The spleen as a ZX diagram: node positions, wires, Pauli webs, and the
// markup builder both `spleen.mjs` (the annotated plate) and `logo.mjs` (the
// mark) draw from.
//
// Everything is drawn with zxcc's own marks — pyzx's original palette, the
// viewer's shapes and text slots, and half-edge Pauli-web strands.

export const SIZE = 8 // scene.nodeSize at scale 40

export const C = {
  edge: '#000000',
  Hedge: '#0088ff',
  Xedge: '#999999',
  boundary: '#000000',
  X: '#ff8888',
  Z: '#ccffcc',
  H: '#ffff66',
  Xdark: '#ff8888',
  Zdark: '#99dd99',
  I: '#dddddd',
}
export const PHASE_FILL = '#00d'
export const LABEL_FILL = '#999'

// id: [kind, x, y, label, phase, labelAnchor]. The anchor moves a label off
// the default slot above the node, for the few that would otherwise land on a
// wire: 'below', 'left', 'left-up', 'right'.
export const nodes = {
  // capsule — a closed ring, alternating Z and X. Long axis running top to
  // bottom, notched on the superior border (n2) and cut deeply inwards on the
  // medial one, where the hilum sits (n6).
  n1: ['z', 222, 70],
  n2: ['x', 262, 104, 'notch', '', 'right'],
  n3: ['z', 296, 78],
  n4: ['x', 338, 132],
  n5: ['z', 352, 192],
  n6: ['x', 286, 236, 'hilum', '', 'left-up'],
  n7: ['z', 352, 292],
  n8: ['x', 348, 356],
  n9: ['z', 316, 412],
  n10: ['x', 262, 446, '', 'π'],
  n11: ['z', 204, 444],
  n12: ['x', 156, 410],
  n13: ['z', 128, 356],
  n14: ['x', 116, 292],
  n15: ['z', 118, 216, 'capsule', '', 'left'],
  n16: ['x', 152, 132],

  // The vessels, as boundaries, leaving through the mouth of the hilar notch.
  // The artery takes the middle of the fan: it is the one a reduced mark keeps,
  // and down the middle is the only line out of the notch that clears both
  // lips at any length.
  b1: ['boundary', 620, 238, 'splenic artery'],
  b2: ['boundary', 596, 146, 'splenic vein'],
  b3: ['boundary', 596, 332, 'efferent lymphatic', '', 'below'],

  // White pulp, hung off the trabecular artery. The trabecula sits a little
  // left of the bean's centre: its gap from the hilum is what a mark drawn
  // with big spiders runs out of first.
  hb: ['h', 222, 242],
  f1: ['z', 214, 168, 'white pulp'],
  f2: ['z', 176, 244, '', 'π/2'],
  f3: ['z', 206, 334, '', 'π/4'],

  // red pulp
  r1: ['x', 158, 178, '', 'π'],
  r2: ['x', 144, 268],
  r3: ['x', 162, 350],
  r4: ['x', 226, 396],
  r5: ['x', 268, 340, 'red pulp', '', 'right'],
  r6: ['x', 262, 158],

  // venous sinuses, draining back to the hilum
  v1: ['z', 258, 290],
  v2: ['z', 256, 194],
}

/** The capsule, in order round the organ. */
export const RING = 'n1 n2 n3 n4 n5 n6 n7 n8 n9 n10 n11 n12 n13 n14 n15 n16'.split(' ')

/** The ring reduced to what carries the silhouette: the whole medial border,
 *  where the notch and the hilum are, and the corners of the lateral one.
 *  Nodes are dropped in pairs — the ring alternates Z and X, so skipping an
 *  odd number of them would put two spiders of one colour side by side. */
export const RING_SPARSE = 'n1 n2 n3 n4 n5 n6 n7 n8 n11 n12 n15 n16'.split(' ')

/** The nodes a mark keeps at small sizes: the sparse capsule, the vessels, and
 *  the trabecula with a follicle either side of it. */
export const CORE = [...RING_SPARSE, 'b1', 'b2', 'b3', 'hb', 'f1', 'f3']

/** Sparser still, for the glyph: the notch and its two lips, the apex, and one
 *  corner apiece for the bottom and the lateral border. Eight spiders is what
 *  is left when a capsule node has to be worth a whole pixel. */
export const RING_GLYPH = 'n1 n4 n5 n6 n7 n8 n11 n14'.split(' ')

/** What the glyph keeps besides that capsule: the trabecula, and one vessel of
 *  the three — they leave the hilum within 33° of each other, so at glyph size
 *  the other two only thicken the first. */
export const GLYPH = [...RING_GLYPH, 'hb', 'b1']

/** Everything that is not the capsule ring. Ring wires are derived from
 *  whichever ring a drawing uses, so they are not listed here. */
export const EXTRA_EDGES = [
  // vessels at the hilum: artery in on a Hadamard wire, vein out on a plain
  // one, lymphatic on the grey W-io wire
  ['b1', 'n6', 'hadamard'],
  ['n6', 'b2', 'simple'],
  ['n6', 'b3', 'w-io'],

  // arterial tree — trabecular artery to the central arterioles
  ['n6', 'hb', 'hadamard'],
  ['hb', 'f1', 'hadamard'],
  ['hb', 'f2', 'hadamard'],
  ['hb', 'f3', 'hadamard'],

  // marginal zone: white pulp opening into red pulp
  ['f1', 'r6', 'simple'],
  ['f1', 'r1', 'simple'],
  ['f2', 'r1', 'simple'],
  ['f2', 'r2', 'simple'],
  ['f3', 'r3', 'simple'],
  ['f3', 'r5', 'simple'],

  // red pulp cords
  ['r1', 'r2', 'simple'],
  ['r2', 'r3', 'simple'],
  ['r3', 'r4', 'simple'],
  ['r4', 'r5', 'simple'],

  // and its attachments to the capsule
  ['r1', 'n16', 'simple'],
  ['r1', 'n15', 'simple'],
  ['r2', 'n14', 'simple'],
  ['r3', 'n13', 'simple'],
  ['r3', 'n12', 'simple'],
  ['r4', 'n11', 'simple'],
  ['r4', 'n10', 'simple'],
  ['r5', 'n9', 'simple'],
  ['r6', 'n4', 'simple'],
  ['r6', 'n2', 'simple'],

  // venous return — inwards of the hilum, so the mouth of the notch stays
  // clear for the vessels
  ['r6', 'v2', 'simple'],
  ['v2', 'n6', 'simple'],
  ['r5', 'v1', 'simple'],
  ['v1', 'n6', 'simple'],
]

/** The red pulp cords, which carry a Pauli-web strand of their own. */
export const CORD_WEB = ['r1 r2', 'r2 r3', 'r3 r4', 'r4 r5'].map(p => p.split(' '))

const EDGE_COLOR = { simple: C.edge, hadamard: C.Hedge, 'w-io': C.Xedge }
const WEB_COLOR = { I: C.I, X: C.Xdark, Z: C.Zdark }
const NODE_FILL = { z: C.Z, x: C.X, h: C.H, boundary: C.boundary }

// The label slot is the viewer's — 10px monospace grey, just above the node.
// Anywhere it would land on a wire it swings to another side of the node
// instead, keeping the same clearance.
const LABEL_SLOT = {
  above: { x: 0, y: -0.7 * SIZE - 8, anchor: 'middle' },
  below: { x: 0, y: 0.7 * SIZE + 18, anchor: 'middle' },
  left: { x: -0.7 * SIZE - 6, y: 4, anchor: 'end' },
  'left-up': { x: -0.7 * SIZE - 6, y: -8, anchor: 'end' },
  right: { x: 0.7 * SIZE + 6, y: 4, anchor: 'start' },
}

const pairs = ids => ids.map((id, i) => [id, ids[(i + 1) % ids.length], 'simple'])

/**
 * The three drawing layers, in the viewer's paint order, the box they occupy,
 * and the positions everything was drawn at.
 *
 * @param ring     which capsule nodes to run the outline through
 * @param keep     the nodes to draw; null draws every one
 * @param text     whether to write the labels and phases
 * @param stubs    boundary distance from the node it wires to, in pixels;
 *                 null leaves each vessel where the plate puts it
 * @param scale    how much heavier than the plate to draw: one multiplier for
 *                 both `weight` and `dots`, which is what a mark that has to
 *                 survive being shrunk wants. Either can still be given on its
 *                 own to override it.
 * @param weight   multiplier on every stroke width
 * @param dots     multiplier on every node's size. The node positions are
 *                 fixed, so this is what sets how much of the drawing is
 *                 spider rather than wire — a spider is 3% of the plate's
 *                 width, which is under a pixel once the mark is small. Its
 *                 ceiling is the closest pair of nodes kept: they touch once a
 *                 spider's diameter reaches the gap between their centres.
 * @param strands  whether to paint the Pauli webs
 */
export function drawing({
  ring = RING,
  keep = null,
  text = true,
  stubs = null,
  scale = 1,
  weight = scale,
  dots = scale,
  strands = true,
} = {}) {
  const size = SIZE * dots
  const kept = new Set(keep ?? Object.keys(nodes))
  const drawn = id => kept.has(id)

  const ringIds = ring.filter(drawn)
  const ringEdges = pairs(ringIds)
  const links = [...ringEdges, ...EXTRA_EDGES.filter(([a, b]) => drawn(a) && drawn(b))]

  // A vessel's stub is measured from the node it wires to, so shortening one
  // keeps its direction and drops the long run out to the plate's margin.
  const pos = new Map(Object.entries(nodes).map(([id, [, x, y]]) => [id, [x, y]]))
  if (stubs !== null) {
    for (const [a, b] of links) {
      for (const [end, anchor] of [
        [a, b],
        [b, a],
      ]) {
        if (nodes[end][0] !== 'boundary') continue
        const [ax, ay] = pos.get(anchor)
        const [ex, ey] = pos.get(end)
        const len = Math.hypot(ex - ax, ey - ay)
        pos.set(end, [ax + ((ex - ax) / len) * stubs, ay + ((ey - ay) / len) * stubs])
      }
    }
  }

  const webs = strands
    ? [
        ...ringEdges.map(([a, b]) => [a, b, 'I']),
        ...CORD_WEB.filter(([a, b]) => drawn(a) && drawn(b)).map(([a, b]) => [a, b, 'X']),
      ]
    : []

  const line = (a, b, stroke, width) => {
    const [x1, y1] = pos.get(a)
    const [x2, y2] = pos.get(b)
    return `<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="${stroke}" fill="transparent" style="stroke-width: ${width}px" />`
  }

  // A strand is a half-edge, source to midpoint, exactly as `webPath` draws
  // one; the pair of them covers the wire.
  const webPaths = webs.flatMap(([a, b, kind]) => {
    const [x1, y1] = pos.get(a)
    const [x2, y2] = pos.get(b)
    const mid = `${(x1 + x2) / 2} ${(y1 + y2) / 2}`
    return [
      `<path d="M ${x1} ${y1} L ${mid}" stroke="${WEB_COLOR[kind]}" fill="transparent" style="stroke-width: ${7 * weight}px" />`,
      `<path d="M ${x2} ${y2} L ${mid}" stroke="${WEB_COLOR[kind]}" fill="transparent" style="stroke-width: ${7 * weight}px" />`,
    ]
  })

  const linkPaths = links.map(([a, b, kind]) => line(a, b, EDGE_COLOR[kind], 1.5 * weight))

  const shape = kind => {
    const stroke = `stroke="black" style="stroke-width: ${1.5 * weight}px"`
    if (kind === 'h')
      return `<rect x="${-0.75 * size}" y="${-0.75 * size}" width="${1.5 * size}" height="${1.5 * size}" fill="${NODE_FILL.h}" ${stroke} />`
    const r = kind === 'boundary' ? 0.5 * size : size
    return `<circle r="${r}" fill="${NODE_FILL[kind]}" ${stroke} />`
  }

  const nodeGroups = Object.entries(nodes)
    .filter(([id]) => drawn(id))
    .map(([id, [kind, , , label, phase, slot = 'above']]) => {
      const [x, y] = pos.get(id)
      const parts = [shape(kind)]
      if (text && phase)
        parts.push(
          `<text y="${0.7 * SIZE + 14}" text-anchor="middle" font-size="12px" font-family="monospace" fill="${PHASE_FILL}">${phase}</text>`,
        )
      if (text && label) {
        const s = LABEL_SLOT[slot]
        parts.push(
          `<text x="${s.x}" y="${s.y}" text-anchor="${s.anchor}" font-size="10px" font-family="monospace" fill="${LABEL_FILL}">${label}</text>`,
        )
      }
      return `<g data-node="${id}" transform="translate(${x},${y})">\n${parts
        .map(p => `        ${p}`)
        .join('\n')}\n      </g>`
    })

  // The box the marks occupy: the nodes, grown by the widest thing drawn on
  // top of one — a spider's own radius, or half the strand running through it.
  const reach = Math.max(size + 0.75 * weight, strands ? 3.5 * weight : 0)
  const xs = [...kept].map(id => pos.get(id)[0])
  const ys = [...kept].map(id => pos.get(id)[1])
  const bounds = {
    x: Math.min(...xs) - reach,
    y: Math.min(...ys) - reach,
    width: Math.max(...xs) - Math.min(...xs) + 2 * reach,
    height: Math.max(...ys) - Math.min(...ys) + 2 * reach,
  }

  return { webPaths, linkPaths, nodeGroups, bounds, positions: pos }
}

/** The three layers as one block of markup, indented to sit inside an `<svg>`. */
export function layers({ webPaths, linkPaths, nodeGroups }) {
  const layer = (name, items) =>
    `  <g class="${name}">\n${items.map(s => `      ${s}`).join('\n')}\n  </g>`
  return [layer('web', webPaths), layer('link', linkPaths), layer('node', nodeGroups)].join('\n\n')
}
