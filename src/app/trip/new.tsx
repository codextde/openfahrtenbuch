import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Draft, draftErrors, draftToPatch, TripForm } from '@/components/trip-form';
import { Button, Notice, Screen, success } from '@/components/ui';
import { formatInt, parseNumber } from '@/core/format';
import { mutate, repo } from '@/data/db';
import { useActiveVehicle } from '@/data/hooks';
import { useT } from '@/i18n';
import { scheduleReminders } from '@/lib/notify';
import { useSettings } from '@/store/settings';
import { space, useColors } from '@/theme';

export default function NewTripScreen() {
  const params = useLocalSearchParams<{ odoStart?: string; odoEnd?: string }>();
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const vehicle = useActiveVehicle();
  const driver = useSettings((s) => s.driver);
  const last = vehicle ? repo.lastOdometer(vehicle.id) : 0;
  const now = Date.now();
  const [draft, setDraft] = useState<Draft>({
    kind: params.odoStart ? 'private' : null,
    startedAt: now - 45 * 60000,
    endedAt: now,
    odoStart: params.odoStart ?? String(last),
    odoEnd: params.odoEnd ?? '',
    startAddress: '',
    endAddress: '',
    purpose: '',
    partner: '',
    route: '',
    driver,
    note: '',
  });
  const errors = draftErrors(draft, t);
  const odoStart = parseNumber(draft.odoStart);
  const odoEnd = parseNumber(draft.odoEnd);
  const valid = !!vehicle && odoStart != null && odoEnd != null && Object.keys(errors).length === 0;

  const save = () => {
    if (!vehicle || odoStart == null || odoEnd == null) return;
    try {
      const patch = draftToPatch(draft);
      const trip = mutate((r) =>
        r.addManualTrip({
          ...patch,
          vehicleId: vehicle.id,
          source: 'manual',
          odoStart,
          odoEnd,
          startedAt: draft.startedAt,
          endedAt: draft.endedAt,
          driver: patch.driver,
        }),
      );
      success();
      scheduleReminders().catch(() => undefined);
      router.replace(`/trip/${trip.id}`);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen underHeader bottomInset={120}>
        {odoStart != null && odoStart < last && !params.odoStart ? (
          <View style={{ marginBottom: space.lg }}>
            <Notice tone="warn" icon="warning" title={t('trip.odoBeforeLast', { km: formatInt(last, lang) })} />
          </View>
        ) : null}
        <TripForm draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} showMissing={false} />
      </Screen>
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + space.md, backgroundColor: c.background, borderTopColor: c.border }]}>
        <Button title={t('trip.save')} icon="check" large disabled={!valid} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
