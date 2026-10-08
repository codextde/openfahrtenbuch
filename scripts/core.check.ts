/// <reference types="bun" />
import { Database } from 'bun:sqlite';

import { verifyChain } from '../src/core/ledger';
import { LockedError, Repo } from '../src/core/repo';
import { compareMethods, DAY, missingFields, odometerIssues, totals } from '../src/core/rules';
import { migrate, type Sql } from '../src/core/sql';
import { buildCsv, buildReportHtml } from '../src/core/report';

function bunSql(db: Database): Sql {
  let depth = 0;
  return {
    exec: (s) => db.exec(s),
    run: (s, p = []) => void db.query(s).run(...(p as never[])),
    all: <T,>(s: string, p: unknown[] = []) => db.query(s).all(...(p as never[])) as T[],
    get: <T,>(s: string, p: unknown[] = []) => (db.query(s).get(...(p as never[])) as T) ?? null,
    transaction: (task) => {
      if (depth > 0) return task();
      depth++;
      try {
        db.transaction(task)();
      } finally {
        depth--;
      }
    },
  };
}

let failures = 0;
let passed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passed++;
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? '');
  }
}

let now = Date.UTC(2026, 9, 1, 8, 0);
const db = new Database(':memory:');
const sql = bunSql(db);
migrate(sql);
const repo = new Repo(sql, () => now);

const car = repo.saveVehicle({
  name: 'Firmenwagen',
  plate: 'SHA-CX 100',
  odometerInitial: 48210,
  adapterId: null,
  adapterName: null,
  vin: null,
  listPrice: 52990,
  gpsFactor: 1,
  archived: false,
});
check('vehicle saved', repo.vehicles().length === 1);
check('last odometer = initial', repo.lastOdometer(car.id) === 48210);

const t1 = repo.startTrip({ vehicleId: car.id, source: 'gps', odoStart: 48210, startAddress: 'Hauptstr. 1, 74549 Wolpertshausen' });
check('trip number 1', t1.number === 1);
check('recording found', repo.recording()?.id === t1.id);
now += 40 * 60 * 1000;
const f1 = repo.finishTrip(t1.id, { odoEnd: 48252, endAddress: 'Marktplatz 5, 74523 Schwäbisch Hall', gpsMeters: 41800 });
check('finished trip is open (kind missing)', f1.status === 'open', f1.status);
check('missing kind', missingFields(f1).includes('kind'));
const c1 = repo.updateTrip(t1.id, { kind: 'business', purpose: 'Kundentermin Shop-Migration', partner: 'Muster GmbH' });
check('business trip complete', c1.status === 'done', c1.status);
check('completedAt set', c1.completedAt === now);

now += 60 * 60 * 1000;
const c1b = repo.updateTrip(t1.id, { purpose: 'Workshop Shopify Plus' });
const events = repo.events(t1.id);
const lastChange = events[events.length - 1]?.changes.find((c) => c.field === 'purpose');
check('change recorded with old value', lastChange?.from === 'Kundentermin Shop-Migration' && lastChange?.to === 'Workshop Shopify Plus', lastChange);
check('still done', c1b.status === 'done');

const t2 = repo.startTrip({ vehicleId: car.id, source: 'manual', odoStart: 48252 });
repo.finishTrip(t2.id, { odoEnd: 48270, kind: 'private' });
check('private trip done without purpose', repo.trip(t2.id)?.status === 'done');

const manual = repo.addManualTrip({
  vehicleId: car.id,
  source: 'manual',
  odoStart: 48290,
  odoEnd: 48312,
  startedAt: now - 3 * DAY,
  endedAt: now - 3 * DAY + 30 * 60 * 1000,
  kind: 'commute',
});
check('manual trip done', manual.status === 'done' && manual.number === 3);

const issues = odometerIssues(repo.trips({ vehicleId: car.id }), car.odometerInitial);
check('gap detected 48270 -> 48290', issues.gaps.length === 1 && issues.gaps[0].km === 20, issues);
check('last odometer 48312', repo.lastOdometer(car.id) === 48312);

const tot = totals(repo.trips({ vehicleId: car.id }));
check('totals business 42', tot.business.km === 42 && tot.private.km === 18 && tot.commute.km === 22 && tot.km === 82, tot);

now += 8 * DAY;
const locked = repo.autoLock();
check('auto lock after 7 days', locked.length === 3, locked);
let threw = false;
try {
  repo.updateTrip(t1.id, { purpose: 'x' });
} catch (e) {
  threw = e instanceof LockedError;
}
check('locked trip cannot change', threw);
repo.annotate(t1.id, 'Ziel war Filiale Nord, nicht Marktplatz.');
check('annotation appended', repo.events(t1.id).some((e) => e.action === 'annotate'));

