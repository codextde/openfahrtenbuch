import { formatDate, formatDateTime, formatDecimal, formatInt, formatTime, type Lang } from './format';
import { shortHash } from './ledger';
import { deadline, distance, odometerIssues, totals } from './rules';
import type { FieldChange, LedgerEntry, Trip, TripEvent, TripKind, Vehicle } from './types';

const L = {
  de: {
    title: 'Fahrtenbuch',
    vehicle: 'Fahrzeug',
    plate: 'Kennzeichen',
    period: 'Zeitraum',
    owner: 'Halter / Nutzer',
    generated: 'Erstellt am',
    total: 'Gesamt',
    trips: 'Fahrten',
    odoRange: 'Kilometerstand',
    nr: 'Nr.',
    date: 'Datum / Uhrzeit',
    odoStart: 'km Beginn',
    odoEnd: 'km Ende',
    km: 'km',
    kind: 'Art',
    route: 'Start → Ziel, Route',
    purpose: 'Reisezweck / Geschäftspartner',
    driver: 'Fahrer',
    recorded: 'Erfasst',
    business: 'Dienstlich',
    private: 'Privat',
    commute: 'Wohnung–Arbeit',
    unclassified: 'Offen',
    privateHidden: 'Privatfahrt',
    commuteNote: 'Fahrt Wohnung – erste Tätigkeitsstätte',
    detour: 'Umweg / Route',
    changed: 'Geändert am',
    voided: 'Storniert am',
    note: 'Nachtrag am',
    lockedOn: 'festgeschrieben',
    late: 'nachgetragen',
    daysAfter: 'Tage nach Fahrtende',
    gap: 'Lücke im Kilometerstand',
    gapText: 'nicht erfasst',
    overlap: 'Überschneidung im Kilometerstand',
    empty: '–',
    integrity: 'Manipulationsschutz',
    integrityText:
      'Jede Erfassung und jede Änderung wird unveränderlich in einer fortlaufenden SHA-256-Kette gespeichert. Fahrten können nicht gelöscht, nur storniert werden. Nachträgliche Änderungen sind bei der jeweiligen Fahrt mit Datum, Uhrzeit und ursprünglichem Inhalt ausgewiesen. Vollständig erfasste Fahrten werden 7 Tage nach Fahrtende festgeschrieben.',
    head: 'Kettenstand',
    entries: 'Einträge',
    software: 'Erstellt mit OpenFahrtenbuch (Open Source, fahrtenbuch.codext.de)',
    fields: {
      startedAt: 'Beginn',
      endedAt: 'Ende',
      odoStart: 'km Beginn',
      odoEnd: 'km Ende',
      startAddress: 'Start',
      endAddress: 'Ziel',
      kind: 'Art',
      purpose: 'Reisezweck',
      partner: 'Geschäftspartner',
      route: 'Route',
      driver: 'Fahrer',
      note: 'Notiz',
    } as Record<string, string>,
    csv: [
      'Nr.',
      'Datum Beginn',
      'Uhrzeit Beginn',
      'Datum Ende',
      'Uhrzeit Ende',
      'Kilometerstand Beginn',
      'Kilometerstand Ende',
      'Strecke km',
      'Art',
      'Startadresse',
      'Zieladresse',
      'Reiseroute',
      'Reisezweck',
      'Geschäftspartner',
      'Fahrer',
      'Erfassung',
      'Status',
      'Erfasst am',
      'Festgeschrieben am',
      'Storno-Grund',
    ],
    status: { recording: 'Läuft', open: 'Unvollständig', done: 'Vollständig', void: 'Storniert' },
    source: { gps: 'GPS', obd: 'OBD', manual: 'Manuell' },
  },
  en: {
    title: 'Mileage log',
    vehicle: 'Vehicle',
    plate: 'Licence plate',
    period: 'Period',
    owner: 'Owner / user',
    generated: 'Generated on',
    total: 'Total',
    trips: 'Trips',
    odoRange: 'Odometer',
    nr: 'No.',
    date: 'Date / time',
    odoStart: 'Odo start',
    odoEnd: 'Odo end',
    km: 'km',
    kind: 'Type',
    route: 'Start → destination, route',
    purpose: 'Purpose / business contact',
    driver: 'Driver',
    recorded: 'Recorded',
    business: 'Business',
    private: 'Private',
    commute: 'Commute',
    unclassified: 'Open',
    privateHidden: 'Private trip',
    commuteNote: 'Trip between home and first place of work',
    detour: 'Detour / route',
    changed: 'Changed on',
    voided: 'Voided on',
    note: 'Note added on',
    lockedOn: 'locked',
    late: 'completed late',
    daysAfter: 'days after the trip',
    gap: 'Odometer gap',
    gapText: 'not recorded',
    overlap: 'Odometer overlap',
    empty: '–',
    integrity: 'Tamper protection',
    integrityText:
      'Every entry and every change is stored immutably in a continuous SHA-256 chain. Trips cannot be deleted, only voided. Later changes are shown next to the trip with date, time and the original content. Complete trips are locked 7 days after the trip ended.',
    head: 'Chain head',
    entries: 'entries',
    software: 'Generated with OpenFahrtenbuch (open source, fahrtenbuch.codext.de)',
    fields: {
      startedAt: 'Start',
      endedAt: 'End',
      odoStart: 'Odo start',
      odoEnd: 'Odo end',
      startAddress: 'Start',
      endAddress: 'Destination',
      kind: 'Type',
      purpose: 'Purpose',
      partner: 'Business contact',
      route: 'Route',
      driver: 'Driver',
      note: 'Note',
    } as Record<string, string>,
    csv: [
      'No.',
      'Start date',
      'Start time',
      'End date',
      'End time',
      'Odometer start',
      'Odometer end',
      'Distance km',
      'Type',
      'Start address',
      'Destination address',
      'Route',
      'Purpose',
      'Business contact',
      'Driver',
      'Source',
      'Status',
      'Completed at',
      'Locked at',
      'Void reason',
    ],
    status: { recording: 'Recording', open: 'Incomplete', done: 'Complete', void: 'Voided' },
    source: { gps: 'GPS', obd: 'OBD', manual: 'Manual' },
  },
};

