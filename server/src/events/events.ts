import { Db, ObjectId } from 'mongodb';
import { COLLECTIONS } from '../database/mongo.js';

/**
 * A tiny anonymous funnel: how many people opened the game, played, finished,
 * and pressed the workshop button.
 *
 * There is no third party and no tracking cookie. An event carries a random
 * session id made in the browser, the name of the thing that happened, the
 * device kind and the leaflet marker. It NEVER carries a nickname or any other
 * personal detail, and the collection throws its own rows away after 180 days.
 */

export const EVENT_NAMES = [
  'landing_viewed',
  'play_pressed',
  'tutorial_started',
  'tutorial_completed',
  'tutorial_skipped',
  'run_started',
  'run_completed',
  'run_abandoned',
  'run_again',
  'save_pressed',
  'score_saved',
  'returning_entered',
  'leaderboard_viewed',
  'workshop_shown',
  'workshop_clicked',
  'behind_opened',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export type EventPlatform = 'pc' | 'mobile' | 'unknown';
export type EventData = Record<string, number | string | boolean>;

export interface EventInput {
  sid: string;
  name: EventName;
  platform: EventPlatform;
  ref: string; // '' or a leaflet marker such as LEAF5 or B3
  data?: EventData;
}

interface EventDoc extends EventInput {
  _id: ObjectId;
  at: Date;
}

const SID_PATTERN = /^[a-z0-9]{8,40}$/;
const REF_PATTERN = /^[A-Z0-9]{1,12}$/;
const MAX_DATA_KEYS = 8;
const MAX_DATA_STRING = 40;
const MAX_DATA_BYTES = 512;

function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && (EVENT_NAMES as readonly string[]).includes(value);
}

function validData(value: unknown): EventData | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const keys = Object.keys(data);
  if (keys.length > MAX_DATA_KEYS) return null;

  for (const key of keys) {
    const item = data[key];
    if (typeof item === 'number') {
      if (!Number.isFinite(item)) return null;
    } else if (typeof item === 'boolean') {
      // fine as it is
    } else if (typeof item === 'string') {
      if (item.length > MAX_DATA_STRING) return null;
    } else {
      return null;
    }
  }

  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_DATA_BYTES) return null;
  return data as EventData;
}

/** An event the server is willing to store, or null. */
export function validateEvent(body: unknown): EventInput | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  const sid = raw.sid;
  if (typeof sid !== 'string' || !SID_PATTERN.test(sid)) return null;

  if (!isEventName(raw.name)) return null;

  const platform = raw.platform;
  if (platform !== 'pc' && platform !== 'mobile' && platform !== 'unknown') return null;

  const ref = raw.ref;
  if (typeof ref !== 'string' || (ref !== '' && !REF_PATTERN.test(ref))) return null;

  const event: EventInput = { sid, name: raw.name, platform, ref };

  if (raw.data !== undefined) {
    const data = validData(raw.data);
    if (!data) return null;
    event.data = data;
  }

  return event;
}

export async function recordEvent(db: Db, event: EventInput): Promise<void> {
  await db
    .collection<EventDoc>(COLLECTIONS.events)
    .insertOne({ _id: new ObjectId(), ...event, at: new Date() });
}

export interface EventSummary {
  days: number;
  byName: Record<string, { events: number; sessions: number }>;
  // Visitors with no leaflet marker are reported under the key 'direct'.
  byRef: Record<
    string,
    { opened: number; played: number; completed: number; workshopClicked: number }
  >;
}

/** Which event the funnel column is counted from. */
const FUNNEL: Record<string, keyof EventSummary['byRef'][string]> = {
  landing_viewed: 'opened',
  run_started: 'played',
  run_completed: 'completed',
  workshop_clicked: 'workshopClicked',
};

export async function summarize(db: Db, days: number): Promise<EventSummary> {
  const events = db.collection<EventDoc>(COLLECTIONS.events);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // How many events of each kind, and how many different people caused them.
  const named = await events
    .aggregate<{ _id: string; events: number; sessions: number }>([
      { $match: { at: { $gte: since } } },
      { $group: { _id: { name: '$name', sid: '$sid' }, events: { $sum: 1 } } },
      { $group: { _id: '$_id.name', events: { $sum: '$events' }, sessions: { $sum: 1 } } },
    ])
    .toArray();

  const byName: EventSummary['byName'] = {};
  for (const row of named) byName[row._id] = { events: row.events, sessions: row.sessions };

  // The funnel per leaflet, each step counted in people, not events.
  const funnelled = await events
    .aggregate<{ _id: { ref: string; name: string }; sessions: number }>([
      { $match: { at: { $gte: since }, name: { $in: Object.keys(FUNNEL) } } },
      { $group: { _id: { ref: '$ref', name: '$name', sid: '$sid' } } },
      {
        $group: {
          _id: { ref: '$_id.ref', name: '$_id.name' },
          sessions: { $sum: 1 },
        },
      },
    ])
    .toArray();

  const byRef: EventSummary['byRef'] = {};
  for (const row of funnelled) {
    // Visitors who came on their own are grouped under one readable key.
    const ref = row._id.ref || 'direct';
    if (!byRef[ref]) {
      byRef[ref] = { opened: 0, played: 0, completed: 0, workshopClicked: 0 };
    }
    const column = FUNNEL[row._id.name];
    if (column) byRef[ref][column] = row.sessions;
  }

  return { days, byName, byRef };
}
