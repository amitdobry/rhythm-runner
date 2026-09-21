import { T } from '../text/he';
import { WORKSHOP_URL, workshopLink } from '../text/links';

/**
 * The moment the game stops being only a game.
 *
 * It appears after the numbers, never over them, and it says the plain truth:
 * a person built this with AI, and that is what the workshop teaches. The
 * button carries the visitor's leaflet marker back so Amit knows which
 * printed leaflet did the work.
 */
export function WorkshopReveal({
  refCode,
  onCtaClick,
}: {
  refCode: string;
  onCtaClick: () => void;
}) {
  return (
    <section className="reveal">
      <h3>{T.revealTitle}</h3>
      <p>{T.revealBody}</p>
      {WORKSHOP_URL && (
        <a
          className="button-link primary"
          href={workshopLink(refCode)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCtaClick}
        >
          {T.revealCta}
        </a>
      )}
    </section>
  );
}
