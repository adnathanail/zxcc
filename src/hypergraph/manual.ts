// The second way to a `HypergraphScene`: a hypergraph written out by hand.
//
//   HypergraphInput --manualScene()--> HypergraphScene --<zx-hypergraph-viewer>--> SVG
//
// `./layout.ts` derives the dual of a ZX diagram and takes every dot's position
// from where that diagram was laid out. Here there is no diagram — the caller
// says what the hypergraph is and which grid square each dot goes in, and this
// scales that grid to pixels and measures a canvas around it. The scene the two
// produce is the same shape, so they paint through the same viewer.
//
// The grid is the one `layout()` puts a diagram on: a column and a qubit per
// mark, one `scale` apart in either direction. Positions arrive that way rather
// than in pixels so that `scale` means the same thing on this side as on the
// other — the whole drawing grows and shrinks with it, rather than the marks
// growing on a canvas that stays put.
//
// The hypergraph the caller writes is still a ZX diagram in dual clothing:
// every wire is held by exactly two hyperedge ends, because a wire stands for
// an edge and an edge has two. That is checked rather than assumed — a dot's
// `src` and `tgt` *are* those two hyperedges, so a wire held by three has no
// answer to give the selection, which states everything in the diagram's terms.

import type { DiagramEdgeKind } from '../types'
import { sceneMetrics } from './layout'
import type {
  HyperedgeKind,
  HypergraphBlob,
  HypergraphDot,
  HypergraphInput,
  HypergraphScene,
} from './types'

/** The blob shapes there are, as values rather than as a type, so an input
 *  arriving from JavaScript can be checked against them. */
const KINDS: HyperedgeKind[] = ['z-spider', 'x-spider', 'hadamard', 'boundary']

/** What a blob is called when the input doesn't say. A boundary gets nothing:
 *  the letters are the node's type, and the thing a boundary would be called —
 *  `in` or `out` — is which end of the diagram it is, which a hypergraph on its
 *  own has no way of knowing. */
const DEFAULT_NAME: Record<HyperedgeKind, string> = {
  'z-spider': 'Z',
  'x-spider': 'X',
  hadamard: 'H',
  boundary: '',
}

/** Room under the lowest dot for the wire id `show-labels` writes 11px beneath
 *  it, so a label is inside the canvas rather than clipped by its edge. */
const LABEL_ROOM = 14

/** The same at the top, for a blob's caption: it is parked 5px above the
 *  outline, which itself stands `blobRadius` off the highest dot the blob
 *  holds, and is written in an 11px font going up from there. */
const CAPTION_ROOM = 16

/** The strip left below all of that, which the trespass tally is written
 *  across. `layout()` leaves one for the scalar and the derived scene inherits
 *  it; a hand-written hypergraph has no scalar and would otherwise have nowhere
 *  to put the count. */
const TALLY_STRIP = 24

/**
 * Measure a hand-written hypergraph into a scene the viewer can paint.
 *
 * `scale` is pixels per column and per qubit, the same thing it is to
 * `<zx-diagram>`: it sets where the dots land as well as how big one is drawn
 * and how far a blob's outline stands off the dots it holds, so the drawing
 * comes out at one size or another without anything in the input changing.
 *
 * Throws, naming the wire or hyperedge at fault, rather than drawing something
 * the input doesn't describe: an unknown blob kind would otherwise come out the
 * colour of a boundary, and a wire held by the wrong number of hyperedges would
 * come out as a dot whose ends are a guess.
 */
