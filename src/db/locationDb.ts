import * as SQLite from "expo-sqlite";

/**
 * Schema v2.
 *
 * Previous versions stored `client_ts_utc TEXT` (ISO strings). The
 * geo-tracking backend expects epoch-millis under `ts`, so the active schema
 * stores an INTEGER instead.
 *
 * Migration strategy (keeps things simple for a dev app): if an old table
 * with a TEXT `client_ts_utc` column exists we drop it — queued points were
 * tied to the old mock backend's data model anyway and are not worth
 * preserving.
 */
const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pending_locations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude  REAL    NOT NULL,
  longitude REAL    NOT NULL,
  speed     REAL,
  heading   REAL,
  accuracy  REAL,
  ts        INTEGER NOT NULL
);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("dots_locations.db");
      // Drop the old v1 table (TEXT client_ts_utc column) if present so we can
      // recreate the table with the new schema. Losing queued points from an
      // old install is acceptable — they wouldn't fit the new API shape.
      const info = (await db.getAllAsync(
        `PRAGMA table_info(pending_locations)`,
      )) as { name: string }[];
      const hasOldColumn = info.some((c) => c.name === "client_ts_utc");
      if (hasOldColumn) {
        await db.execAsync(`DROP TABLE pending_locations;`);
      }
      await db.execAsync(CREATE_TABLE_SQL);
      return db;
    })();
  }
  return dbPromise;
}

export async function initLocationDb(): Promise<void> {
  await getDb();
}

export type PendingPointInsert = {
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  /** Epoch millis when the fix was captured on the device. */
  ts: number;
};

export type PendingPointRow = {
  id: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  ts: number;
};

export async function enqueue(point: PendingPointInsert): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_locations (latitude, longitude, speed, heading, accuracy, ts)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      point.latitude,
      point.longitude,
      point.speed ?? null,
      point.heading ?? null,
      point.accuracy ?? null,
      point.ts,
    ],
  );
}

export async function peekBatch(limit: number): Promise<PendingPointRow[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    `SELECT id, latitude, longitude, speed, heading, accuracy, ts
     FROM pending_locations
     ORDER BY id ASC
     LIMIT ?`,
    [limit],
  )) as PendingPointRow[];
  return rows ?? [];
}

export async function deleteByIds(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  await db.runAsync(
    `DELETE FROM pending_locations WHERE id IN (${placeholders})`,
    ids,
  );
}

export async function count(): Promise<number> {
  const db = await getDb();
  const row = (await db.getFirstAsync(
    `SELECT COUNT(*) AS n FROM pending_locations`,
  )) as { n: number } | null;
  return row?.n ?? 0;
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`DELETE FROM pending_locations;`);
}
