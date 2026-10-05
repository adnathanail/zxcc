// The one way to a `HypergraphScene`: measure a `HypergraphInput` into pixels
// the viewer can paint.
//
//   HypergraphInput --hypergraphScene()--> HypergraphScene
//                   --<zx-hypergraph-viewer>--> SVG
//
// Both routes into the view arrive here. A caller writing a hypergraph out by
// hand puts every dot in a grid square; `./layout.ts` derives the dual of a ZX
// diagram and gives every dot the pixel position of the wire it stands for.
// What the two have in common — the checks, the dot and blob weights, and the
// canvas — is here, so a hand-written drawing and a derived one come out at the
// same weights at the same scale.
//
// The grid is the one `layout()` puts a diagram on: a column and a qubit per
// mark, `GRID_STEP` scales apart in either direction. Positions arrive that way
// rather than in pixels so that `scale` means the same thing on this side as on
// the other — the whole drawing grows and shrinks with it. A pixel-positioned
// input has had that decided for it already, so there `scale` sets the weights
// alone.
//
// Three rules are enforced, and they are what make this the dual of a ZX
// diagram rather than a hypergraph in general: every wire is positioned the
// same way as every other, every id is distinct, and every wire is held by one
// or two ends.

import type { DiagramEdgeKind } from '../types'
import { sceneMetrics } from './layout'
import type {
  HyperedgeKind,
  HypergraphBlob,
  HypergraphDot,
  HypergraphInput,
  HypergraphInputPixelWire,
  HypergraphInputWire,
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

/** How far apart neighbouring columns (and qubits) are drawn, in `scale`s. The
 *  dual needs more room than the diagram it stands for: every mark carries a
 *  blob's outline standing `blobRadius` off it, so two dots a single scale
 *  apart come out with their blobs all but touching. `./layout.ts`'s `ZOOM` is
 *  the same allowance for a derived scene. */
const GRID_STEP = 2

/** Room under the lowest dot for the wire id `show-labels` writes 11px beneath
 *  it, so a label is inside the canvas rather than clipped by its edge. */
const LABEL_ROOM = 14

/** The same at the top, for a blob's caption: it is parked 5px above the
 *  outline, which itself stands `blobRadius` off the highest dot the blob
 *  holds, and is written in an 11px font going up from there. */
const CAPTION_ROOM = 16

/** The strip left below all of that, which the trespass tally is written
 *  across. A derived scene inherits one from the scalar's; an input measured
 *  here has no scalar, so it needs its own. */
const TALLY_STRIP = 24

/** Whether a wire is positioned in pixels rather than on the grid. Asked of the
 *  value rather than trusted from the type, since an input may arrive from
 *  JavaScript. */
function isPixelWire(wire: HypergraphInputWire): wire is HypergraphInputPixelWire {
  return wire.x !== undefined || wire.y !== undefined
}

/**
 * Measure a hypergraph into a scene the viewer can paint.
 *
 * `scale` is the ZX layout's own unit, the same thing it is to `<zx-diagram>`:
 * it sets how big a dot is drawn and how far a blob's outline stands off the
 * dots it holds. For a grid-positioned input it also sets where the dots land,
 * `GRID_STEP` of them to a column, so the whole drawing comes out at one size
 * or another without anything in the input changing. For a pixel-positioned one
 * the positions are already fixed and it sets the weights alone.
 *
 * Throws, naming the wire or hyperedge at fault, rather than drawing something
 * the input doesn't describe: an unknown blob kind would come out the colour of
 * a boundary, and a wire held by three hyperedges a dot whose ends are a
 * guess.
 */
export function hypergraphScene(input: HypergraphInput, scale: number): HypergraphScene {
  const { dotSize, blobRadius } = sceneMetrics(scale)
  const wireIds = selectionIds(
    input.wires.map(w => w.id),
    'wire',
  )
  const blobIds = selectionIds(
    input.hyperedges.map(e => e.id),
    'hyperedge',
  )
  const ends = holders(input, blobIds, boundaryIds(input, blobIds))

  const pixel = placement(input.wires)
  // One `scale` of padding a side, as `layout()` leaves around a diagram, but
  // never less than what is drawn *outside* the dots: a blob's outline stands
  // `blobRadius` off the dot it rings, its caption goes above that, and the
  // wire id `show-labels` writes goes below. The two text allowances are a font
  // size rather than a fraction of the grid, so at a small scale they win.
  const padX = Math.max(scale, blobRadius)
  const padTop = Math.max(scale, blobRadius + CAPTION_ROOM)
  const padBottom = Math.max(scale, blobRadius + LABEL_ROOM)

  const step = scale * GRID_STEP
  // The grid is read relative to its own lowest column and qubit, so negative
  // and fractional coordinates are positions like any other. Pixel coordinates
  // are used as they stand: subtracting an origin or adding padding would slide
  // the drawing off the diagram it was pinned to.
  const cols = span(input.wires.map(w => w.col ?? 0))
  const qubits = span(input.wires.map(w => w.qubit ?? 0))

  const dots: HypergraphDot[] = input.wires.map((wire, i) => ({
    id: `w${wireIds[i]}`,
    x: pixel ? (wire.x as number) : ((wire.col as number) - cols.min) * step + padX,
    y: pixel ? (wire.y as number) : ((wire.qubit as number) - qubits.min) * step + padTop,
    kind: (wire.kind ?? 'simple') as DiagramEdgeKind,
    // A dot is the wire it stands for, and a selection names that wire by the
    // id the caller gave it. `src` and `tgt` are what is at its two ends, drawn
    // or not; a wire with a single end has that one in both, there being no
    // second to name.
    edge: wireIds[i],
    src: ends[i][0],
    tgt: ends[i][1] ?? ends[i][0],
  }))

  const blobs: HypergraphBlob[] = input.hyperedges.map((edge, j) => ({
    id: `e${blobIds[j]}`,
    nodeId: blobIds[j],
    kind: edge.kind,
    name: edge.name ?? DEFAULT_NAME[edge.kind],
    phase: edge.phase ?? '',
    // Deduplicated, so a self-loop — the same wire at both of a hyperedge's
    // ends — is the one dot it is drawn as.
    dots: [...new Set(edge.wires)].map(i => `w${wireIds[i]}`),
  }))

  // A canvas the input gave is used as it stands. `layoutHypergraph` measures
  // the dual's from the ZX layout's own rather than from the dots, which is
  // what makes the pair the same size in a `both` mode.
  const width =
    input.width ??
    (pixel
      ? dots.reduce((w, d) => Math.max(w, d.x + padX), 0)
      : (cols.max - cols.min) * step + 2 * padX)
  const height =
    input.height ??
    (pixel
      ? dots.reduce((h, d) => Math.max(h, d.y + padBottom), 0) + TALLY_STRIP
      : (qubits.max - qubits.min) * step + padTop + padBottom + TALLY_STRIP)

  return { dots, blobs, width, height, scale, dotSize, blobRadius }
}

/** The range a set of grid coordinates covers, and `0` to `0` for a hypergraph
 *  with no wires in it — which is empty rather than wrong, and would otherwise
 *  measure a canvas of `Infinity`. */
function span(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * What a selection names each wire (or hyperedge) by: the id the caller gave
 * it, or its position in the list.
 *
 * Uniqueness is checked because the ids are what everything downstream refers
 * to a mark by — the dot's `src` and `tgt`, the blob's `dots`, and the
 * `zx-selection` event — so two marks answering to one id are two marks the
 * drawing cannot tell apart.
 */
function selectionIds(given: (number | undefined)[], what: string): number[] {
  const ids = given.map((id, i) => id ?? i)
  const seen = new Map<number, number>()
  ids.forEach((id, i) => {
    if (!Number.isFinite(id)) {
      throw new Error(`Hypergraph input: ${what} ${i} has id ${id}, which has to be a number.`)
    }
    const first = seen.get(id)
    if (first !== undefined) {
      throw new Error(
        `Hypergraph input: ${what}s ${first} and ${i} both have id ${id}, and an id is ` +
          `what a selection names a ${what} by, so they have to be distinct.`,
      )
    }
    seen.set(id, i)
  })
  return ids
}

/**
 * Which of the two ways the wires are positioned, having checked they all agree
 * and that each one is complete.
 *
 * A grid coordinate is measured from the input's own lowest column and a pixel
 * coordinate from the canvas's corner, so an input mixing them has two origins
 * and no single drawing. Half a coordinate is no position at all: the missing
 * half would silently become 0.
 */
function placement(wires: HypergraphInputWire[]): boolean {
  let pixel: boolean | null = null
  wires.forEach((wire, i) => {
    const here = isPixelWire(wire)
    // Checked rather than left to the type, whose `never`s don't reach an input
    // written in JavaScript: a wire carrying both pairs would be drawn at its
    // pixels with its grid square silently dropped.
    const { col, qubit, x, y } = wire as Partial<Record<'col' | 'qubit' | 'x' | 'y', number>>
    if (here && (col !== undefined || qubit !== undefined)) {
      throw new Error(
        `Hypergraph input: wire ${i} sits at column ${col}, qubit ${qubit} and at ` +
          `x ${x}, y ${y}, and a wire is positioned either on the grid (\`col\` and ` +
          `\`qubit\`) or in pixels (\`x\` and \`y\`), not both.`,
      )
    }
    const [a, b] = here ? [wire.x, wire.y] : [wire.col, wire.qubit]
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error(
        `Hypergraph input: wire ${i} sits at ${here ? `x ${wire.x}, y ${wire.y}` : `column ${wire.col}, qubit ${wire.qubit}`}, ` +
          `and a wire is positioned either on the grid (\`col\` and \`qubit\`) or in ` +
          `pixels (\`x\` and \`y\`) — both numbers, and one pair or the other.`,
      )
    }
    if (pixel !== null && pixel !== here) {
      throw new Error(
        `Hypergraph input: wire ${i} is positioned in ${here ? 'pixels' : 'grid squares'} and an ` +
          `earlier wire in ${here ? 'grid squares' : 'pixels'}. The two are measured from ` +
          `different origins, so one input can't use both.`,
      )
    }
    pixel = here
  })
  return pixel ?? false
}

/**
 * What is at each wire's ends, by selection id and one entry per *end* — so a
 * self-loop's hyperedge appears twice, exactly as it does in the list the
 * caller wrote.
 *
 * Boundaries count alongside hyperedges. Nothing is drawn for one, but a dot
 * answers a press with the ends of its wire rather than with the blobs around
 * it, so an end that is named is an end it can answer with. That is what keeps
 * a leg reachable from a selection of its own input once the boundary blobs
 * have been dropped, and what keeps an identity wire — both of whose ends are
 * boundaries — held at all.
 *
 * Every remaining way the input can be wrong shows up as a count that isn't one
 * or two, so the checks live here: a wire with nothing at either end, and a
 * wire held by three, which is a diagram the ZX half of the package couldn't
 * have produced. One end is legitimate — whatever is at the other end is
 * neither drawn nor named.
 */
function holders(input: HypergraphInput, blobIds: number[], boundaries: number[]): number[][] {
  const ends: number[][] = input.wires.map(() => [])
  const wireIndex = (i: number, whose: string) => {
    if (!Number.isInteger(i) || i < 0 || i >= input.wires.length) {
      throw new Error(
        `Hypergraph input: ${whose} holds wire ${i}, ` +
          `but the input has ${input.wires.length} wires.`,
      )
    }
  }

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
      wireIndex(i, `hyperedge ${j}`)
      ends[i].push(blobIds[j])
    }
  })

  // A boundary is an end the drawing doesn't show. It is checked the same way,
  // a wire index out of range being the same mistake wherever it is written.
  input.boundaries?.forEach((boundary, k) => {
    for (const i of boundary.wires) {
      wireIndex(i, `boundary ${k}`)
      ends[i].push(boundaries[k])
    }
  })

  ends.forEach((holding, i) => {
    if (holding.length < 1 || holding.length > 2) {
      throw new Error(
        `Hypergraph input: wire ${i} is held by ${holding.length} ` +
          `end${holding.length === 1 ? '' : 's'}, and every wire is held by one or two — one ` +
          `per end of the edge it stands for, or the same hyperedge twice for a self-loop. A ` +
          `boundary left out of \`hyperedges\` counts as an end if it is named in ` +
          `\`boundaries\`, which is how a leg keeps both of its ends when its blob isn't drawn.`,
      )
    }
  })

  return ends
}

