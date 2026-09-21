// The course is a list of segments. The runner walks along it; when the list
// ends it starts again from the beginning, so a run never runs out of road.

import type { Segment } from './config';

export interface SegmentPosition {
  index: number; // index into config.course
  segment: Segment;
  startMeters: number; // where this segment starts, in course-loop metres
  metersIntoSegment: number;
  aheadMeters: number; // how far in front of the runner this segment starts; negative = already on it
}

/** How long one full loop of the course is. */
export function courseLengthMeters(course: Segment[]): number {
  return course.reduce((total, segment) => total + segment.lengthMeters, 0);
}

/** Which segment the runner is standing on. Distance wraps around the loop. */
export function segmentAt(distanceMeters: number, course: Segment[]): SegmentPosition {
  const loopLength = courseLengthMeters(course);
  // The modulo is written twice so a negative distance still lands inside the loop.
  const into = ((distanceMeters % loopLength) + loopLength) % loopLength;

  let startMeters = 0;
  for (let index = 0; index < course.length; index += 1) {
    const segment = course[index];
    if (into < startMeters + segment.lengthMeters) {
      const metersIntoSegment = into - startMeters;
      return { index, segment, startMeters, metersIntoSegment, aheadMeters: -metersIntoSegment };
    }
    startMeters += segment.lengthMeters;
  }

  // Only reachable through rounding at the very end of the loop: use the last segment.
  const index = course.length - 1;
  const segment = course[index];
  const lastStart = loopLength - segment.lengthMeters;
  const metersIntoSegment = into - lastStart;
  return {
    index,
    segment,
    startMeters: lastStart,
    metersIntoSegment,
    aheadMeters: -metersIntoSegment,
  };
}

/**
 * The segment the runner is on plus every segment that starts within
 * lookAheadMeters in front. The renderer uses this to draw the road ahead.
 * aheadMeters keeps growing past the end of the loop, so the road can be drawn
 * as one straight line even where the course starts again.
 */
export function upcomingSegments(
  distanceMeters: number,
  course: Segment[],
  lookAheadMeters: number
): SegmentPosition[] {
  const here = segmentAt(distanceMeters, course);
  const found: SegmentPosition[] = [here];

  // How far in front of the runner the next segment begins.
  let metersAhead = here.segment.lengthMeters - here.metersIntoSegment;

  for (let stepsAhead = 1; stepsAhead <= course.length; stepsAhead += 1) {
    if (metersAhead > lookAheadMeters) break;
    const index = (here.index + stepsAhead) % course.length;
    const segment = course[index];
    found.push({
      index,
      segment,
      startMeters: segmentStartMeters(index, course),
      metersIntoSegment: 0,
      aheadMeters: metersAhead,
    });
    metersAhead += segment.lengthMeters;
  }

  return found;
}

/** Where a segment begins, measured from the start of the loop. */
function segmentStartMeters(index: number, course: Segment[]): number {
  let start = 0;
  for (let i = 0; i < index; i += 1) start += course[i].lengthMeters;
  return start;
}
