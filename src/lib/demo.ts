import { Repo } from '@/core/repo';
import type { GeoPoint, TripKind } from '@/core/types';
import { changed, repo, sql } from '@/data/db';
import { currentLang } from '@/i18n';
import { useSettings } from '@/store/settings';
import { saveLive } from '@/tracking/live';

export const SCREENSHOT_MODE = process.env.EXPO_PUBLIC_SCREENSHOTS === '1';

const P = {
  home: { lat: 49.1503, lng: 9.9561 },
  office: { lat: 49.1124, lng: 9.7364 },
  heilbronn: { lat: 49.1427, lng: 9.2109 },
  crailsheim: { lat: 49.1342, lng: 10.0717 },
  stuttgart: { lat: 48.7758, lng: 9.1829 },
  rothenburg: { lat: 49.3772, lng: 10.1791 },
  aldi: { lat: 49.1191, lng: 9.7502 },
};

function curve(a: GeoPoint, b: GeoPoint, n = 80, bend = 0.18) {
  const out: { lat: number; lng: number }[] = [];
  const mx = (a.lat + b.lat) / 2 + (b.lng - a.lng) * bend;
  const my = (a.lng + b.lng) / 2 - (b.lat - a.lat) * bend;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const wob = Math.sin(t * Math.PI * 6) * 0.0018;
    out.push({
      lat: (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * mx + t ** 2 * b.lat + wob,
      lng: (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * my + t ** 2 * b.lng - wob,
    });
  }
  return out;
}

export function seedDemo() {
  if (repo.trips().length > 0) return;
  const de = currentLang() === 'de';
  const day = 86400000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const base = today.getTime();
  let clock = base - 20 * day;
  const r = new Repo(sql, () => clock);

  const car = r.saveVehicle({
    name: de ? 'Firmenwagen' : 'Company car',
    plate: 'SHA-CX 320',
    odometerInitial: 48210,
    adapterId: null,
    adapterName: null,
    vin: null,
    listPrice: 54900,
    gpsFactor: 1.02,
    archived: false,
  });
  r.savePlace({ name: de ? 'Zuhause' : 'Home', address: 'Hauptstraße 12, 74549 Wolpertshausen', point: P.home, radius: 150, kind: null, purpose: '', partner: '', role: 'home' });
  r.savePlace({ name: 'Codext GmbH', address: 'Am Wasen 4, 74523 Schwäbisch Hall', point: P.office, radius: 150, kind: null, purpose: '', partner: '', role: 'work' });
  r.savePlace({
    name: de ? 'Kunde Weber Bau' : 'Client Weber Bau',
    address: 'Lise-Meitner-Str. 3, 74074 Heilbronn',
    point: P.heilbronn,
    radius: 200,
    kind: 'business',
    purpose: de ? 'Projektbesprechung' : 'Project meeting',
    partner: 'Weber Bau GmbH',
    role: null,
  });

  type Spec = { d: number; h: number; dur: number; km: number; from: keyof typeof P; to: keyof typeof P; kind: TripKind | null; purpose?: string; partner?: string; fromA: string; toA: string };
  const A = {
    home: de ? 'Zuhause, Hauptstraße 12, 74549 Wolpertshausen' : 'Home, Hauptstraße 12, 74549 Wolpertshausen',
    office: 'Codext GmbH, Am Wasen 4, 74523 Schwäbisch Hall',
    heilbronn: de ? 'Kunde Weber Bau, Lise-Meitner-Str. 3, 74074 Heilbronn' : 'Client Weber Bau, Lise-Meitner-Str. 3, 74074 Heilbronn',
    crailsheim: 'Karlstraße 21, 74564 Crailsheim',
    stuttgart: 'Königstraße 28, 70173 Stuttgart',
    rothenburg: 'Marktplatz 1, 91541 Rothenburg ob der Tauber',
    aldi: 'Kocherstraße 8, 74523 Schwäbisch Hall',
  };
  const specs: Spec[] = [
    { d: 13, h: 7.6, dur: 24, km: 19, from: 'home', to: 'office', kind: 'commute', fromA: A.home, toA: A.office },
    { d: 13, h: 9.5, dur: 52, km: 61, from: 'office', to: 'heilbronn', kind: 'business', purpose: de ? 'Projektbesprechung Shop-Relaunch' : 'Shop relaunch project meeting', partner: 'Weber Bau GmbH', fromA: A.office, toA: A.heilbronn },
    { d: 13, h: 13.2, dur: 55, km: 62, from: 'heilbronn', to: 'office', kind: 'business', purpose: de ? 'Rückfahrt Projektbesprechung' : 'Return from project meeting', partner: 'Weber Bau GmbH', fromA: A.heilbronn, toA: A.office },
    { d: 13, h: 17.4, dur: 25, km: 19, from: 'office', to: 'home', kind: 'commute', fromA: A.office, toA: A.home },
    { d: 9, h: 10, dur: 70, km: 54, from: 'home', to: 'rothenburg', kind: 'private', fromA: A.home, toA: A.rothenburg },
    { d: 9, h: 16, dur: 68, km: 54, from: 'rothenburg', to: 'home', kind: 'private', fromA: A.rothenburg, toA: A.home },
    { d: 6, h: 7.7, dur: 23, km: 19, from: 'home', to: 'office', kind: 'commute', fromA: A.home, toA: A.office },
    { d: 6, h: 11, dur: 80, km: 92, from: 'office', to: 'stuttgart', kind: 'business', purpose: de ? 'Workshop Shopify Plus' : 'Shopify Plus workshop', partner: 'Müller Sport AG', fromA: A.office, toA: A.stuttgart },
    { d: 6, h: 16.5, dur: 95, km: 111, from: 'stuttgart', to: 'home', kind: 'business', purpose: de ? 'Rückfahrt Workshop' : 'Return from workshop', partner: 'Müller Sport AG', fromA: A.stuttgart, toA: A.home },
    { d: 3, h: 8.1, dur: 22, km: 19, from: 'home', to: 'office', kind: 'commute', fromA: A.home, toA: A.office },
    { d: 3, h: 12.3, dur: 9, km: 3, from: 'office', to: 'aldi', kind: 'private', fromA: A.office, toA: A.aldi },
    { d: 3, h: 12.8, dur: 9, km: 3, from: 'aldi', to: 'office', kind: 'private', fromA: A.aldi, toA: A.office },
    { d: 1, h: 8.0, dur: 24, km: 19, from: 'home', to: 'office', kind: 'commute', fromA: A.home, toA: A.office },
    { d: 1, h: 14.2, dur: 31, km: 27, from: 'office', to: 'crailsheim', kind: 'business', purpose: de ? 'Abnahme Website' : 'Website sign-off', partner: 'Autohaus Krämer', fromA: A.office, toA: A.crailsheim },
    { d: 1, h: 16.0, dur: 26, km: 18, from: 'crailsheim', to: 'home', kind: null, fromA: A.crailsheim, toA: A.home },
    { d: 0, h: 7.9, dur: 24, km: 19, from: 'home', to: 'office', kind: 'commute', fromA: A.home, toA: A.office },
  ];

  let odo = 48210;
  for (const s of specs) {
    const start = base - s.d * day + s.h * 3600000;
    clock = start;
    const trip = r.startTrip({ vehicleId: car.id, source: s.d === 9 ? 'manual' : 'gps', odoStart: odo, startAddress: s.fromA, startPoint: P[s.from], driver: 'Daniel Ehrhardt' });
    const pts = curve(P[s.from], P[s.to]);
    r.addTrackPoints(trip.id, pts.map((p, i) => ({ t: start + i * 15000, lat: p.lat, lng: p.lng, accuracy: 6, speed: 18 })));
    clock = start + s.dur * 60000 + 40000;
    odo += s.km;
    r.finishTrip(trip.id, {
      endedAt: start + s.dur * 60000,
      odoEnd: odo,
      endAddress: s.toA,
      endPoint: P[s.to],
      gpsMeters: s.km * 985,
      kind: s.kind ?? undefined,
      purpose: s.purpose,
      partner: s.partner,
    });
  }
  const workshop = r.trips({ vehicleId: car.id }).find((t) => t.purpose.startsWith('Workshop') || t.purpose.startsWith('Shopify'));
  if (workshop) {
    clock = workshop.endedAt! + 2 * 3600000;
    r.updateTrip(workshop.id, { route: de ? 'Über B19 und A6, Umleitung wegen Baustelle bei Weinsberg' : 'Via B19 and A6, detour for roadworks near Weinsberg' });
  }
  clock = Date.now();
  r.autoLock();
  for (const [cat, amount, d] of [
    ['fuel', 64.2, 12],
    ['fuel', 58.9, 5],
    ['leasing', 389.0, 7],
    ['insurance', 61.5, 7],
    ['service', 24.9, 3],
  ] as const) {
    r.saveCost({ vehicleId: car.id, category: cat, amount, date: Date.now() - d * day, note: '' });
  }

  useSettings.getState().set({ vehicleId: car.id, driver: 'Daniel Ehrhardt', owner: 'Daniel Ehrhardt', commuteDistanceKm: 19, onboarded: true, autoStopMinutes: 0 });
  changed();
}

export function seedLive() {
  if (repo.recording()) return;
  const car = repo.vehicles()[0];
  if (!car) return;
  const odo = repo.lastOdometer(car.id);
  const r = new Repo(sql, () => Date.now() - 23 * 60000);
  const live = r.startTrip({ vehicleId: car.id, source: 'gps', odoStart: odo, startAddress: 'Codext GmbH, Am Wasen 4, 74523 Schwäbisch Hall', startPoint: P.office, driver: 'Daniel Ehrhardt' });
  saveLive({ tripId: live.id, meters: 21400, last: { t: Date.now() + 3600000 * 5, lat: 49.13, lng: 9.5, accuracy: 5, speed: 27.5 }, lastMoveAt: Date.now() + 3600000 * 5, weak: false });
  changed();
}
