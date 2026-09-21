# Game Design - Rhythm Runner, level one

The rules of the game in plain words. Numbers in **bold** live in
`client/src/game/config.ts` and are meant to be changed.

## One sentence

You are a runner with two feet. Step left, right, left, right at the pace the
road asks for. Hills, water and weather change that pace. Keep it, and you run
far in **60 seconds**; lose it, and you slow down and tire out.

## What you see

- The runner stays in one place on the left. The world moves past: sky and
  buildings slowly, pavement and lamp posts faster, the road fastest.
- The road ahead shows what is coming: a slope up, a slope down, a stretch of
  water. Rain streaks or wind lines tell you the weather.
- Under the runner, two footprints. The one that pulses is the foot that should
  land next; the ring shrinking around it says _when_.
- At the top: time left, a speed bar, an energy bar, your combo with its
  multiplier, your score, and a pace meter with "too fast" on one side and
  "too slow" on the other.

## What you do

The runner has two feet, and so do you. Steps alternate: left, right, left,
right. Step with the foot that pulses.

|            | On a PC                                         | On a phone                      |
| ---------- | ----------------------------------------------- | ------------------------------- |
| Left foot  | `←` or `F`, or click the left half of the game  | the big left pad at the bottom  |
| Right foot | `→` or `J`, or click the right half of the game | the big right pad at the bottom |
| Hold it    | landscape                                       | upright, thumbs on the pads     |

### Why a phone is a different game

A thumb on glass arrives later and less precisely than a finger on a key. So on
a phone the timing windows are wider (**80 ms** Perfect, **160 ms** Good
instead of **60** and **120**), and PC and phone scores go on separate
leaderboards. The game detects the device; a small PC / Mobile toggle before
the run lets you override it.

## The pace

There is no fixed beat. Each step is due a certain time after your last step.
On a flat road in clear weather that time is **600 ms**, one hundred steps a
minute. The ground and the weather stretch or shrink it:

| Ground   | Steps are...        | Pace factor | Extra energy per step |
| -------- | ------------------- | ----------- | --------------------- |
| Flat     | steady              | **x1.0**    | 0                     |
| Uphill   | slower and stronger | **x1.3**    | **1**                 |
| Downhill | quicker             | **x0.8**    | 0                     |
| Water    | big and slow        | **x1.5**    | **2**                 |

| Weather | Effect                          | Pace factor | Other                       |
| ------- | ------------------------------- | ----------- | --------------------------- |
| Clear   | none                            | **x1.0**    |                             |
| Rain    | slippery, careful steps         | **x1.15**   | **1** extra energy per step |
| Wind    | headwind, you lose speed faster | **x1.1**    | speed drains **x1.5**       |

The factors multiply. Uphill in the rain: 600 x 1.3 x 1.15 = 897 ms between
steps. Downhill in the wind: 600 x 0.8 x 1.1 = 528 ms. Finding the right
"cocktail" for each stretch is the game.

When you cross into a new stretch, a banner names it ("Uphill! Slow, strong
steps") and the next step you take is already judged at the new pace. Read the
road ahead and be ready.

## How a step is judged

Measured against the moment your step was due:

| Your step                         | Result     | What happens                                       |
| --------------------------------- | ---------- | -------------------------------------------------- |
| within **60 ms** (phone **80**)   | Perfect    | speed **+2**, energy **+3**, combo +1              |
| within **120 ms** (phone **160**) | Good       | speed **+1**, combo +1                             |
| earlier than that                 | Too fast   | speed **-3**, energy **-10**, combo back to 0      |
| later than that                   | Too slow   | same as Too fast                                   |
| the other foot                    | Wrong foot | same as Too fast                                   |
| you did not step in time          | Skipped    | combo back to 0, the beat passes to the other foot |

Every step also costs the ground and weather energy from the tables above.

After a stumble (see Energy) you get a fresh start: the next step is due one
pace interval after you get up.

## Speed

Starts at **4** metres per second, can never pass **20**. Every second
**0.8** drains away on its own (more in the wind), so you must keep stepping.
Distance is speed added up over time.

## Energy

Starts at **100**. Misses and hard ground cost energy; Perfects give a little
back. At 0 the runner **stumbles**: speed drops to **1**, your steps are ignored
for **one** pace interval, then you get up with **30** energy.

## Combo and score

Every Perfect or Good adds one to the combo. Any miss or skipped step resets
it. The combo sets a multiplier:

| Combo   | Multiplier |
| ------- | ---------- |
| 0 - 9   | x1         |
| 10 - 19 | x2         |
| 20+     | x3         |

Score grows every moment by `speed x multiplier`. A steady runner with a long
combo scores far more than a fast one who keeps missing.

## The course - level 1

About 410 metres, then it repeats:

```text
flat/clear 60  ->  uphill 40  ->  downhill 40  ->  flat/rain 50  ->  water 30
->  flat/wind 50  ->  uphill/rain 40  ->  downhill/wind 40  ->  flat/clear 60
```

## The end of a run

After **60 seconds** the run stops. You see distance, score, best combo and
accuracy (good steps divided by all steps and skips). Your best score goes on
the leaderboard for your device, PC or phone, under your nickname.

## What is deliberately not here yet

Obstacles to jump, power-ups, more levels, music, other runners on the same
road, real art. Those come in Phase 2, once level one is fun. The engine is
built so each of those is an addition, not a rewrite: a new terrain is one line
in the `TERRAIN` table, a new level is a new list of segments.

## Tuning ideas to try once it plays

1. Base pace **500 ms**: harder, or just faster?
2. A `mud` terrain with pace **x1.4** and **3** energy per step, drawn brown.
3. Level 2: a course that is all hills.
4. A Skipped step that costs energy too. Fairer, or just meaner?
5. `requireAlternatingFeet` off as an "easy" mode for the youngest players.
