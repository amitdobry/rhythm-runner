import { describe, it, expect } from 'vitest';
import { readMarker } from './analytics';
import { WORKSHOP_URL, workshopLink } from '../text/links';

/**
 * The leaflet marker is defined by the landing page. These tests pin the rules
 * the game copies, so the two never drift apart and a printed QR code keeps
 * being credited to the right leaflet.
 */
describe('readMarker', () => {
  it('takes ?ref and writes it in capitals', () => {
    expect(readMarker('?ref=leaf5')).toBe('LEAF5');
  });

  it('understands the older ?b spelling as B + the number', () => {
    expect(readMarker('?b=3')).toBe('B3');
  });

  it('ignores a code that is too short to be a leaflet', () => {
    expect(readMarker('?ref=x')).toBe('');
  });

  it('ignores a leaflet number that was never printed', () => {
    expect(readMarker('?b=9')).toBe('');
  });

  it('prefers ref when both are given', () => {
    expect(readMarker('?ref=LEAF2&b=3')).toBe('LEAF2');
  });

  it('treats no query string as no marker', () => {
    expect(readMarker('')).toBe('');
  });
});

describe('workshopLink', () => {
  it('goes straight to the form when nobody came from a leaflet', () => {
    expect(workshopLink('')).toBe(`${WORKSHOP_URL}#contact`);
  });

  it('carries the leaflet code back to the landing page', () => {
    expect(workshopLink('LEAF5')).toBe(`${WORKSHOP_URL}?ref=LEAF5#contact`);
  });

  it('writes the older scheme back the way it arrived', () => {
    expect(workshopLink('B3')).toBe(`${WORKSHOP_URL}?b=3#contact`);
  });
});
