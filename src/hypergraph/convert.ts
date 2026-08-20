// The hypergraph view of a ZX diagram: the roles of wires and spiders swap.
// Every ZX edge becomes a hypergraph *node* (a wire), and every ZX node becomes
// a *hyperedge* — the set of wires incident to it.
//
// A boundary (`input`/`output`) is incident to one wire, so its hyperedge holds
// a single dot and draws as a circle around it. Every dot is therefore in two
// blobs, one per end of the wire it stands for — except a self-loop's, whose
// two ends are the same node and which is in one.
//
// Pure and DOM-free, and the counterpart of `src/layout.ts` in this half of
// the package: `./layout.ts` is what gives the result coordinates.

import type { DiagramData, DiagramNode, Scene } from '../types'
import type { HyperedgeKind, HypergraphData, HypergraphEdge, HypergraphWire } from './types'

/**
 * Which shape — and so which palette entry — the node's blob is drawn with,
 * and the one place the hypergraph rejects a node it can't draw.
 */
function blobKind(n: DiagramNode): HyperedgeKind {
  if (n.type === 'spider') return n.color === 'X' ? 'x-spider' : 'z-spider'
  if (n.type === 'hadamard') return 'hadamard'
  if (n.type === 'input' || n.type === 'output') return 'boundary'
  throw new Error(
    `Hypergraph view: node ${n.id} is a '${n.type}', only 'spider', ` +
      `'hadamard', 'input' and 'output' nodes can be drawn as hyperedges.`,
  )
}

/** What the node is, without its phase — `Z`, `X`, `H`, or which end of the
 *  diagram a boundary is. Kept apart from the phase because the two are drawn
 *  differently: the viewer paints the name grey and the phase in the same blue
 *  `<zx-viewer>` uses, and drops the name alone when labels are off. */
function nameFor(n: DiagramNode, kind: HyperedgeKind): string {
  switch (kind) {
    case 'z-spider':
      return 'Z'
    case 'x-spider':
      return 'X'
    case 'hadamard':
      return 'H'
    default:
      return n.type === 'output' ? 'out' : 'in'
  }
}

/** The two joined back up, `Z(π/2)` — the one-string form, for a caller of
 *  `toHypergraph` that wants a label rather than the pieces. A node with no
 *  phase to show is just its name, as it is in the diagram view. */
function labelFor(name: string, phase: string): string {
  return phase ? `${name}(${phase})` : name
}

/** Convert a ZX diagram to its hypergraph dual, taking each phase from the
 *  `scene` that same diagram laid out to. Throws on a node that has no
 *  blob shape — see {@link blobKind}. */
export function toHypergraph(diagram: DiagramData, scene: Scene): HypergraphData {
  const phases = new Map<number, string>(scene.nodes.map(n => [n.id, n.text]))
  const byId = new Map<number, DiagramNode>()
  for (const n of diagram.nodes) byId.set(n.id, n)

  const hyperedges = new Map<number, HypergraphEdge>()
  for (const n of diagram.nodes) {
    const kind = blobKind(n)
    const name = nameFor(n, kind)
    const phase = phases.get(n.id) ?? ''
    hyperedges.set(n.id, {
      id: `e${n.id}`,
      nodeId: n.id,
      kind,
      name,
      phase,
      label: labelFor(name, phase),
      wires: [],
    })
  }

  const boundaryOf = (nodeId: number) => {
    const n = byId.get(nodeId)
    if (!n || (n.type !== 'input' && n.type !== 'output')) return null
    return { nodeId, kind: n.type, ioId: n.ioId }
  }

  const wires: HypergraphWire[] = diagram.edges.map((e, i) => {
    const id = `w${i}`
    // Push per endpoint, so a self-loop lands in its spider's list twice.
    hyperedges.get(e.src)?.wires.push(id)
    hyperedges.get(e.tgt)?.wires.push(id)
    const boundaries = [boundaryOf(e.src), boundaryOf(e.tgt)].filter(b => b !== null)
    return { id, src: e.src, tgt: e.tgt, kind: e.kind ?? 'simple', boundaries }
  })

  return { wires, hyperedges: [...hyperedges.values()] }
}
