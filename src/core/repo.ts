import { canonical, GENESIS, hashEntry, verifyChain, type ChainProblem } from './ledger';
import { isComplete, isLocked, shouldAutoLock } from './rules';
import { uid, type Sql } from './sql';
import type {
  Cost,
  FieldChange,
  LedgerAction,
  LedgerEntry,
  Place,
  Trip,
  TripEvent,
  TripPatch,
  TripSource,
  Vehicle,
} from './types';

export type Backup = {
  format: 'openfahrtenbuch-backup';
  version: number;
  exportedAt: number;
  vehicles: Vehicle[];
  places: Place[];
  costs: Cost[];
  ledger: LedgerEntry[];
  trips: Trip[];
  track: { tripId: string; t: number; lat: number; lng: number; accuracy: number | null; speed: number | null }[];
};

export class LockedError extends Error {
  constructor() {
    super('This trip is locked and can no longer be changed.');
  }
}

type LedgerRow = {
  seq: number;
  at: number;
  entity: LedgerEntry['entity'];
  entity_id: string;
  action: LedgerAction;
  payload: string;
  prev_hash: string;
  hash: string;
};

const toEntry = (r: LedgerRow): LedgerEntry => ({
  seq: r.seq,
  at: r.at,
  entity: r.entity,
  entityId: r.entity_id,
  action: r.action,
  payload: r.payload,
  prevHash: r.prev_hash,
  hash: r.hash,
});

const PATCH_FIELDS: (keyof TripPatch)[] = [
  'startedAt',
  'endedAt',
  'odoStart',
  'odoEnd',
  'startAddress',
  'endAddress',
  'startPoint',
  'endPoint',
  'kind',
  'purpose',
  'partner',
  'route',
  'driver',
  'note',
  'gpsMeters',
];

const QUIET_FIELDS = new Set<keyof TripPatch>(['gpsMeters', 'startPoint', 'endPoint']);

export type StartInput = {
  vehicleId: string;
  source: TripSource;
  odoStart: number;
  startedAt?: number;
  startAddress?: string;
  startPoint?: Trip['startPoint'];
  driver?: string;
};

export class Repo {
  constructor(
    private sql: Sql,
    private clock: () => number = Date.now,
  ) {}

  private append(entity: LedgerEntry['entity'], entityId: string, action: LedgerAction, payload: unknown) {
    const last = this.sql.get<{ seq: number; hash: string }>('SELECT seq, hash FROM ledger ORDER BY seq DESC LIMIT 1');
    const base = {
      seq: (last?.seq ?? 0) + 1,
      at: this.clock(),
      entity,
      entityId,
      action,
      payload: canonical(payload),
      prevHash: last?.hash ?? GENESIS,
    };
    const hash = hashEntry(base);
    this.sql.run(
      'INSERT INTO ledger (seq, at, entity, entity_id, action, payload, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [base.seq, base.at, entity, entityId, action, base.payload, base.prevHash, hash],
    );
    return { ...base, hash };
  }

  private writeTrip(trip: Trip, insert: boolean) {
    const params = [
      trip.vehicleId,
      trip.number,
      trip.status,
      trip.startedAt,
      trip.endedAt,
      trip.odoStart,
      trip.odoEnd,
      trip.kind,
      JSON.stringify(trip),
      trip.id,
    ];
    if (insert) {
      this.sql.run(
        'INSERT INTO trips (vehicle_id, number, status, started_at, ended_at, odo_start, odo_end, kind, data, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params,
      );
    } else {
      this.sql.run(
        'UPDATE trips SET vehicle_id = ?, number = ?, status = ?, started_at = ?, ended_at = ?, odo_start = ?, odo_end = ?, kind = ?, data = ? WHERE id = ?',
        params,
      );
    }
  }

  vehicles(includeArchived = false): Vehicle[] {
    const rows = this.sql.all<Record<string, unknown>>(
      `SELECT * FROM vehicles ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY created_at`,
    );
    return rows.map(rowToVehicle);
  }

