import type { ClientModule, JsonValue, RenderNode } from 'claude-code'

// A segment of the band on the desktop, drawn by the plugin itself so a click
// swaps its figures for its detail as on the terminal: the desktop draws a
// Button as a native one, over the colors of its text. The hooks module hands
// the segment as drawn (its Text tree, as plain data), and a click posts back.

type Node = string | { type: string; props?: Record<string, JsonValue>; children?: Node[] }

// The Text styles a segment uses; nothing else of the tree is drawn again.
const STYLES = ['color', 'dimColor', 'bold', 'weight'] as const

const Segment: ClientModule<{ node: JsonValue }> = (props, surface) => {
  const { Text } = surface.elements

  surface.onPointer(e => {
    if (e.type === 'up' && e.button === 'left') surface.post({ toggle: true })
  })

  const draw = (node: Node): RenderNode => {
    if (typeof node === 'string') return node
    const style: Record<string, JsonValue> = {}
    for (const s of STYLES) if (node.props?.[s] !== undefined) style[s] = node.props[s]!
    return <Text {...style}>{(node.children ?? []).map(draw)}</Text>
  }

  return <Text>{draw(props.node as Node)}</Text>
}

export default Segment
