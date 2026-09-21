/**
 * Where the workshop button goes. One constant, so the whole app agrees.
 *
 * The leaflet's QR codes carry ?b=1..6; we hand that same batch back to the
 * landing page so Amit can tell which leaflet brought which parent.
 */

export const WORKSHOP_URL = 'https://amitdobry.github.io/';

export function workshopLink(batch: string): string {
  return `${WORKSHOP_URL}${batch ? `?b=${batch}` : ''}#signup`;
}
