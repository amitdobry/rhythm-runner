/**
 * Where the workshop button goes. One constant, so the whole app agrees.
 *
 * The leaflet marker travels with the visitor: the landing page hands it to
 * the game, and the game hands it back, so Amit can tell which printed leaflet
 * brought which parent. The landing page understands both spellings.
 */

export const WORKSHOP_URL = 'https://amitdobry.github.io/workshop/';

export function workshopLink(ref: string): string {
  if (!ref) return `${WORKSHOP_URL}#contact`;
  // 'B3' is the older leaflet scheme, written back the way it arrived.
  if (/^B[1-6]$/.test(ref)) return `${WORKSHOP_URL}?b=${ref.slice(1)}#contact`;
  return `${WORKSHOP_URL}?ref=${ref}#contact`;
}
