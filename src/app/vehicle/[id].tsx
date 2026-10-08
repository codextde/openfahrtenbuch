import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';

import { Button, Field, Group, Row, Screen, success } from '@/components/ui';
import { formatDecimal, parseNumber } from '@/core/format';
import { mutate, repo } from '@/data/db';
import { useT } from '@/i18n';
import { useSettings } from '@/store/settings';
import { space, useColors } from '@/theme';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, lang } = useT();
  const existing = id && id !== 'new' ? repo.vehicle(id) : null;
  const hasTrips = existing ? repo.tripCount(existing.id) > 0 : false;
  const [name, setName] = useState(existing?.name ?? '');
  const [plate, setPlate] = useState(existing?.plate ?? '');
  const [odometer, setOdometer] = useState(existing ? String(existing.odometerInitial) : '');
  const [listPrice, setListPrice] = useState(existing?.listPrice ? String(existing.listPrice) : '');
  const [factor, setFactor] = useState(formatDecimal(existing?.gpsFactor ?? 1, 2, lang));

  const odo = parseNumber(odometer);
  const valid = name.trim().length > 0 && odo != null;

  const save = () => {
    if (!valid) return;
    const gpsFactor = Math.min(1.2, Math.max(0.8, parseNumber(factor) ?? 1));
    const vehicle = mutate((r) =>
      r.saveVehicle({
        id: existing?.id,
        name: name.trim(),
        plate: plate.trim().toUpperCase(),
        odometerInitial: Math.round(odo!),
        adapterId: existing?.adapterId ?? null,
        adapterName: existing?.adapterName ?? null,
        vin: existing?.vin ?? null,
        listPrice: parseNumber(listPrice),
        gpsFactor,
        archived: existing?.archived ?? false,
      }),
    );
    if (!existing) useSettings.getState().set({ vehicleId: vehicle.id });
    success();
    router.back();
  };

  const archive = () => {
    if (!existing) return;
    Alert.alert(t('vehicle.archive'), t('vehicle.archiveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vehicle.archive'),
        style: 'destructive',
        onPress: () => {
          mutate((r) => r.saveVehicle({ ...existing, archived: true }));
          const next = repo.vehicles()[0];
          useSettings.getState().set({ vehicleId: next?.id ?? null });
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? existing.name : t('vehicle.newTitle') }} />
      <Screen underHeader>
        <View style={{ gap: space.lg }}>
          <Field label={t('vehicle.name')} value={name} onChangeText={setName} placeholder={t('vehicle.namePlaceholder')} autoFocus={!existing} />
          <Field label={t('vehicle.plate')} value={plate} onChangeText={setPlate} placeholder={t('vehicle.platePlaceholder')} autoCapitalize="characters" />
          <Field
            label={t('vehicle.odometer')}
            value={odometer}
            onChangeText={(v) => setOdometer(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            disabled={hasTrips}
            hint={hasTrips ? t('vehicle.odometerLocked') : undefined}
            right={<Field.Suffix text="km" />}
          />
          <Field
            label={`${t('vehicle.listPrice')} (${t('common.optional')})`}
            value={listPrice}
            onChangeText={(v) => setListPrice(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            hint={t('vehicle.listPriceHint')}
            right={<Field.Suffix text="€" />}
          />
          <Field label={t('vehicle.gpsFactor')} value={factor} onChangeText={setFactor} keyboardType="decimal-pad" hint={t('vehicle.gpsFactorHint')} />
          {existing?.vin ? <Field label={t('vehicle.vin')} value={existing.vin} disabled /> : null}
          <Button title={t('common.save')} icon="check" large disabled={!valid} onPress={save} style={{ marginTop: space.sm }} />
        </View>
        {existing ? (
          <Group style={{ marginTop: space.xxl }}>
            <Row icon="antenna" title={t('vehicle.adapter')} value={existing.adapterName ?? t('vehicle.adapterNone')} onPress={() => router.push('/adapter')} />
            {repo.vehicles().length > 1 ? (
              <Row icon="archive" iconColor={c.danger} iconBg={c.dangerSoft} title={t('vehicle.archive')} subtitle={t('vehicle.archiveBody')} destructive onPress={archive} last />
            ) : null}
          </Group>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
