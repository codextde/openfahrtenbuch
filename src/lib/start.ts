import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';

import { repo } from '@/data/db';
import { t } from '@/i18n';
import { settings } from '@/store/settings';
import { LocationDeniedError, startRecording } from '@/tracking/recorder';

export async function beginTrip(source?: 'gps' | 'obd') {
  const mode = source ?? (settings().mode === 'obd' ? 'obd' : 'gps');
  if (mode === 'obd') {
    const vehicles = repo.vehicles();
    const vehicle = vehicles.find((v) => v.id === settings().vehicleId) ?? vehicles[0];
    if (!vehicle?.adapterId) {
      router.push('/adapter');
      return;
    }
  }
  try {
    await startRecording(mode);
    router.push('/recording');
  } catch (error) {
    if (error instanceof LocationDeniedError) {
      Alert.alert(t('permission.locationTitle'), t('permission.locationBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('permission.openSettings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const message = error instanceof Error ? (error.message === 'no-answer' ? t('adapter.noAnswer') : error.message) : String(error);
    if (mode === 'obd') {
      Alert.alert(t('adapter.title'), message, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mode.gps'), onPress: () => beginTrip('gps') },
      ]);
      return;
    }
    Alert.alert(t('common.error'), message);
  }
}
