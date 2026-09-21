# Docs

Start here. Each file answers one question.

| File                                 | Question it answers                                                                           | Read it when                                           |
| ------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [GAME-DESIGN.md](GAME-DESIGN.md)     | What is the game and what are its rules?                                                      | Before touching anything in `client/src/game`          |
| [PHASE-1.md](PHASE-1.md)             | What does Phase 1 deliver, which decisions were made, and why?                                | To understand scope and the milestones                 |
| [PHASE-1-BUILD.md](PHASE-1-BUILD.md) | Exactly how to build M2 to M5: files, signatures, rules, tests                                | While implementing; follow it in order                 |
| [PHASE-2.md](PHASE-2.md)             | What does Phase 2 deliver (Hebrew, play-first, tutorial, workshop reveal, analytics) and why? | To understand the conversion work                      |
| [PHASE-2-BUILD.md](PHASE-2-BUILD.md) | Exactly how to build M6: files, strings, flow, analytics, tests                               | While implementing M6; follow it in order              |
| [ARCHITECTURE.md](ARCHITECTURE.md)   | How client, server, database and Vercel fit together                                          | Before changing anything outside the game folder       |
| [API.md](API.md)                     | Every HTTP route, request and response                                                        | When touching `services/api.ts` or `server/src/routes` |
| [DEPLOY.md](DEPLOY.md)               | Where it runs, how a deploy happens, what to do when it breaks                                | After pushing; when production misbehaves              |
| [PHASE-0.md](PHASE-0.md)             | What the foundation is, what was reused, what was deferred                                    | For history                                            |

Also read `../CLAUDE.md` (rules for Claude Code sessions) and `../README.md`
(how to run it).

## Status

| Milestone                     | State | Where to look                        |
| ----------------------------- | ----- | ------------------------------------ |
| Phase 0 - foundation          | done  | PHASE-0.md                           |
| M1 - hosted on Vercel         | done  | PHASE-1.md, DEPLOY.md                |
| M2 - engine with tests        | done  | PHASE-1-BUILD.md, section M2         |
| M3 - playable on PC and phone | done  | PHASE-1-BUILD.md, section M3         |
| M4 - scores and leaderboards  | done  | PHASE-1-BUILD.md, section M4, API.md |
| M5 - polish and hand-over     | done  | PHASE-1-BUILD.md, section M5         |
| M6 - conversion foundation    | done  | PHASE-2-BUILD.md, section M6         |
| M7 - replay and identity      | done  | PHASE-2-BUILD.md, section M7         |
| M8 - character polish         | next  | PHASE-2-BUILD.md, section M8         |

Production: <https://rhythm-runner-eight.vercel.app>