  vehicle(id: string): Vehicle | null {
    const row = this.sql.get<Record<string, unknown>>('SELECT * FROM vehicles WHERE id = ?', [id]);
    return row ? rowToVehicle(row) : null;
  }

  saveVehicle(input: Omit<Vehicle, 'id' | 'createdAt'> & { id?: string }): Vehicle {
    const existing = input.id ? this.vehicle(input.id) : null;
    const vehicle: Vehicle = {
      ...input,
      id: existing?.id ?? uid(),
      createdAt: existing?.createdAt ?? this.clock(),
      odometerInitial: existing && this.tripCount(existing.id) > 0 ? existing.odometerInitial : input.odometerInitial,
    };
    this.sql.transaction(() => {
      this.sql.run(
        `INSERT INTO vehicles (id, name, plate, odometer_initial, created_at, adapter_id, adapter_name, vin, list_price, gps_factor, archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, plate = excluded.plate, odometer_initial = excluded.odometer_initial,
         adapter_id = excluded.adapter_id, adapter_name = excluded.adapter_name, vin = excluded.vin, list_price = excluded.list_price,
         gps_factor = excluded.gps_factor, archived = excluded.archived`,
        [
          vehicle.id,
          vehicle.name,
          vehicle.plate,
          vehicle.odometerInitial,
          vehicle.createdAt,
          vehicle.adapterId,
          vehicle.adapterName,
          vehicle.vin,
          vehicle.listPrice,
          vehicle.gpsFactor,
          vehicle.archived ? 1 : 0,
        ],
      );
      this.append('vehicle', vehicle.id, existing ? 'update' : 'create', {
        name: vehicle.name,
        plate: vehicle.plate,
        odometerInitial: vehicle.odometerInitial,
        archived: vehicle.archived,
      });
    });
    return vehicle;
  }

  tripCount(vehicleId: string) {
    return this.sql.get<{ n: number }>('SELECT COUNT(*) AS n FROM trips WHERE vehicle_id = ?', [vehicleId])?.n ?? 0;
  }

  lastOdometer(vehicleId: string): number {
    const vehicle = this.vehicle(vehicleId);
    const row = this.sql.get<{ odo: number | null }>(
      "SELECT MAX(COALESCE(odo_end, odo_start)) AS odo FROM trips WHERE vehicle_id = ? AND status != 'void'",
      [vehicleId],
    );
    return Math.max(vehicle?.odometerInitial ?? 0, row?.odo ?? 0);
  }

  trip(id: string): Trip | null {
    const row = this.sql.get<{ data: string }>('SELECT data FROM trips WHERE id = ?', [id]);
    return row ? (JSON.parse(row.data) as Trip) : null;
  }

