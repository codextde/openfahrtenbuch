import { create } from 'zustand';

import { repo } from '@/data/db';

export type Fix = { t: number; lat: number; lng: number; accuracy: number | null; speed: number | null };

export type LiveState = {
  tripId: string | null;
  meters: number;
  last: Fix | null;
  lastMoveAt: number;
  weak: boolean;
  obd: 'off' | 'connecting' | 'connected' | 'lost';
  obdOdometer: number | null;
  obdMeters: number;
  obdSpeed: number | null;
};

const empty: LiveState = {
  tripId: null,
  meters: 0,
  last: null,
  lastMoveAt: 0,
  weak: false,
  obd: 'off',
  obdOdometer: null,
  obdMeters: 0,
  obdSpeed: null,
};

export const useLive = create<LiveState>(() => ({ ...empty }));

const KEY = 'live';

export function loadLive(tripId: string): LiveState {
  const current = useLive.getState();
  if (current.tripId === tripId) return current;
  const stored = repo.meta(KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as LiveState;
      if (parsed.tripId === tripId) {
        const restored = { ...empty, ...parsed, obd: 'off' as const, obdSpeed: null };
        useLive.setState(restored);
        return restored;
      }
    } catch {}
  }
  const fresh = { ...empty, tripId, lastMoveAt: Date.now() };
  useLive.setState(fresh);
  return fresh;
}

export function saveLive(patch: Partial<LiveState>) {
  useLive.setState(patch);
  const s = useLive.getState();
  repo.setMeta(
    KEY,
    JSON.stringify({
      tripId: s.tripId,
      meters: s.meters,
      last: s.last,
      lastMoveAt: s.lastMoveAt,
      obdOdometer: s.obdOdometer,
      obdMeters: s.obdMeters,
    }),
  );
}

export function clearLive() {
  useLive.setState({ ...empty });
  repo.setMeta(KEY, null);
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const MAX_ACCURACY = 50;
const MAX_SPEED = 75;
const MOVING_SPEED = 2;

export function accept(prev: Fix | null, next: Fix): { meters: number; moved: boolean; keep: boolean } {
  if (next.accuracy != null && next.accuracy > MAX_ACCURACY) return { meters: 0, moved: false, keep: false };
  if (!prev) return { meters: 0, moved: (next.speed ?? 0) > MOVING_SPEED, keep: true };
  const d = haversine(prev, next);
  const dt = Math.max(0.5, (next.t - prev.t) / 1000);
  if (d / dt > MAX_SPEED) return { meters: 0, moved: false, keep: false };
  const noise = Math.max(6, Math.min(25, ((prev.accuracy ?? 10) + (next.accuracy ?? 10)) / 3));
  if (d < noise) return { meters: 0, moved: (next.speed ?? 0) > MOVING_SPEED, keep: false };
  return { meters: d, moved: true, keep: true };
}
