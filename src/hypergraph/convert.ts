// The hypergraph view of a ZX diagram: the roles of wires and spiders swap.
// Every ZX edge becomes a hypergraph *node* (a wire), and every non-boundary
// ZX node becomes a *hyperedge* — the set of wires incident to it.
//
// Boundaries (`input`/`output`) are not hyperedges: they are just the loose
// end of a wire, so a boundary edge shows up as a wire that only one (or no)
// hyperedge contains.
//
// Pure and DOM-free, and the counterpart of `src/layout.ts` in this half of
// the package: `src/hypergraphLayout.ts` is what gives the result coordinates.

import type { DiagramData, DiagramNode } from '../types'
import type { HypergraphData, HypergraphEdge, HypergraphWire } from './types'

function labelFor(n: DiagramNode, phaseOverride?: string): string {
  const phase = phaseOverride ?? n.phase ?? '0'
  switch (n.type) {
    case 'spider':
      return `${n.color ?? 'Z'}(${phase})`
    case 'hadamard':
      return 'H'
    case 'z-box':
      return `Zbox(${phase})`
    case 'w-input':
      return 'W-in'
    case 'w-output':
      return 'W-out'
    case 'wire':
      return 'wire'
    default:
      return n.type
  }
}

/** Convert a ZX diagram to its hypergraph dual. Throws the same way `layout`
 *  does on a malformed diagram (missing `nodes`/`edges`). */
export function toHypergraph(diagram: DiagramData): HypergraphData {
  const labels = new Map<number, string>(diagram.labels ?? [])
  const byId = new Map<number, DiagramNode>()
  for (const n of diagram.nodes) byId.set(n.id, n)

  const hyperedges = new Map<number, HypergraphEdge>()
  for (const n of diagram.nodes) {
    if (n.type === 'input' || n.type === 'output') continue
    hyperedges.set(n.id, {
      id: `e${n.id}`,
      nodeId: n.id,
      label: labelFor(n, labels.get(n.id)),
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
