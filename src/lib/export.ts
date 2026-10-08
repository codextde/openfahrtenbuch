import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildCsv, buildReportHtml } from '@/core/report';
import type { Backup } from '@/core/repo';
import { changed, repo } from '@/data/db';
import { currentLang, t } from '@/i18n';
import { settings } from '@/store/settings';

function slug(text: string) {
  return text.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'Fahrzeug';
}

function writeTemp(name: string, contents: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  return file;
}

async function share(uri: string, mimeType: string, UTI: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle: 'OpenFahrtenbuch' });
}

export function reportHtml(vehicleId: string, year: number) {
  const vehicle = repo.vehicle(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');
  const from = new Date(year, 0, 1).getTime();
  const to = new Date(year + 1, 0, 1).getTime();
  const trips = repo.trips({ vehicleId, from, to });
  const s = settings();
  return {
    vehicle,
    html: buildReportHtml({
      vehicle,
      trips,
      events: Object.fromEntries(trips.map((t) => [t.id, repo.events(t.id)])),
      from,
      to,
      head: repo.head(),
      generatedAt: Date.now(),
      lang: currentLang(),
      owner: s.owner || s.driver,
      hidePrivateDetails: s.hidePrivateDetails,
    }),
  };
}

export async function exportPdf(vehicleId: string, year: number) {
  if (repo.autoLock().length) changed();
  const { vehicle, html } = reportHtml(vehicleId, year);
  const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595, margins: { left: 28, right: 28, top: 32, bottom: 36 } });
  const target = new File(Paths.cache, `Fahrtenbuch-${slug(vehicle.plate || vehicle.name)}-${year}.pdf`);
  if (target.exists) target.delete();
  new File(uri).move(target);
  await share(target.uri, 'application/pdf', 'com.adobe.pdf');
}

export async function exportCsv(vehicleId: string, year: number) {
  const vehicle = repo.vehicle(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');
  const trips = repo.trips({ vehicleId, from: new Date(year, 0, 1).getTime(), to: new Date(year + 1, 0, 1).getTime() });
  const file = writeTemp(`Fahrtenbuch-${slug(vehicle.plate || vehicle.name)}-${year}.csv`, buildCsv({ vehicle, trips, lang: currentLang() }));
  await share(file.uri, 'text/csv', 'public.comma-separated-values-text');
}

export async function exportBackup() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const file = writeTemp(`OpenFahrtenbuch-Sicherung-${stamp}.json`, JSON.stringify(repo.backup()));
  await share(file.uri, 'application/json', 'public.json');
}

export async function pickBackup(): Promise<Backup | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'public.json', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets[0]) return null;
  const text = await new File(result.assets[0].uri).text();
  try {
    return JSON.parse(text) as Backup;
  } catch {
    throw new Error('invalid');
  }
}

export function restoreBackup(data: Backup) {
  const n = repo.restore(data, t('settings.restoreRecording'));
  changed();
  return n;
}
