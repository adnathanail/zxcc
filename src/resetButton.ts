// The button that puts a dragged drawing back the way the layout left it.
// Both painters draw one, in the bottom-left corner of their own picture, and
// show it only once something in that picture has been moved — so in a `both`
// mode each view resets its own drags and nothing else.
//
// It is HTML laid over the SVG rather than drawn inside it, unlike the
// attribution badge: the badge belongs to the picture and travels with a copied
// SVG, whereas a control for the live drawing has no business in an export.
// Its look, the fade in and out, and the icon are `.reset-layout` in
// `viewerHost.ts`.

import { html, type TemplateResult } from 'lit'

/** The button, always rendered so that it can fade both ways; `shown` toggles
 *  the class the transition hangs on. A hidden one is `visibility: hidden`,
 *  which also takes it out of the tab order and out of reach of a press. */
export function resetButtonTemplate(shown: boolean, onReset: () => void): TemplateResult {
  return html`
    <button type="button" class=${shown ? 'reset-layout shown' : 'reset-layout'}
      title="Reset layout" aria-label="Reset layout" @click=${onReset}><span></span></button>
  `
}
