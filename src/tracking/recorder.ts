import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';

import type { Place, Trip, TripPatch, TripSource } from '@/core/types';
import { changed, mutate, repo } from '@/data/db';
import { t } from '@/i18n';
import { notifyFinished, scheduleReminders } from '@/lib/notify';
import { settings } from '@/store/settings';

import { accept, clearLive, type Fix, loadLive, MAX_ACCURACY, saveLive, useLive } from './live';
import { obd } from './obd';
import { describePoint, matchPlace } from './places';

export const GPS_TASK = 'openfahrtenbuch-gps';

export class LocationDeniedError extends Error {}

const toFix = (l: Location.LocationObject): Fix => ({
  t: l.timestamp,
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  accuracy: l.coords.accuracy ?? null,
  speed: l.coords.speed != null && l.coords.speed >= 0 ? l.coords.speed : null,
});

TaskManager.defineTask(GPS_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  await ingest(locations.map(toFix));
});

let stopping = false;

export const isStopping = () => stopping;

export async function ingest(fixes: Fix[]) {
  const trip = repo.recording();
  if (!trip) {
    await stopGps();
    return;
  }
  const live = loadLive(trip.id);
  let { meters, last, lastMoveAt } = live;
  const keep: Fix[] = [];
  let weak = live.weak;
  for (const fix of [...fixes].sort((a, b) => a.t - b.t)) {
    if (fix.t < trip.startedAt - 30000) continue;
    weak = fix.accuracy != null && fix.accuracy > MAX_ACCURACY;
    const result = accept(last, fix);
    if (result.moved) lastMoveAt = Math.max(lastMoveAt, fix.t);
    if (result.keep) {
      meters += result.meters;
      last = fix;
      keep.push(fix);
    }
  }
  if (keep.length && settings().saveRoute) repo.addTrackPoints(trip.id, keep);
  saveLive({ tripId: trip.id, meters, last, lastMoveAt, weak });
  if (!trip.startPoint && last) {
    const startPoint = { lat: last.lat, lng: last.lng };
    mutate((r) => r.updateTrip(trip.id, { startPoint }));
    describePoint(startPoint).then(({ address }) => {
      const current = repo.recording();
      if (address && current?.id === trip.id && !current.startAddress) mutate((r) => r.updateTrip(trip.id, { startAddress: address }));
    });
  }
  await checkAutoStop(trip);
}

async function checkAutoStop(trip: Trip) {
  const { lastMoveAt, meters, obdMeters } = useLive.getState();
  const limit = settings().autoStopMinutes * 60000;
  if (limit <= 0) return;
  const now = Date.now();
  const idle = now - Math.max(lastMoveAt, trip.startedAt);
  const started = meters > 300 || obdMeters > 300 || now - trip.startedAt > 30 * 60000;
  if (started && idle > limit) await stopRecording({ auto: true });
}

async function startGps() {
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) return;
  await Location.startLocationUpdatesAsync(GPS_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 2000,
    distanceInterval: 0,
    activityType: Location.ActivityType.AutomotiveNavigation,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: t('notify.trackingTitle'),
      notificationBody: t('notify.trackingBody'),
      notificationColor: '#0E9F6E',
      killServiceOnDestroy: false,
    },
  });
}

async function stopGps() {
  if (await Location.hasStartedLocationUpdatesAsync(GPS_TASK).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(GPS_TASK).catch(() => undefined);
  }
}

export async function ensureLocationPermission() {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await Location.requestForegroundPermissionsAsync();
  return next.granted;
}

function activeVehicleId() {
  const vehicles = repo.vehicles();
  const id = settings().vehicleId;
  return vehicles.find((v) => v.id === id)?.id ?? vehicles[0]?.id ?? null;
}

export const autoStart = { armed: true };

let starting: Promise<Trip> | null = null;

export function startRecording(source: Exclude<TripSource, 'manual'>): Promise<Trip> {
  if (!starting) {
    starting = doStart(source).finally(() => {
      starting = null;
    });
  }
  return starting;
}

async function doStart(source: Exclude<TripSource, 'manual'>): Promise<Trip> {
  const existing = repo.recording();
  if (existing) return existing;
  const vehicleId = activeVehicleId();
  if (!vehicleId) throw new Error(t('trips.noVehicle'));
  if (!(await ensureLocationPermission())) throw new LocationDeniedError();
  const vehicle = repo.vehicle(vehicleId)!;
  let odoStart = repo.lastOdometer(vehicleId);
  let obdOdometer: number | null = null;
  if (source === 'obd') {
    if (!obd.connected && vehicle.adapterId) await connectObd(vehicle.adapterId, vehicle.adapterName ?? 'OBD');
    obdOdometer = await obd.odometer();
    if (obdOdometer != null && Math.round(obdOdometer) >= odoStart) odoStart = Math.round(obdOdometer);
  }
  const again = repo.recording();
  if (again) return again;
  const trip = mutate((r) => r.startTrip({ vehicleId, source, odoStart, driver: settings().driver }));
  clearLive();
  saveLive({ tripId: trip.id, meters: 0, last: null, lastMoveAt: Date.now(), obdOdometer, obdMeters: 0, obd: obd.connected ? 'connected' : 'off' });
  await startGps();
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .then((loc) => ingest([toFix(loc)]))
    .catch(() => undefined);
  if (source === 'obd') pollObd(trip.id);
  return trip;
}

let connecting: Promise<void> | null = null;