/**
 * The ids of the boundaries that aren't drawn, checked against the hyperedges'.
 *
 * Said outright rather than taken from a position, unlike a hyperedge's: a
 * position in `boundaries` is not a position in `hyperedges`, and the two lists
 * share one pool of ids, so a default would collide as often as not. Checked
 * against the drawn ids for the reason two hyperedges can't share one — an id
 * is what a selection names a mark by, and a boundary answering to a blob's id
 * would put that blob at the end of a wire it has nothing to do with.
 */
function boundaryIds(input: HypergraphInput, blobIds: number[]): number[] {
  const seen = new Map<number, string>(blobIds.map((id, j) => [id, `hyperedge ${j}`]))
  return (input.boundaries ?? []).map((boundary, k) => {
    if (!Number.isFinite(boundary.id)) {
      throw new Error(
        `Hypergraph input: boundary ${k} has id ${boundary.id}, which has to be a number — ` +
          `an id is what a selection names a mark by, and a boundary says its own rather than ` +
          `taking it from its position.`,
      )
    }
    const clash = seen.get(boundary.id)
    if (clash !== undefined) {
      throw new Error(
        `Hypergraph input: boundary ${k} and ${clash} both have id ${boundary.id}, and an id ` +
          `is what a selection names a mark by, so they have to be distinct.`,
      )
    }
    seen.set(boundary.id, `boundary ${k}`)
    return boundary.id
  })
}
