/**
 * Your own shirt colour, worked out from your nickname.
 *
 * No picker and nothing to remember: the same name always gives the same
 * colour, on any device, so a child recognises themselves on the road the way
 * they recognise their own coat on a peg.
 */

/** Six shirts, each one readable against the grey road and the blue sky. */
export const SHIRT_COLOURS = [
  '#e8503a', // red
  '#f08a24', // orange
  '#ffd23f', // yellow
  '#3ddc84', // green
  '#4ea8ff', // blue
  '#b06ae0', // purple
];

export function colourForNickname(nickname: string | null | undefined): string {
  if (!nickname) return SHIRT_COLOURS[0];

  // A small stable hash: the multiplier keeps names that share letters apart.
  let total = 0;
  for (let i = 0; i < nickname.length; i += 1) {
    total = (total * 31 + nickname.charCodeAt(i)) % 100000;
  }
  return SHIRT_COLOURS[total % SHIRT_COLOURS.length];
}
