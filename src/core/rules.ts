import type { Trip, TripKind } from './types';

export const DAY = 24 * 60 * 60 * 1000;
export const COMPLETE_WITHIN_DAYS = 7;

export type MissingField = 'kind' | 'endedAt' | 'odoEnd' | 'endAddress' | 'purpose' | 'partner' | 'startAddress';

export function missingFields(trip: Pick<Trip, 'kind' | 'endedAt' | 'odoEnd' | 'endAddress' | 'startAddress' | 'purpose' | 'partner'>) {
  const missing: MissingField[] = [];
  if (!trip.kind) missing.push('kind');
  if (trip.endedAt == null) missing.push('endedAt');
  if (trip.odoEnd == null) missing.push('odoEnd');
  if (trip.kind === 'business') {
    if (!trip.startAddress.trim()) missing.push('startAddress');
    if (!trip.endAddress.trim()) missing.push('endAddress');
    if (!trip.purpose.trim()) missing.push('purpose');
    if (!trip.partner.trim()) missing.push('partner');
  }
  return missing;
}

export function isComplete(trip: Parameters<typeof missingFields>[0]) {
  return missingFields(trip).length === 0;
}

export function deadline(trip: Pick<Trip, 'endedAt' | 'startedAt'>) {
  return (trip.endedAt ?? trip.startedAt) + COMPLETE_WITHIN_DAYS * DAY;
}

export function daysLeft(trip: Pick<Trip, 'endedAt' | 'startedAt'>, now = Date.now()) {
  return Math.floor((deadline(trip) - now) / DAY);
}

export function isLocked(trip: Pick<Trip, 'lockedAt' | 'status'>) {
  return trip.lockedAt != null || trip.status === 'void';
}

export function shouldAutoLock(trip: Trip, now = Date.now()) {
  return trip.status === 'done' && trip.lockedAt == null && trip.endedAt != null && now > deadline(trip);
}

export function distance(trip: Pick<Trip, 'odoStart' | 'odoEnd'>) {
  return trip.odoEnd == null ? 0 : Math.max(0, trip.odoEnd - trip.odoStart);
}

export type Gap = { afterId: string | null; beforeId: string; from: number; to: number; km: number };
export type Overlap = { aId: string; bId: string; km: number };

export function odometerIssues(trips: Trip[], odometerInitial: number) {
  const list = trips
    .filter((t) => t.status !== 'void' && t.status !== 'recording')
    .sort((a, b) => a.odoStart - b.odoStart || a.startedAt - b.startedAt);
  const gaps: Gap[] = [];
  const overlaps: Overlap[] = [];
  let cursor = odometerInitial;
  let prev: Trip | null = null;
  for (const trip of list) {
    if (trip.odoStart > cursor) {
      gaps.push({ afterId: prev?.id ?? null, beforeId: trip.id, from: cursor, to: trip.odoStart, km: trip.odoStart - cursor });
    } else if (prev && trip.odoStart < cursor) {
      overlaps.push({ aId: prev.id, bId: trip.id, km: cursor - trip.odoStart });
    }
    const end = trip.odoEnd ?? trip.odoStart;
    if (end > cursor) {
      cursor = end;
      prev = trip;
    }
  }
  return { gaps, overlaps, lastOdometer: cursor };
}

export type KindTotals = Record<TripKind | 'unclassified', { km: number; trips: number }>;

export function totals(trips: Trip[]) {
  const out: KindTotals = {
    business: { km: 0, trips: 0 },
    private: { km: 0, trips: 0 },
    commute: { km: 0, trips: 0 },
    unclassified: { km: 0, trips: 0 },
  };
  for (const trip of trips) {
    if (trip.status === 'void' || trip.status === 'recording') continue;
    const bucket = out[trip.kind ?? 'unclassified'];
    bucket.km += distance(trip);
    bucket.trips += 1;
  }
  const km = out.business.km + out.private.km + out.commute.km + out.unclassified.km;
  return { ...out, km };
}

export type CompareInput = {
  listPrice: number;
  totalCosts: number;
  totalKm: number;
  privateKm: number;
  commuteKm: number;
  commuteDistanceKm: number;
  months: number;
};

export function compareMethods(input: CompareInput) {
  const listPrice = Math.floor(input.listPrice / 100) * 100;
  const flatPrivate = listPrice * 0.01 * input.months;
  const flatCommute = listPrice * 0.0003 * input.commuteDistanceKm * input.months;
  const perKm = input.totalKm > 0 ? input.totalCosts / input.totalKm : 0;
  const logPrivate = perKm * input.privateKm;
  const logCommute = perKm * input.commuteKm;
  const flat = flatPrivate + flatCommute;
  const logbook = logPrivate + logCommute;
  return { flat, flatPrivate, flatCommute, logbook, logPrivate, logCommute, perKm, saving: flat - logbook };
}
