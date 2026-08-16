// The hypergraph view of a ZX diagram: the roles of wires and spiders swap.
// Every ZX edge becomes a hypergraph *node* (a wire), and every non-boundary
// ZX node becomes a *hyperedge* — the set of wires incident to it.
//
// Boundaries (`input`/`output`) are not hyperedges: they are just the loose
// end of a wire, so a boundary edge shows up as a wire that only one (or no)
// hyperedge contains.
//
// Pure and DOM-free, and the counterpart of `src/layout.ts` in this half of
// the package: `./layout.ts` is what gives the result coordinates.

import type { DiagramData, DiagramNode } from '../types'
import type { HyperedgeKind, HypergraphData, HypergraphEdge, HypergraphWire } from './types'

/**
 * Which shape — and so which palette entry — the node's blob is drawn with,
 * and the one place the hypergraph rejects a node it can't draw.
 */
function blobKind(n: DiagramNode): HyperedgeKind {
  if (n.type === 'spider') return n.color === 'X' ? 'x-spider' : 'z-spider'
  if (n.type === 'hadamard') return 'hadamard'
  throw new Error(
    `Hypergraph view: node ${n.id} is a '${n.type}', only 'spider' and ` +
      `'hadamard' nodes can be drawn as hyperedges. ` +
      `('input' and 'output' are fine: they are wires, not hyperedges.)`,
  )
}

/** What the node is, without its phase — `Z`, `X`, `H`. Kept apart from the
 *  phase because the two are drawn differently: the viewer paints the name grey
 *  and the phase in the same blue `<zx-viewer>` uses, and drops the name alone
 *  when labels are off. */
const NAMES: Record<HyperedgeKind, string> = {
  'z-spider': 'Z',
  'x-spider': 'X',
  hadamard: 'H',
}

/** The two joined back up, `Z(π/2)` — the one-string form, for a caller of
 *  `toHypergraph` that wants a label rather than the pieces. A node with no
 *  phase to show is just its name, as it is in the diagram view. */
function labelFor(name: string, phase: string): string {
  return phase ? `${name}(${phase})` : name
}

/** The phase on its own, the way `layout()` fills `SceneNode.text` — H-box π
 *  convention included, and empty for anything that carries no phase. The
 *  hypergraph keeps it apart from the label so that turning labels off hides
 *  the name and not the phase, as it does in the diagram view. */
function phaseFor(n: DiagramNode, kind: HyperedgeKind, phaseOverride?: string): string {
  if (phaseOverride !== undefined) return phaseOverride
  if (kind !== 'hadamard') return n.phase ?? ''
  const raw = n.phase ?? 'π'
  return raw === 'π' ? '' : raw
}

/** Convert a ZX diagram to its hypergraph dual. Throws the same way `layout`
 *  does on a malformed diagram (missing `nodes`/`edges`), and on a non-boundary
 *  node that is neither a spider nor a Hadamard — see {@link blobKind}. */
export function toHypergraph(diagram: DiagramData): HypergraphData {
  const labels = new Map<number, string>(diagram.labels ?? [])
  const byId = new Map<number, DiagramNode>()
  for (const n of diagram.nodes) byId.set(n.id, n)

  const hyperedges = new Map<number, HypergraphEdge>()
  for (const n of diagram.nodes) {
    if (n.type === 'input' || n.type === 'output') continue
    const kind = blobKind(n)
    const name = NAMES[kind]
    const phase = phaseFor(n, kind, labels.get(n.id))
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