export function manualScene(input: HypergraphInput, scale: number): HypergraphScene {
  const { dotSize, blobRadius } = sceneMetrics(scale)
  const ends = holders(input)

  input.wires.forEach((wire, i) => {
    if (!Number.isFinite(wire.col) || !Number.isFinite(wire.qubit)) {
      throw new Error(
        `Hypergraph input: wire ${i} sits at column ${wire.col}, qubit ${wire.qubit}, ` +
          `and both have to be numbers — they are grid coordinates, ` +
          `which \`scale\` turns into pixels.`,
      )
    }
  })

  // The grid is read relative to its own lowest column and qubit, so where it
  // starts doesn't matter: negative coordinates, and fractional ones, are
  // positions like any other.
  const cols = span(input.wires.map(w => w.col))
  const qubits = span(input.wires.map(w => w.qubit))

  // One scale of padding on every side, as `layout()` leaves around a diagram,
  // but never less than what is drawn *outside* the dots: a blob's outline
  // stands `blobRadius` off the dot it rings, its caption goes above that, and
  // the wire id `show-labels` writes goes below. At a small scale those two
  // fixed text rooms are the larger of the pair, since they are a font size
  // rather than a fraction of the grid.
  const padX = Math.max(scale, blobRadius)
  const padTop = Math.max(scale, blobRadius + CAPTION_ROOM)
  const padBottom = Math.max(scale, blobRadius + LABEL_ROOM)

  const dots: HypergraphDot[] = input.wires.map((wire, i) => ({
    id: `w${i}`,
    x: (wire.col - cols.min) * scale + padX,
    y: (wire.qubit - qubits.min) * scale + padTop,
    kind: (wire.kind ?? 'simple') as DiagramEdgeKind,
    // A dot is the wire it stands for, and a selection names that wire by its
    // index — the same index the caller listed it at. The hyperedges holding it
    // are its ends, which is what `src` and `tgt` mean in a derived scene.
    edge: i,
    src: ends[i][0],
    tgt: ends[i][1],
  }))

  const blobs: HypergraphBlob[] = input.hyperedges.map((edge, j) => ({
    id: `e${j}`,
    nodeId: j,
    kind: edge.kind,
    name: edge.name ?? DEFAULT_NAME[edge.kind],
    phase: edge.phase ?? '',
    // Deduplicated, so a self-loop — the same wire at both of a hyperedge's
    // ends — is the one dot it is drawn as.
    dots: [...new Set(edge.wires)].map(i => `w${i}`),
  }))

  return {
    dots,
    blobs,
    width: (cols.max - cols.min) * scale + 2 * padX,
    height: (qubits.max - qubits.min) * scale + padTop + padBottom + TALLY_STRIP,
    scale,
    dotSize,
    blobRadius,
  }
}

/** The range a set of grid coordinates covers, and `0` to `0` for a hypergraph
 *  with no wires in it — which is empty rather than wrong, and would otherwise
 *  measure a canvas of `Infinity`. */
function span(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * The hyperedges holding each wire, one entry per *end* — so a self-loop's
 * hyperedge appears twice, exactly as it does in the list the caller wrote.
 *
 * This is where the input is checked, because every way it can be wrong shows
 * up as a count that isn't two: a wire nobody holds, a wire held once, and a
 * wire held by three hyperedges are all diagrams the ZX half of the package
 * couldn't have produced.
 */
function holders(input: HypergraphInput): number[][] {
  const ends: number[][] = input.wires.map(() => [])

  input.hyperedges.forEach((edge, j) => {
    if (!KINDS.includes(edge.kind)) {
      throw new Error(
        `Hypergraph input: hyperedge ${j} has kind '${edge.kind}', ` +
          `expected one of ${KINDS.join(', ')}.`,
      )
    }
    if (edge.wires.length === 0) {
      throw new Error(
        `Hypergraph input: hyperedge ${j} holds no wires, so there is nothing to draw around.`,
      )
    }
    for (const i of edge.wires) {
      if (!Number.isInteger(i) || i < 0 || i >= input.wires.length) {
        throw new Error(
          `Hypergraph input: hyperedge ${j} holds wire ${i}, ` +
            `but the input has ${input.wires.length} wires.`,
        )
      }
      ends[i].push(j)
    }
  })

  ends.forEach((holding, i) => {
    if (holding.length !== 2) {
      throw new Error(
        `Hypergraph input: wire ${i} is held by ${holding.length} hyperedge ` +
          `end${holding.length === 1 ? '' : 's'}, and every wire is held by exactly two — one ` +
          `per end of the edge it stands for, or the same hyperedge twice for a self-loop.`,
      )
    }
  })

  return ends
}
