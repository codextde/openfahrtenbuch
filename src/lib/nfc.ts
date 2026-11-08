import NfcManager, { Ndef, NfcError, NfcTech } from 'react-native-nfc-manager';

import { TAG_URL } from '@/lib/actions';

let started: Promise<void> | null = null;

export async function nfcSupported() {
  try {
    return await NfcManager.isSupported();
  } catch {
    return false;
  }
}

export async function nfcEnabled() {
  try {
    return await NfcManager.isEnabled();
  } catch {
    return true;
  }
}

export const openNfcSettings = () => NfcManager.goToNfcSetting().catch(() => false);

export async function writeTag(hold: string, done: string) {
  started ??= NfcManager.start().catch((error) => {
    started = null;
    throw error;
  });
  await started;
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef, { alertMessage: hold });
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(TAG_URL), Ndef.androidApplicationRecord('de.codext.fahrtenbuch')]);
    await NfcManager.ndefHandler.writeNdefMessage(bytes);
    await NfcManager.setAlertMessageIOS(done).catch(() => undefined);
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => undefined);
  }
}

export const cancelWrite = () => NfcManager.cancelTechnologyRequest().catch(() => undefined);

export const isCancel = (error: unknown) => error instanceof NfcError.UserCancel;
