import { useMemo } from 'react';

import type { Trip } from '@/core/types';
import { useSettings } from '@/store/settings';

import { repo, useDataVersion } from './db';

export function useVehicles() {
  const v = useDataVersion();
  return useMemo(() => repo.vehicles(), [v]);
}

export function useActiveVehicle() {
  const vehicles = useVehicles();
  const id = useSettings((s) => s.vehicleId);
  return vehicles.find((x) => x.id === id) ?? vehicles[0] ?? null;
}

export function useTrips(filter: Parameters<typeof repo.trips>[0] = {}) {
  const v = useDataVersion();
  const key = JSON.stringify(filter);
  return useMemo(() => repo.trips(filter), [v, key]);
}

export function useTrip(id: string | undefined): Trip | null {
  const v = useDataVersion();
  return useMemo(() => (id ? repo.trip(id) : null), [v, id]);
}

export function useRecording() {
  const v = useDataVersion();
  return useMemo(() => repo.recording(), [v]);
}

export function usePlaces() {
  const v = useDataVersion();
  return useMemo(() => repo.places(), [v]);
}

export function useCosts(filter: Parameters<typeof repo.costs>[0] = {}) {
  const v = useDataVersion();
  const key = JSON.stringify(filter);
  return useMemo(() => repo.costs(filter), [v, key]);
}

export function useEvents(tripId: string | undefined) {
  const v = useDataVersion();
  return useMemo(() => (tripId ? repo.events(tripId) : []), [v, tripId]);
}