export function connectObd(id: string, name: string): Promise<void> {
  if (obd.connected) return Promise.resolve();
  if (!connecting) {
    useLive.setState({ obd: 'connecting' });
    connecting = obd
      .connect(id, name, () => useLive.setState({ obd: 'lost', obdSpeed: null }))
      .then(() => {
        useLive.setState({ obd: 'connected' });
      })
      .catch((error) => {
        useLive.setState({ obd: 'off' });
        throw error;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
}

let pollGeneration = 0;

async function pollObd(tripId: string) {
  const generation = ++pollGeneration;
  let lastTick = Date.now();
  let lastOdoRead = 0;
  let silentSince: number | null = null;
  while (generation === pollGeneration && repo.recording()?.id === tripId) {
    if (!obd.connected) {
      await sleep(3000);
      continue;
    }
    const speed = await obd.speed().catch(() => null);
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const live = useLive.getState();
    let obdMeters = live.obdMeters;
    if (speed != null && dt < 10) obdMeters += (speed / 3.6) * dt;
    let obdOdometer = live.obdOdometer;
    if (now - lastOdoRead > 30000) {
      lastOdoRead = now;
      obdOdometer = (await obd.odometer().catch(() => null)) ?? obdOdometer;
    }
    useLive.setState({ obdSpeed: speed });
    saveLive({ obdMeters, obdOdometer, lastMoveAt: speed != null && speed > 3 ? now : live.lastMoveAt });
    silentSince = speed == null ? (silentSince ?? now) : null;
    const trip = repo.recording();
    if (settings().autoStopMinutes > 0 && silentSince != null && now - silentSince > 90000 && trip && now - trip.startedAt > 120000) {
      await stopRecording({ auto: true });
      return;
    }
    if (trip) await checkAutoStop(trip);
    await sleep(1000);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function classify(start: Place | null, end: Place | null): TripPatch {
  if (end?.kind) return { kind: end.kind, purpose: end.purpose || undefined, partner: end.partner || undefined };
  const roles = [start?.role, end?.role];
  if (roles.includes('home') && roles.includes('work')) return { kind: 'commute' };
  return {};
}

let stopTask: Promise<Trip | null> | null = null;

export function stopRecording(options: { auto?: boolean } = {}): Promise<Trip | null> {
  if (!stopTask) {
    stopTask = doStop(options).finally(() => {
      stopTask = null;
    });
  }
  return stopTask;
}

async function doStop({ auto = false }: { auto?: boolean }): Promise<Trip | null> {
  const trip = repo.recording();
  if (!trip) return null;
  stopping = true;
  autoStart.armed = false;
  try {
    pollGeneration++;
    await stopGps();
    const live = loadLive(trip.id);
    const vehicle = repo.vehicle(trip.vehicleId);
    let odoEnd: number;
    if (trip.source === 'obd' && live.obdOdometer != null && Math.round(live.obdOdometer) >= trip.odoStart) {
      odoEnd = Math.round(live.obdOdometer);
    } else if (trip.source === 'obd' && live.obdMeters > live.meters * 0.5) {
      odoEnd = trip.odoStart + Math.round(live.obdMeters / 1000);
    } else {
      odoEnd = trip.odoStart + Math.round((live.meters / 1000) * (vehicle?.gpsFactor ?? 1));
    }
    const endPoint = live.last ? { lat: live.last.lat, lng: live.last.lng } : null;
    const { address, place } = await describePoint(endPoint);
    const startPlace = matchPlace(trip.startPoint);
    const endedAt = auto ? Math.max(trip.startedAt + 60000, live.lastMoveAt || Date.now()) : Date.now();
    const done = mutate((r) =>
      r.finishTrip(trip.id, {
        endedAt,
        odoEnd,
        endPoint,
        endAddress: address,
        gpsMeters: Math.round(live.meters),
        ...classify(startPlace, place),
      }),
    );
    clearLive();
    if (obd.connected) await obd.close();
    scheduleReminders().catch(() => undefined);
    if (auto || AppState.currentState !== 'active') notifyFinished(done, place?.name ?? address).catch(() => undefined);
    return done;
  } finally {
    stopping = false;
  }
}

export async function discardRecording(reason: string) {
  if (stopTask) await stopTask;
  const trip = repo.recording();
  if (!trip) return;
  autoStart.armed = false;
  pollGeneration++;
  await stopGps();
  if (obd.connected) await obd.close();
  clearLive();
  mutate((r) => r.voidTrip(trip.id, reason));
}

export async function resumeRecording() {
  const trip = repo.recording();
  if (!trip) {
    await stopGps();
    return;
  }
  loadLive(trip.id);
  await checkAutoStop(trip);
  if (!repo.recording()) return;
  const permission = await Location.getForegroundPermissionsAsync();
  if (permission.granted) await startGps().catch(() => undefined);
  if (trip.source === 'obd') {
    const vehicle = repo.vehicle(trip.vehicleId);
    if (vehicle?.adapterId && !obd.connected) {
      connectObd(vehicle.adapterId, vehicle.adapterName ?? 'OBD').catch(() => undefined);
    }
    pollObd(trip.id);
  }
  changed();
}

export function liveDistanceKm(trip: Trip, live = useLive.getState()) {
  if (trip.source === 'obd' && live.obdOdometer != null && live.obdOdometer >= trip.odoStart) return live.obdOdometer - trip.odoStart;
  if (trip.source === 'obd' && live.obdMeters > live.meters * 0.5) return live.obdMeters / 1000;
  return live.meters / 1000;
}
