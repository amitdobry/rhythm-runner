import { useMemo } from 'react';

/**
 * Forty pieces of paper thrown in the air for a personal best.
 *
 * Plain elements with a CSS animation, not canvas: the game's own drawing is
 * untouched, and the browser throws this away when the results close. The
 * angles are worked out once so the burst does not change under the player.
 */
const PIECES = 40;
const COLOURS = ['#3ddc84', '#ffd23f', '#ffffff', '#4ea8ff'];

export function Celebration() {
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, index) => ({
        left: (index * 97) % 100, // spread across the width, always the same way
        colour: COLOURS[index % COLOURS.length],
        delay: (index % 8) * 0.06,
        drift: ((index % 5) - 2) * 18,
        spin: index % 2 === 0 ? 420 : -380,
      })),
    []
  );

  return (
    <div className="celebration" aria-hidden="true">
      {pieces.map((piece, index) => (
        <i
          key={index}
          style={
            {
              left: `${piece.left}%`,
              background: piece.colour,
              animationDelay: `${piece.delay}s`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
