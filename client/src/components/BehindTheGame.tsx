import { T } from '../text/he';

/**
 * The honest answer to "how was this made?", one screen long.
 *
 * This is the bridge from "that was fun" to "my child could build one too",
 * so it says what really happened and does not oversell it.
 */
export function BehindTheGame({ onClose }: { onClose: () => void }) {
  // The steps live in one string in he.ts; here they become a list.
  const steps = T.behindSteps
    .split(/(?=\d\.\s)/)
    .map((step) => step.trim())
    .filter(Boolean);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label={T.behindTitle}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{T.behindTitle}</h2>
        <ol className="behind-steps">
          {steps.map((step) => (
            <li key={step}>{step.replace(/^\d\.\s*/, '')}</li>
          ))}
        </ol>
        <p className="behind-rule">{T.behindRule}</p>
        <p>{T.behindBridge}</p>
        <button className="primary" onClick={onClose}>
          {T.behindClose}
        </button>
      </div>
    </div>
  );
}
