// The "❤️ zxcc" badge. It is drawn inside the diagram's own SVG rather than
// as HTML beside it, so it travels with the picture when the SVG is copied or
// exported, and stays put when the container scrolls.

import { type SVGTemplateResult, svg } from 'lit'

/** Padding between the attribution text and the edges of its backing chip. */
const PAD = 3

/** Anchored to the bottom-right of the diagram box. Final sizing and
 *  placement need the text to be laid out, so they happen in
 *  {@link placeAttribution} once it is on screen. */
export function attributionTemplate(width: number, height: number): SVGTemplateResult {
  const release = `https://github.com/adnathanail/zxcc/releases/tag/v${__ZXCC_VERSION__}`
  // The children of <text> run together deliberately: SVG collapses a newline
  // between two tspans into a rendered space, which would widen the badge and
  // push it off the corner.
  return svg`
    <g class="attribution">
      <rect></rect>
      <text x=${width - PAD} y=${height - PAD - 1} text-anchor="end"><tspan>❤️</tspan><a href=${release} target="_blank" rel="noopener noreferrer"><title>zxcc v${__ZXCC_VERSION__}</title><tspan dx="3">zxcc</tspan></a></text>
    </g>`
}

/**
 * Size the chip around the laid-out text and nudge the whole group so the
 * padded chip sits flush in the SVG's bottom-right corner — exact whatever the
 * font's advance widths and descender depth turn out to be.
 *
 * `getBBox` needs a rendered element: it throws in jsdom and reports zeros
 * while the SVG is detached or hidden, in which case the chip stays unsized
 * (invisible) and the text alone is shown at its unadjusted position.
 */
export function placeAttribution(group: SVGGElement, width: number, height: number): void {
  const text = group.querySelector('text')
  const chip = group.querySelector('rect')
  if (!text || !chip) return

  let box: DOMRect
  try {
    box = text.getBBox()
  } catch {
    return
  }
  if (box.width === 0) return

  const left = box.x - PAD
  const top = box.y - PAD
  const boxWidth = box.width + 2 * PAD
  const boxHeight = box.height + 2 * PAD
  chip.setAttribute('x', String(left))
  chip.setAttribute('y', String(top))
  chip.setAttribute('width', String(boxWidth))
  chip.setAttribute('height', String(boxHeight))
  group.setAttribute(
    'transform',
    `translate(${width - (left + boxWidth)},${height - (top + boxHeight)})`,
  )
}
