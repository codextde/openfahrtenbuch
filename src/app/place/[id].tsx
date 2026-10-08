import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, View } from 'react-native';

import { KindPicker } from '@/components/kind-picker';
import { Button, Chips, Field, Label, Segmented, success } from '@/components/ui';
import { Screen } from '@/components/ui';
import type { GeoPoint, Place, TripKind } from '@/core/types';
import { mutate, repo } from '@/data/db';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';
import { reverseGeocode } from '@/tracking/places';
import { ensureLocationPermission } from '@/tracking/recorder';

type Role = 'home' | 'work' | 'other';

export default function PlaceScreen() {
  const { id, trip: tripId } = useLocalSearchParams<{ id: string; trip?: string }>();
  const c = useColors();
  const { t } = useT();
  const existing = id && id !== 'new' ? repo.places().find((p) => p.id === id) : null;
  const trip = tripId ? repo.trip(tripId) : null;
  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? trip?.endAddress ?? '');
  const [point, setPoint] = useState<GeoPoint | null>(existing?.point ?? trip?.endPoint ?? null);
  const [radius, setRadius] = useState(String(existing?.radius ?? 150));
  const [role, setRole] = useState<Role>(existing?.role ?? 'other');
  const [kind, setKind] = useState<TripKind | null>(existing?.kind ?? (trip?.kind === 'business' ? 'business' : null));
  const [purpose, setPurpose] = useState(existing?.purpose ?? (trip?.kind === 'business' ? trip.purpose : ''));
  const [partner, setPartner] = useState(existing?.partner ?? (trip?.kind === 'business' ? trip.partner : ''));
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      if (!(await ensureLocationPermission())) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const p = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setPoint(p);
      const a = await reverseGeocode(p);
      if (a) setAddress(a);
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setLocating(false);
    }
  };

  const save = () => {
    const place: Omit<Place, 'createdAt'> = {
      id: existing?.id ?? undefined!,
      name: name.trim(),
      address: address.trim(),
      point,
      radius: Math.min(1000, Math.max(50, parseInt(radius, 10) || 150)),
      kind: role === 'other' ? kind : null,
      purpose: role === 'other' && kind === 'business' ? purpose.trim() : '',
      partner: role === 'other' && kind === 'business' ? partner.trim() : '',
      role: role === 'other' ? null : role,
    };
    mutate((r) => r.savePlace(place));
    success();
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('common.delete'), existing.name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          mutate((r) => r.deletePlace(existing.id));
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing?.name ?? t('places.add') }} />
      <Screen underHeader>
        <View style={{ gap: space.lg }}>
          <Field label={t('places.name')} value={name} onChangeText={setName} placeholder={t('places.namePlaceholder')} autoFocus={!existing} />
          <Field label={t('places.address')} value={address} onChangeText={setAddress} placeholder={t('trip.addressPlaceholder')} />
          <Button title={locating ? t('places.locating') : t('places.useCurrent')} icon="location" variant="secondary" loading={locating} onPress={locate} />
          {!point ? <Text style={[type.caption, { color: c.textTertiary }]}>{t('places.noLocation')}</Text> : null}
          <Field label={t('places.radius')} value={radius} onChangeText={(v) => setRadius(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" right={<Field.Suffix text="m" />} />
          <View style={{ gap: space.sm }}>
            <Label>{t('places.role')}</Label>
            <Segmented<Role>
              value={role}
              onChange={setRole}
              options={[
                { value: 'home', label: t('places.home') },
                { value: 'work', label: t('places.work') },
                { value: 'other', label: t('places.customer') },
              ]}
            />
          </View>
          {role === 'other' ? (
            <View style={{ gap: space.md }}>
              <Label>{t('places.defaults')}</Label>
              <KindPicker value={kind} onChange={setKind} />
              {kind === 'business' ? (
                <>
                  <Field label={t('trip.purpose')} value={purpose} onChangeText={setPurpose} placeholder={t('trip.purposePlaceholder')} />
                  {!purpose ? <Chips items={repo.suggestions('purpose')} onPick={setPurpose} /> : null}
                  <Field label={t('trip.partner')} value={partner} onChangeText={setPartner} placeholder={t('trip.partnerPlaceholder')} />
                </>
              ) : null}
            </View>
          ) : null}
          <Button title={t('common.save')} icon="check" large disabled={!name.trim()} onPress={save} />
          {existing ? <Button title={t('common.delete')} icon="trash" variant="danger" onPress={remove} /> : null}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