let deleteBlocked = false;
try {
  sql.run('DELETE FROM trips WHERE id = ?', [t1.id]);
} catch {
  deleteBlocked = true;
}
check('trip delete blocked by trigger', deleteBlocked);
let ledgerBlocked = false;
try {
  sql.run('UPDATE ledger SET payload = ? WHERE seq = 1', ['{}']);
} catch {
  ledgerBlocked = true;
}
check('ledger update blocked by trigger', ledgerBlocked);

const v = repo.verify();
check('ledger verifies', v.problems.length === 0 && v.mismatched.length === 0, v);

const original = sql.get<{ data: string }>('SELECT data FROM trips WHERE id = ?', [t2.id])!.data;
const tampered = JSON.parse(original);
tampered.odoEnd = 48290;
sql.run('UPDATE trips SET data = ? WHERE id = ?', [JSON.stringify(tampered), t2.id]);
const v2 = repo.verify();
check('direct tampering detected', v2.mismatched.includes(t2.id), v2);
sql.run('UPDATE trips SET data = ? WHERE id = ?', [original, t2.id]);

const entries = repo.ledger();
const forged = entries.map((e) => (e.payload.includes('Muster') ? { ...e, payload: e.payload.replace('Muster', 'Fake') } : e));
check('forged ledger detected', verifyChain(forged).some((p) => p.reason === 'hash'));

const t3 = repo.startTrip({ vehicleId: car.id, source: 'gps', odoStart: 48312 });
const voided = repo.voidTrip(t3.id, 'Versehentlich gestartet');
check('void trip', voided.status === 'void' && repo.recording() === null);

const cmp = compareMethods({
  listPrice: 52990,
  totalCosts: 9000,
  totalKm: 30000,
  privateKm: 6000,
  commuteKm: 4000,
  commuteDistanceKm: 20,
  months: 12,
});
check('1% rule rounds list price down to 100', Math.abs(cmp.flatPrivate - 529 * 12) < 0.01, cmp);
check('logbook private share', Math.abs(cmp.logPrivate - 1800) < 0.01, cmp);

const trips = repo.trips({ vehicleId: car.id });
const html = buildReportHtml({
  vehicle: car,
  trips,
  events: Object.fromEntries(trips.map((t) => [t.id, repo.events(t.id)])),
  from: Date.UTC(2026, 0, 1),
  to: Date.UTC(2027, 0, 1),
  head: repo.head(),
  generatedAt: now,
  lang: 'de',
  owner: 'Daniel Ehrhardt',
});
check('pdf html has trip purpose', html.includes('Workshop Shopify Plus'));
check('pdf html shows change inline', html.includes('Kundentermin Shop-Migration'));
check('pdf html shows void trip', html.includes('Versehentlich gestartet'));
check('pdf html shows gap', html.includes('48.270'));
check('pdf html shows annotation', html.includes('Filiale Nord'));
const csv = buildCsv({ vehicle: car, trips, lang: 'de' });
check('csv header', csv.split('\n')[0].includes('Kilometerstand Beginn'));
check('csv rows', csv.trim().split('\n').length === trips.length + 1, csv);

const backup = JSON.parse(JSON.stringify(repo.backup()));
const db2 = new Database(':memory:');
const sql2 = bunSql(db2);
migrate(sql2);
const repo2 = new Repo(sql2, () => now);
repo2.saveVehicle({ ...car, id: undefined, name: 'Leer' });
check('restore into empty book', repo2.restore(backup) === backup.trips.length);
check('restored ledger verifies', repo2.verify().problems.length === 0 && repo2.verify().mismatched.length === 0);
check('restored vehicle', repo2.vehicles()[0]?.name === 'Firmenwagen');
let restoreBlocked = false;
try {
  repo2.restore(backup);
} catch (e) {
  restoreBlocked = (e as Error).message === 'not-empty';
}
check('restore refused when trips exist', restoreBlocked);
const bad = JSON.parse(JSON.stringify(backup));
bad.trips[0].purpose = 'Manipuliert';
const db3 = new Database(':memory:');
const sql3 = bunSql(db3);
migrate(sql3);
let badBlocked = false;
try {
  new Repo(sql3).restore(bad);
} catch (e) {
  badBlocked = (e as Error).message === 'invalid';
}
check('tampered backup refused', badBlocked);

const { parsePid, decodeOdometer, parseVin } = await import('../src/tracking/obd-parse');
const odo = parsePid(['41 A6 00 07 5B CD'], 'A6', 4);
check('odometer PID A6 decoded', odo != null && decodeOdometer(odo) === 48225.3, odo);
check('speed PID 0D', parsePid(['SEARCHING...', '410D32'], '0D', 1)?.[0] === 50);
check('no data', parsePid(['NO DATA'], 'A6', 4) === null);
const vinLines = ['014', '0: 49 02 01 57 42 41', '1: 33 41 35 43 35 35 46', '2: 4B 33 31 32 33 34 35'];
check('vin multi frame', parseVin(vinLines) === 'WBA3A5C55FK312345', parseVin(vinLines));
console.log(`${passed} passed, ${failures} failed (with obd)`);
if (failures > 0) process.exit(1);