export function labels(lang: Lang) {
  return L[lang];
}

export function kindLabel(kind: TripKind | null, lang: Lang) {
  return L[lang][kind ?? 'unclassified'];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function valueText(field: string, value: unknown, lang: Lang): string {
  if (value == null || value === '') return L[lang].empty;
  if (field === 'startedAt' || field === 'endedAt') return formatDateTime(value as number, lang);
  if (field === 'odoStart' || field === 'odoEnd') return formatInt(value as number, lang);
  if (field === 'kind') return kindLabel(value as TripKind, lang);
  return String(value);
}

export function isRealChange(change: FieldChange) {
  return change.field !== 'note' && change.from != null && change.from !== '';
}

export function changeText(change: FieldChange, lang: Lang) {
  const name = L[lang].fields[change.field] ?? change.field;
  return `${name}: „${valueText(change.field, change.from, lang)}“ → „${valueText(change.field, change.to, lang)}“`;
}

export type ReportInput = {
  vehicle: Vehicle;
  trips: Trip[];
  events: Record<string, TripEvent[]>;
  from: number;
  to: number;
  head: LedgerEntry | null;
  generatedAt: number;
  lang: Lang;
  owner: string;
  hidePrivateDetails?: boolean;
};

export function buildReportHtml(input: ReportInput) {
  const { lang, vehicle } = input;
  const l = L[lang];
  const trips = input.trips
    .filter((t) => t.status !== 'recording' && t.vehicleId === vehicle.id)
    .sort((a, b) => a.odoStart - b.odoStart || a.startedAt - b.startedAt || a.number - b.number);
  const active = trips.filter((t) => t.status !== 'void');
  const sum = totals(active);
  const { gaps, overlaps } = odometerIssues(active, vehicle.odometerInitial);
  const share = (km: number) => (sum.km > 0 ? `${formatDecimal((km / sum.km) * 100, 1, lang)} %` : '0 %');
  const firstOdo = active[0]?.odoStart;
  const lastOdo = active.length ? Math.max(...active.map((t) => t.odoEnd ?? t.odoStart)) : undefined;

  const rows: string[] = [];
  for (const trip of trips) {
    const gap = gaps.find((g) => g.beforeId === trip.id && trip.status !== 'void');
    if (gap && active[0]?.id !== trip.id) {
      rows.push(
        `<tr class="gap"><td colspan="10">${l.gap}: ${formatInt(gap.from, lang)} → ${formatInt(gap.to, lang)} (${formatInt(gap.km, lang)} km) ${l.gapText}</td></tr>`,
      );
    }
    rows.push(tripRow(trip, input.events[trip.id] ?? [], input));
  }
  for (const o of overlaps) {
    const a = trips.find((t) => t.id === o.aId);
    const b = trips.find((t) => t.id === o.bId);
    if (a && b) rows.push(`<tr class="gap"><td colspan="10">${l.overlap}: Nr. ${a.number} / Nr. ${b.number} (${formatInt(o.km, lang)} km)</td></tr>`);
  }

  const kpi = (label: string, value: string, sub = '') =>
    `<div class="kpi"><div class="kpi-l">${label}</div><div class="kpi-v">${value}</div>${sub ? `<div class="kpi-s">${sub}</div>` : ''}</div>`;

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${l.title}</title><style>
@page { size: A4 landscape; margin: 12mm 10mm 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: #15181d; font-size: 8.6pt; margin: 0; }
h1 { font-size: 18pt; margin: 0 0 2mm; letter-spacing: -0.3pt; }
.meta { display: flex; gap: 8mm; color: #4a515c; margin-bottom: 4mm; flex-wrap: wrap; }
.meta b { color: #15181d; font-weight: 600; }
.kpis { display: flex; gap: 3mm; margin-bottom: 5mm; }
.kpi { flex: 1; border: 0.3mm solid #dfe3e8; border-radius: 2.5mm; padding: 2.5mm 3mm; }
.kpi-l { font-size: 7pt; text-transform: uppercase; letter-spacing: 0.6pt; color: #6a717c; }
.kpi-v { font-size: 13pt; font-weight: 700; margin-top: 0.8mm; font-variant-numeric: tabular-nums; }
.kpi-s { font-size: 7.5pt; color: #6a717c; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
th { text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.5pt; color: #6a717c; font-weight: 600; border-bottom: 0.4mm solid #15181d; padding: 1.5mm 1.5mm; }
td { padding: 1.6mm 1.5mm; border-bottom: 0.2mm solid #e6e9ed; vertical-align: top; }
tr { page-break-inside: avoid; }
td.n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.d { white-space: nowrap; }
.pill { display: inline-block; padding: 0.3mm 1.6mm; border-radius: 2mm; font-size: 7.2pt; font-weight: 600; }
.k-business { background: #e3edff; color: #1d4fbf; }
.k-private { background: #fff1d6; color: #8a5a00; }
.k-commute { background: #efe6ff; color: #5b34b0; }
.k-unclassified { background: #fde4e4; color: #a32121; }
.sub { color: #6a717c; font-size: 7.6pt; margin-top: 0.6mm; }
.log td { border-bottom: 0.2mm solid #e6e9ed; padding-top: 0; color: #8a4b00; font-size: 7.6pt; }
.log div { margin-top: 0.4mm; }
tr.void td { color: #9aa1ab; text-decoration: line-through; }
tr.void td.why { text-decoration: none; }
tr.gap td { background: #fff6e5; color: #8a5a00; font-weight: 600; }
.foot { margin-top: 6mm; border-top: 0.3mm solid #dfe3e8; padding-top: 3mm; color: #4a515c; font-size: 7.6pt; display: flex; gap: 8mm; }
.foot .t { flex: 2; }
.foot .h { flex: 1; font-family: Menlo, monospace; font-size: 7pt; word-break: break-all; }
</style></head><body>
<h1>${l.title}</h1>
<div class="meta">
<span>${l.vehicle}: <b>${esc(vehicle.name)}</b></span>
${vehicle.plate ? `<span>${l.plate}: <b>${esc(vehicle.plate)}</b></span>` : ''}
<span>${l.period}: <b>${formatDate(input.from, lang)} – ${formatDate(input.to - 1, lang)}</b></span>
${input.owner ? `<span>${l.owner}: <b>${esc(input.owner)}</b></span>` : ''}
<span>${l.generated}: <b>${formatDateTime(input.generatedAt, lang)}</b></span>
</div>
<div class="kpis">
${kpi(l.total, `${formatInt(sum.km, lang)} km`, `${active.length} ${l.trips}`)}
${kpi(l.business, `${formatInt(sum.business.km, lang)} km`, share(sum.business.km))}
${kpi(l.private, `${formatInt(sum.private.km, lang)} km`, share(sum.private.km))}
${kpi(l.commute, `${formatInt(sum.commute.km, lang)} km`, share(sum.commute.km))}
${kpi(l.odoRange, firstOdo != null && lastOdo != null ? `${formatInt(firstOdo, lang)} – ${formatInt(lastOdo, lang)}` : l.empty)}
</div>
<table><thead><tr>
<th>${l.nr}</th><th>${l.date}</th><th>${l.odoStart}</th><th>${l.odoEnd}</th><th>${l.km}</th><th>${l.kind}</th><th>${l.route}</th><th>${l.purpose}</th><th>${l.driver}</th><th>${l.recorded}</th>
</tr></thead><tbody>
${rows.join('\n')}
</tbody></table>
<div class="foot">
<div class="t"><b>${l.integrity}.</b> ${l.integrityText}<br/>${l.software}</div>
<div class="h">${input.head ? `${l.head} #${input.head.seq} (${input.head.seq} ${l.entries})<br/>${input.head.hash}` : ''}</div>
</div>
</body></html>`;
}

function tripRow(trip: Trip, events: TripEvent[], input: ReportInput) {
  const { lang } = input;
  const l = L[lang];
  const hide = input.hidePrivateDetails !== false && trip.kind === 'private';
  const end = trip.endedAt;
  const sameDay = end != null && formatDate(end, lang) === formatDate(trip.startedAt, lang);
  const when = `${formatDate(trip.startedAt, lang)}<div class="sub">${formatTime(trip.startedAt)}${
    end != null ? ` – ${sameDay ? formatTime(end) : formatDateTime(end, lang)}` : ''
  }</div>`;
  let route: string;
  if (hide) route = `<span class="sub">${l.privateHidden}</span>`;
  else {
    route = `${esc(trip.startAddress || l.empty)} → ${esc(trip.endAddress || l.empty)}`;
    if (trip.route.trim()) route += `<div class="sub">${l.detour}: ${esc(trip.route)}</div>`;
  }
  let purpose: string;
  if (trip.kind === 'business') {
    purpose = `${esc(trip.purpose || l.empty)}${trip.partner ? `<div class="sub">${esc(trip.partner)}</div>` : ''}`;
  } else if (trip.kind === 'commute') purpose = `<span class="sub">${l.commuteNote}</span>`;
  else if (trip.kind === 'private') purpose = `<span class="sub">${l.private}</span>`;
  else purpose = '';

  const done = trip.completedAt ?? trip.createdAt;
  const lateDays = trip.completedAt != null ? Math.floor((trip.completedAt - (trip.endedAt ?? trip.startedAt)) / 86400000) : 0;
  let recorded = formatDateTime(done, lang);
  if (trip.completedAt != null && trip.completedAt > deadline(trip)) {
    recorded += `<div class="sub">${l.late} (${lateDays} ${l.daysAfter})</div>`;
  }
  if (trip.lockedAt != null) recorded += `<div class="sub">${l.lockedOn} ${formatDate(trip.lockedAt, lang)}</div>`;

  const log: string[] = [];
  for (const event of events) {
    const real = event.changes.filter(isRealChange);
    if (real.length) {
      log.push(`<div>${l.changed} ${formatDateTime(event.at, lang)}: ${real.map((c) => esc(changeText(c, lang))).join('; ')}</div>`);
    }
    if (event.action === 'annotate') log.push(`<div>${l.note} ${formatDateTime(event.at, lang)}: ${esc(event.text)}</div>`);
    if (event.action === 'void') log.push(`<div>${l.voided} ${formatDateTime(event.at, lang)}: ${esc(event.text)}</div>`);
  }

  const kind = trip.kind ?? 'unclassified';
  const cls = trip.status === 'void' ? ' class="void"' : '';
  const main = `<tr${cls}>
<td class="n">${trip.number}</td>
<td class="d">${when}</td>
<td class="n">${formatInt(trip.odoStart, lang)}</td>
<td class="n">${trip.odoEnd != null ? formatInt(trip.odoEnd, lang) : l.empty}</td>
<td class="n"><b>${formatInt(distance(trip), lang)}</b></td>
<td><span class="pill k-${kind}">${kindLabel(trip.kind, lang)}</span></td>
<td>${route}</td>
<td>${purpose}</td>
<td>${esc(trip.driver || l.empty)}</td>
<td class="d">${recorded}</td>
</tr>`;
  return log.length ? `${main}<tr class="log"><td></td><td colspan="9" class="why">${log.join('')}</td></tr>` : main;
}

const csvCell = (value: string | number | null | undefined) => {
  const s = value == null ? '' : String(value);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv({ vehicle, trips, lang }: { vehicle: Vehicle; trips: Trip[]; lang: Lang }) {
  const l = L[lang];
  const list = trips
    .filter((t) => t.status !== 'recording' && t.vehicleId === vehicle.id)
    .sort((a, b) => a.odoStart - b.odoStart || a.number - b.number);
  const lines = [l.csv.join(';')];
  for (const t of list) {
    lines.push(
      [
        t.number,
        formatDate(t.startedAt, lang),
        formatTime(t.startedAt),
        t.endedAt != null ? formatDate(t.endedAt, lang) : '',
        t.endedAt != null ? formatTime(t.endedAt) : '',
        t.odoStart,
        t.odoEnd ?? '',
        distance(t),
        kindLabel(t.kind, lang),
        t.startAddress,
        t.endAddress,
        t.route,
        t.purpose,
        t.partner,
        t.driver,
        l.source[t.source],
        l.status[t.status],
        t.completedAt != null ? formatDateTime(t.completedAt, lang) : '',
        t.lockedAt != null ? formatDateTime(t.lockedAt, lang) : '',
        t.voidReason,
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return `﻿${lines.join('\n')}\n`;
}

export { shortHash };
