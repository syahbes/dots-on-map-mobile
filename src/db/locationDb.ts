import * as SQLite from "expo-sqlite";

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pending_locations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  latitude      REAL    NOT NULL,
  longitude     REAL    NOT NULL,
  speed         REAL,
  heading       REAL,
  client_ts_utc TEXT    NOT NULL
);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("dots_locations.db");
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
  clientTsUtc: string;
};

export type PendingPointRow = {
  id: number;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  client_ts_utc: string;
};

export async function enqueue(point: PendingPointInsert): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_locations (latitude, longitude, speed, heading, client_ts_utc)
     VALUES (?, ?, ?, ?, ?)`,
    [
      point.latitude,
      point.longitude,
      point.speed ?? null,
      point.heading ?? null,
      point.clientTsUtc,
    ],
  );
}

export async function peekBatch(limit: number): Promise<PendingPointRow[]> {
  const db = await getDb();
  const rows = (await db.getAllAsync(
    `SELECT id, latitude, longitude, speed, heading, client_ts_utc
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
