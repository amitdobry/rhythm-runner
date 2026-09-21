/** A footprint drawn with shapes, so the pads and the practice need no pictures. */
export function Footprint({ side }: { side: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 40 56"
      width="34"
      height="48"
      aria-hidden="true"
      style={{ transform: side === 'left' ? 'scaleX(-1)' : undefined }}
    >
      <ellipse cx="20" cy="34" rx="12" ry="18" fill="currentColor" />
      <circle cx="10" cy="11" r="4.5" fill="currentColor" />
      <circle cx="19" cy="7" r="4" fill="currentColor" />
      <circle cx="27" cy="9" r="3.5" fill="currentColor" />
    </svg>
  );
}
