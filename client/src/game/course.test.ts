import { describe, it, expect } from 'vitest';
import { LEVEL_1 } from './config';
import { courseLengthMeters, segmentAt, upcomingSegments } from './course';

describe('courseLengthMeters', () => {
  it('level 1 is 410 metres long', () => {
    expect(courseLengthMeters(LEVEL_1)).toBe(410);
  });
});

describe('segmentAt', () => {
  it('starts on the first segment', () => {
    const position = segmentAt(0, LEVEL_1);
    expect(position.index).toBe(0);
    expect(position.metersIntoSegment).toBe(0);
  });

  it('stays on the first segment until its last metre', () => {
    expect(segmentAt(59.9, LEVEL_1).index).toBe(0);
  });

  it('moves to the second segment at 60 metres', () => {
    const position = segmentAt(60, LEVEL_1);
    expect(position.index).toBe(1);
    expect(position.startMeters).toBe(60);
    expect(position.metersIntoSegment).toBe(0);
  });

  it('wraps around when the course repeats', () => {
    const position = segmentAt(415, LEVEL_1);
    expect(position.index).toBe(0);
    expect(position.metersIntoSegment).toBeCloseTo(5);
  });
});

describe('upcomingSegments', () => {
  it('gives the current segment and the ones starting within the look ahead', () => {
    const found = upcomingSegments(50, LEVEL_1, 60);
    expect(found.map((position) => position.index)).toEqual([0, 1, 2]);
    expect(found[2].startMeters).toBe(100);
  });

  it('keeps counting metres forward where the course starts again', () => {
    const found = upcomingSegments(400, LEVEL_1, 100);
    expect(found.map((position) => position.index)).toEqual([8, 0, 1]);
    expect(found.map((position) => position.aheadMeters)).toEqual([-50, 10, 70]);
  });
});
