import * as Location from 'expo-location';

import type { GeoPoint, Place } from '@/core/types';
import { repo } from '@/data/db';

import { haversine } from './live';

export function matchPlace(point: GeoPoint | null, places: Place[] = repo.places()): Place | null {
  if (!point) return null;
  let best: { place: Place; d: number } | null = null;
  for (const place of places) {
    if (!place.point) continue;
    const d = haversine(point, place.point);
    if (d <= place.radius && (!best || d < best.d)) best = { place, d };
  }
  return best?.place ?? null;
}

export function placeLabel(place: Place) {
  return place.address && place.address !== place.name ? `${place.name}, ${place.address}` : place.name;
}

export function formatAddress(a: Location.LocationGeocodedAddress) {
  const street = [a.street, a.streetNumber].filter(Boolean).join(' ');
  const city = [a.postalCode, a.city ?? a.subregion].filter(Boolean).join(' ');
  const line = [street || a.name, city].filter(Boolean).join(', ');
  return line || a.formattedAddress || '';
}

export async function reverseGeocode(point: GeoPoint | null): Promise<string> {
  if (!point) return '';
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng });
    return results[0] ? formatAddress(results[0]) : '';
  } catch {
    return '';
  }
}

export async function describePoint(point: GeoPoint | null): Promise<{ address: string; place: Place | null }> {
  const place = matchPlace(point);
  if (place) return { address: placeLabel(place), place };
  return { address: await reverseGeocode(point), place: null };
}