  trips(filter: { vehicleId?: string; from?: number; to?: number; status?: Trip['status'][] } = {}): Trip[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.vehicleId) {
      where.push('vehicle_id = ?');
      params.push(filter.vehicleId);
    }
    if (filter.from != null) {
      where.push('started_at >= ?');
      params.push(filter.from);
    }
    if (filter.to != null) {
      where.push('started_at < ?');
      params.push(filter.to);
    }
    if (filter.status?.length) {
      where.push(`status IN (${filter.status.map(() => '?').join(', ')})`);
      params.push(...filter.status);
    }
    const rows = this.sql.all<{ data: string }>(
      `SELECT data FROM trips ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY started_at DESC, number DESC`,
      params,
    );
    return rows.map((r) => JSON.parse(r.data) as Trip);
  }

  recording(): Trip | null {
    const row = this.sql.get<{ data: string }>("SELECT data FROM trips WHERE status = 'recording' LIMIT 1");
    return row ? (JSON.parse(row.data) as Trip) : null;
  }

  private nextNumber(vehicleId: string) {
    return (this.sql.get<{ n: number | null }>('SELECT MAX(number) AS n FROM trips WHERE vehicle_id = ?', [vehicleId])?.n ?? 0) + 1;
  }

  startTrip(input: StartInput): Trip {
    const now = this.clock();
    const trip: Trip = {
      id: uid(),
      vehicleId: input.vehicleId,
      number: this.nextNumber(input.vehicleId),
      status: 'recording',
      source: input.source,
      startedAt: input.startedAt ?? now,
      endedAt: null,
      odoStart: Math.round(input.odoStart),
      odoEnd: null,
      startAddress: input.startAddress ?? '',
      endAddress: '',
      startPoint: input.startPoint ?? null,
      endPoint: null,
      kind: null,
      purpose: '',
      partner: '',
      route: '',
      driver: input.driver ?? '',
      note: '',
      gpsMeters: 0,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      lockedAt: null,
      voidReason: '',
    };
    this.sql.transaction(() => {
      this.writeTrip(trip, true);
      this.append('trip', trip.id, 'create', snapshot(trip));
    });
    return trip;
  }

  addManualTrip(input: StartInput & TripPatch & { endedAt: number; odoEnd: number }): Trip {
    const now = this.clock();
    let trip: Trip | null = null;
    this.sql.transaction(() => {
      const base = this.startTrip({ ...input, source: 'manual' });
      trip = { ...base, ...pickPatch(input), status: 'open', updatedAt: now };
      trip.odoStart = Math.round(trip.odoStart);
      trip.odoEnd = Math.round(trip.odoEnd!);
      if (isComplete(trip)) {
        trip.status = 'done';
        trip.completedAt = now;
      }
      this.writeTrip(trip, false);
      this.append('trip', trip.id, 'complete', { changes: diff(base, trip), status: trip.status });
    });
    return trip!;
  }

  updateTrip(id: string, patch: TripPatch, action: LedgerAction = 'update'): Trip {
    const current = this.trip(id);
    if (!current) throw new Error('Trip not found');
    if (isLocked(current)) throw new LockedError();
    const now = this.clock();
    const next: Trip = { ...current, ...pickPatch(patch), updatedAt: now };
    if (action === 'complete' && next.status === 'recording') next.status = 'open';
    if (next.odoEnd != null) next.odoEnd = Math.round(next.odoEnd);
    next.odoStart = Math.round(next.odoStart);
    if (next.status !== 'recording') {
      const complete = isComplete(next);
      next.status = complete ? 'done' : 'open';
      if (complete && next.completedAt == null) next.completedAt = now;
      if (!complete) next.completedAt = null;
    }
    const changes = diff(current, next);
    if (changes.length === 0 && next.status === current.status) return current;
    this.sql.transaction(() => {
      this.writeTrip(next, false);
      this.append('trip', id, action, { changes, status: next.status });
    });
    return next;
  }

  finishTrip(id: string, patch: TripPatch): Trip {
    const current = this.trip(id);
    if (!current) throw new Error('Trip not found');
    if (current.status !== 'recording') return this.updateTrip(id, patch);
    return this.updateTrip(id, { endedAt: this.clock(), ...patch }, 'complete');
  }

  lockTrip(id: string): Trip {
    const current = this.trip(id);
    if (!current) throw new Error('Trip not found');
    if (current.lockedAt != null) return current;
    if (current.status !== 'done') throw new Error('Only complete trips can be locked.');
    const next = { ...current, lockedAt: this.clock() };
    this.sql.transaction(() => {
      this.writeTrip(next, false);
      this.append('trip', id, 'lock', { lockedAt: next.lockedAt });
    });
    return next;
  }

  voidTrip(id: string, reason: string): Trip {
    const current = this.trip(id);
    if (!current) throw new Error('Trip not found');
    if (current.lockedAt != null) throw new LockedError();
    const next: Trip = { ...current, status: 'void', voidReason: reason.trim(), updatedAt: this.clock() };
    this.sql.transaction(() => {
      this.writeTrip(next, false);
      this.append('trip', id, 'void', { reason: next.voidReason, previousStatus: current.status });
    });
    return next;
  }

  annotate(id: string, text: string) {
    const current = this.trip(id);
    if (!current) throw new Error('Trip not found');
    this.append('trip', id, 'annotate', { text: text.trim() });
  }

  autoLock(now = this.clock()) {
    const locked: string[] = [];
    for (const trip of this.trips({ status: ['done'] })) {
      if (shouldAutoLock(trip, now)) {
        this.lockTrip(trip.id);
        locked.push(trip.id);
      }
    }
    return locked;
  }

  ledger(entityId?: string): LedgerEntry[] {
    const rows = entityId
      ? this.sql.all<LedgerRow>('SELECT * FROM ledger WHERE entity_id = ? ORDER BY seq', [entityId])
      : this.sql.all<LedgerRow>('SELECT * FROM ledger ORDER BY seq');
    return rows.map(toEntry);
  }

  head(): LedgerEntry | null {
    const row = this.sql.get<LedgerRow>('SELECT * FROM ledger ORDER BY seq DESC LIMIT 1');
    return row ? toEntry(row) : null;
  }

  events(tripId: string): TripEvent[] {
    return this.ledger(tripId).map((entry) => {
      const payload = JSON.parse(entry.payload) as { changes?: FieldChange[]; text?: string; reason?: string };
      return {
        seq: entry.seq,
        at: entry.at,
        action: entry.action,
        changes: (payload.changes ?? []).filter((c) => !QUIET_FIELDS.has(c.field)),
        text: payload.text ?? payload.reason ?? '',
        hash: entry.hash,
      };
    });
  }

  verify(): { problems: ChainProblem[]; mismatched: string[]; entries: number } {
    const entries = this.ledger();
    const problems = verifyChain(entries);
    const replayed = replay(entries);
    const mismatched: string[] = [];
    const stored = this.sql.all<{ id: string; data: string }>('SELECT id, data FROM trips');
    for (const row of stored) {
      const trip = JSON.parse(row.data) as Trip;
      const expected = replayed.get(row.id);
      if (!expected || canonical(core(expected)) !== canonical(core(trip))) mismatched.push(row.id);
    }
    for (const id of replayed.keys()) if (!stored.some((s) => s.id === id)) mismatched.push(id);
    return { problems, mismatched, entries: entries.length };
  }

  backup(): Backup {
    return {
      format: 'openfahrtenbuch-backup',
      version: 1,
      exportedAt: this.clock(),
      vehicles: this.vehicles(true),
      places: this.places(),
      costs: this.costs(),
      ledger: this.ledger(),
      trips: this.trips(),
      track: this.sql.all('SELECT trip_id AS tripId, t, lat, lng, accuracy, speed FROM track_points ORDER BY trip_id, t'),
    };
  }

  restore(data: Backup, recordingReason = 'Restored from a backup while still recording') {
    if (data?.format !== 'openfahrtenbuch-backup') throw new Error('invalid');
    if ((this.sql.get<{ n: number }>('SELECT COUNT(*) AS n FROM trips')?.n ?? 0) > 0) throw new Error('not-empty');
    if (verifyChain(data.ledger).length > 0) throw new Error('invalid');
    const replayed = replay(data.ledger);
    for (const trip of data.trips) {
      const expected = replayed.get(trip.id);
      if (!expected || canonical(core(expected)) !== canonical(core(trip))) throw new Error('invalid');
    }
    if (replayed.size !== data.trips.length) throw new Error('invalid');
    this.sql.transaction(() => {
      this.sql.exec('DROP TRIGGER IF EXISTS ledger_no_delete;');
      this.sql.run('DELETE FROM ledger');
      this.sql.run('DELETE FROM vehicles');
      this.sql.run('DELETE FROM places');
      this.sql.run('DELETE FROM costs');
      this.sql.run('DELETE FROM track_points');
      this.sql.exec("CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;");
      for (const e of data.ledger) {
        this.sql.run(
          'INSERT INTO ledger (seq, at, entity, entity_id, action, payload, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [e.seq, e.at, e.entity, e.entityId, e.action, e.payload, e.prevHash, e.hash],
        );
      }
      for (const v of data.vehicles) {
        this.sql.run(
          `INSERT INTO vehicles (id, name, plate, odometer_initial, created_at, adapter_id, adapter_name, vin, list_price, gps_factor, archived)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [v.id, v.name, v.plate, v.odometerInitial, v.createdAt, v.adapterId, v.adapterName, v.vin, v.listPrice, v.gpsFactor, v.archived ? 1 : 0],
        );
      }
      for (const trip of data.trips) this.writeTrip(trip, true);
      for (const p of data.places) this.savePlace(p);
      for (const c of data.costs) this.saveCost(c);
      for (const p of data.track ?? []) {
        this.sql.run('INSERT INTO track_points (trip_id, t, lat, lng, accuracy, speed) VALUES (?, ?, ?, ?, ?, ?)', [
          p.tripId,
          p.t,
          p.lat,
          p.lng,
          p.accuracy,
          p.speed,
        ]);
      }
    });
    for (const trip of data.trips) if (trip.status === 'recording') this.voidTrip(trip.id, recordingReason);
    return data.trips.length;
  }

  places(): Place[] {
    return this.sql.all<Record<string, unknown>>('SELECT * FROM places ORDER BY name COLLATE NOCASE').map(rowToPlace);
  }

  savePlace(input: Omit<Place, 'id' | 'createdAt'> & { id?: string }): Place {
    const place: Place = { ...input, id: input.id ?? uid(), createdAt: this.clock() };
    if (place.role) this.sql.run('UPDATE places SET role = NULL WHERE role = ? AND id != ?', [place.role, place.id]);
    this.sql.run(
      `INSERT INTO places (id, name, address, lat, lng, radius, kind, purpose, partner, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, address = excluded.address, lat = excluded.lat, lng = excluded.lng,
       radius = excluded.radius, kind = excluded.kind, purpose = excluded.purpose, partner = excluded.partner, role = excluded.role`,
      [
        place.id,
        place.name,
        place.address,
        place.point?.lat ?? null,
        place.point?.lng ?? null,
        place.radius,
        place.kind,
        place.purpose,
        place.partner,
        place.role,
        place.createdAt,
      ],
    );
    return place;
  }

  deletePlace(id: string) {
    this.sql.run('DELETE FROM places WHERE id = ?', [id]);
  }

  costs(filter: { vehicleId?: string; from?: number; to?: number } = {}): Cost[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.vehicleId) {
      where.push('vehicle_id = ?');
      params.push(filter.vehicleId);
    }
    if (filter.from != null) {
      where.push('date >= ?');
      params.push(filter.from);
    }
    if (filter.to != null) {
      where.push('date < ?');
      params.push(filter.to);
    }
    return this.sql
      .all<Record<string, unknown>>(`SELECT * FROM costs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC`, params)
      .map((r) => ({
        id: r.id as string,
        vehicleId: r.vehicle_id as string,
        date: r.date as number,
        category: r.category as Cost['category'],
        amount: r.amount as number,
        note: r.note as string,
        createdAt: r.created_at as number,
      }));
  }

  saveCost(input: Omit<Cost, 'id' | 'createdAt'> & { id?: string }): Cost {
    const cost: Cost = { ...input, id: input.id ?? uid(), createdAt: this.clock() };
    this.sql.run(
      `INSERT INTO costs (id, vehicle_id, date, category, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET vehicle_id = excluded.vehicle_id, date = excluded.date, category = excluded.category,
       amount = excluded.amount, note = excluded.note`,
      [cost.id, cost.vehicleId, cost.date, cost.category, cost.amount, cost.note, cost.createdAt],
    );
    return cost;
  }

  deleteCost(id: string) {
    this.sql.run('DELETE FROM costs WHERE id = ?', [id]);
  }

  addTrackPoints(tripId: string, points: { t: number; lat: number; lng: number; accuracy: number | null; speed: number | null }[]) {
    if (points.length === 0) return;
    this.sql.transaction(() => {
      for (const p of points) {
        this.sql.run('INSERT INTO track_points (trip_id, t, lat, lng, accuracy, speed) VALUES (?, ?, ?, ?, ?, ?)', [
          tripId,
          p.t,
          p.lat,
          p.lng,
          p.accuracy,
          p.speed,
        ]);
      }
    });
  }

  track(tripId: string) {
    return this.sql.all<{ t: number; lat: number; lng: number; speed: number | null }>(
      'SELECT t, lat, lng, speed FROM track_points WHERE trip_id = ? ORDER BY t',
      [tripId],
    );
  }

  meta(key: string): string | null {
    return this.sql.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key])?.value ?? null;
  }

  setMeta(key: string, value: string | null) {
    if (value == null) this.sql.run('DELETE FROM meta WHERE key = ?', [key]);
    else this.sql.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
  }

  suggestions(field: 'purpose' | 'partner' | 'endAddress' | 'route', limit = 6): string[] {
    const counts = new Map<string, number>();
    for (const trip of this.trips({ status: ['done', 'open'] }).slice(0, 400)) {
      const value = trip[field].trim();
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([v]) => v);
  }
}

function pickPatch(patch: TripPatch): TripPatch {
  const out: TripPatch = {};
  for (const key of PATCH_FIELDS) {
    if (key in patch && patch[key] !== undefined) (out as Record<string, unknown>)[key] = patch[key];
  }
  return out;
}

function diff(a: Trip, b: Trip): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of PATCH_FIELDS) {
    if (canonical(a[field]) !== canonical(b[field])) changes.push({ field, from: a[field], to: b[field] });
  }
  return changes;
}

function snapshot(trip: Trip) {
  const { updatedAt: _u, ...rest } = trip;
  return rest;
}

function core(trip: Trip) {
  const { updatedAt: _u, completedAt: _c, ...rest } = trip;
  return rest;
}

export function replay(entries: LedgerEntry[]) {
  const trips = new Map<string, Trip>();
  for (const entry of entries) {
    if (entry.entity !== 'trip') continue;
    const payload = JSON.parse(entry.payload);
    if (entry.action === 'create') {
      trips.set(entry.entityId, { ...(payload as Trip), updatedAt: entry.at });
      continue;
    }
    const trip = trips.get(entry.entityId);
    if (!trip) continue;
    if (payload.changes) for (const c of payload.changes as FieldChange[]) (trip as Record<string, unknown>)[c.field] = c.to;
    if (payload.status) trip.status = payload.status;
    if (entry.action === 'lock') trip.lockedAt = payload.lockedAt;
    if (entry.action === 'void') {
      trip.status = 'void';
      trip.voidReason = payload.reason;
    }
    trip.updatedAt = entry.at;
  }
  return trips;
}

function rowToVehicle(r: Record<string, unknown>): Vehicle {
  return {
    id: r.id as string,
    name: r.name as string,
    plate: r.plate as string,
    odometerInitial: r.odometer_initial as number,
    createdAt: r.created_at as number,
    adapterId: (r.adapter_id as string) ?? null,
    adapterName: (r.adapter_name as string) ?? null,
    vin: (r.vin as string) ?? null,
    listPrice: (r.list_price as number) ?? null,
    gpsFactor: (r.gps_factor as number) ?? 1,
    archived: !!r.archived,
  };
}

function rowToPlace(r: Record<string, unknown>): Place {
  return {
    id: r.id as string,
    name: r.name as string,
    address: r.address as string,
    point: r.lat != null && r.lng != null ? { lat: r.lat as number, lng: r.lng as number } : null,
    radius: r.radius as number,
    kind: (r.kind as Place['kind']) ?? null,
    purpose: r.purpose as string,
    partner: r.partner as string,
    role: (r.role as Place['role']) ?? null,
    createdAt: r.created_at as number,
  };
}
