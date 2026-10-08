export type Param = string | number | null;

export interface Sql {
  exec(source: string): void;
  run(source: string, params?: Param[]): void;
  all<T>(source: string, params?: Param[]): T[];
  get<T>(source: string, params?: Param[]): T | null;
  transaction(task: () => void): void;
}

export function uid() {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 32; i++) out += hex[Math.floor(Math.random() * 16)];
  return `${Date.now().toString(36)}-${out.slice(0, 12)}`;
}

export const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plate TEXT NOT NULL DEFAULT '',
  odometer_initial INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  adapter_id TEXT,
  adapter_name TEXT,
  vin TEXT,
  list_price REAL,
  gps_factor REAL NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  odo_start INTEGER NOT NULL,
  odo_end INTEGER,
  kind TEXT,
  data TEXT NOT NULL,
  UNIQUE (vehicle_id, number)
);
CREATE INDEX IF NOT EXISTS trips_vehicle_time ON trips (vehicle_id, started_at);
CREATE TABLE IF NOT EXISTS ledger (
  seq INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_entity ON ledger (entity_id, seq);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS trips_no_delete BEFORE DELETE ON trips BEGIN SELECT RAISE(ABORT, 'trips cannot be deleted'); END;
CREATE TABLE IF NOT EXISTS track_points (
  trip_id TEXT NOT NULL,
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  accuracy REAL,
  speed REAL
);
CREATE INDEX IF NOT EXISTS track_points_trip ON track_points (trip_id, t);
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  radius REAL NOT NULL DEFAULT 150,
  kind TEXT,
  purpose TEXT NOT NULL DEFAULT '',
  partner TEXT NOT NULL DEFAULT '',
  role TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS costs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  date INTEGER NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
`;

export function migrate(sql: Sql) {
  sql.exec(SCHEMA);
}
