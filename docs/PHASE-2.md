# Phase 2 - Making the Demo Sell

Date: 2026-09-21. Status: planned; M6 next.

Phase 1 produced a game that is fun. Phase 2 turns it into a journey: leaflet
-> first step -> emotional payoff -> "AI built this, my child can learn this"
-> parent action. It adds no gameplay systems. It adds Hebrew, an immediate
start, a playable tutorial, the workshop reveal at the emotional peak, and the
measurement to know whether any of it works.

The brainstorm that shaped this phase (from a separate model, 2026-09-21) is
summarised at the end. Its central claim, accepted: the biggest problem is
asking for a nickname before the child has played.

---

## Decisions

| Question            | Decision                                                                                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language            | **Hebrew only**, right-to-left, end to end: pages, overlays, HUD, banners, pads. The brand name "Rhythm Runner" stays Latin. No language toggle.                                                                                                      |
| First screen        | A landing page with one enormous "מתחילים!" button. No nickname before the first run.                                                                                                                                                                 |
| Identity            | Nickname is asked **after** the first run, only to save the score. Returning players use a small "כבר שיחקתי" link on the landing page.                                                                                                               |
| Tutorial            | A four-step playable practice (left, right, left, right) on the first visit; replayable from the start overlay. Never fails the child.                                                                                                                |
| Workshop reveal     | Below the results, after they animate in. Honest wording: built by Amit with AI; in the workshop children learn to build their own games and apps. Two buttons: child "עוד פעם!", parent "לפרטים והרשמה לסדנה".                                       |
| Sign-up destination | The existing landing page "בונים עם AI" (`https://amitdobry.github.io/`), its `#signup` form and WhatsApp card. One constant, `WORKSHOP_URL`; the button is hidden while it is empty. **The landing page is not published yet**; that is Amit's step. |
| Behind the game     | A one-screen panel "איך בינה מלאכותית עזרה לבנות את המשחק?" with five plain steps and one friendly rule from the engine.                                                                                                                              |
| Analytics           | Our own tiny anonymous funnel: an `events` collection, a public `POST /api/events`, a key-protected summary. No third party, no cookies for tracking, no personal data, never the nickname.                                                           |
| Leaflet link        | The leaflet's QR codes already point at the landing page with `?b=1`..`?b=6`. The landing page's third demo card sends visitors to the game with the same `?b=N`; the game sends them back to `#signup` with it. One batch scheme, end to end.        |
| Session length      | Stays 60 seconds. Measure abandonment first; a 20-second "quick run" is an M7+ experiment only if the data says so.                                                                                                                                   |
| Skips               | Rule unchanged. `run_completed` events carry the skipped count so the "strategic silence" worry can be checked with data.                                                                                                                             |
| Levels, multiplayer | Not in Phase 2. One good course sells the workshop; multiplayer is an infrastructure trap.                                                                                                                                                            |

## Milestones

### M6 - Conversion foundation

Hebrew end to end; play before nickname; four-step tutorial; results-screen
workshop reveal with the sign-up button; "behind the game" panel; anonymous
funnel analytics with a campaign parameter. Specified file by file in
`docs/PHASE-2-BUILD.md`.

Done when: a fresh phone visit to `/?b=3` reaches the results screen with taps
only, no typing; saving with a nickname puts the run on the board; the
workshop button opens the landing page's form with `?b=3`; the summary
endpoint shows the funnel for batch 3.

### M7 - Replay and social

Weekly leaderboard as the default tab with all-time second and a "resets on
Sunday" line; the player's own row visible under the top 10; personal-best
celebration; one truthful contextual challenge after each run ("320 points
from the top 10"); a shareable result card generated in the browser with
native share, download and copy-link fallbacks; nickname safety (no full
names note, a small blocklist, a removal path for Amit).

### M8 - Character polish

One memorable runner: a face, squash and stretch on perfect steps, joy at high
combo, panic at low energy, an exaggerated stumble; three colourways chosen
before a run; a finish-line climax in the last five seconds (countdown, tape,
streaks, score counting up, personal best as the largest message); more
expressive weather transitions. Still plain shapes, no sprite sheets.

### After M8, decided by the data

Quick run, second course, collectibles, group codes for a class, expert mode.

## Deferred and rejected

- English toggle: rejected for now, the audience is Israeli children and parents.
- Accounts or passwords: rejected; a four-digit device code is a later option.
- Multiplayer and live races: rejected for this phase.
- Third-party analytics or session replay: rejected; our own event log is enough.
- Music: not needed; clicks stay.

## The brainstorm, in short

Ranked by impact against effort: remove the nickname gate; Hebrew first;
workshop reveal on the results screen; anonymous funnel analytics; playable
tutorial; spectacular final five seconds; shareable result card; weekly
leaderboard; light character upgrade; contextual challenges; emoji or avatar
identity; expert mode; more levels; multiplayer. Pushbacks recorded above:
60 seconds may be long for a corridor, skips may be too forgiving, separate
PC and mobile boards are right but should not dominate the UI, a second level
is a distraction, multiplayer would be the wrong move.

## Open points for Amit

- **Publish the landing page.** Create the public repo `amitdobry.github.io`,
  push `index.html`, enable Pages. The printed QR codes depend on it.
- An `ADMIN_KEY` value to set in Vercel for the analytics summary (any long random string).
- Vercel Pro, still open from Phase 1.
