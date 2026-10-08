import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import type { IconName } from '@/components/icon-names';
import { PressableScale } from '@/components/pressable-scale';
import { Button, Field, success, tap } from '@/components/ui';
import { parseNumber } from '@/core/format';
import { mutate, repo } from '@/data/db';
import { useT } from '@/i18n';
import { pickBackup, restoreBackup } from '@/lib/export';
import { requestNotificationPermission } from '@/lib/notify';
import { type TrackingMode, useSettings } from '@/store/settings';
import { fonts, radius, space, type, useColors } from '@/theme';

const MODES: { mode: TrackingMode; icon: IconName }[] = [
  { mode: 'gps', icon: 'gps' },
  { mode: 'obd', icon: 'antenna' },
  { mode: 'manual', icon: 'hand' },
];

export default function WelcomeScreen() {
  const c = useColors();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [odometer, setOdometer] = useState('');
  const [mode, setMode] = useState<TrackingMode>('gps');
  const [driver, setDriver] = useState('');

  const odo = parseNumber(odometer);
  const vehicleValid = odo != null;

  const finish = async () => {
    const vehicle = mutate((r) =>
      r.saveVehicle({
        name: name.trim() || t('vehicle.defaultName'),
        plate: plate.trim().toUpperCase(),
        odometerInitial: Math.round(odo ?? 0),
        adapterId: null,
        adapterName: null,
        vin: null,
        listPrice: null,
        gpsFactor: 1,
        archived: false,
      }),
    );
    await requestNotificationPermission().catch(() => false);
    success();
    useSettings.getState().set({ vehicleId: vehicle.id, mode, driver: driver.trim(), owner: driver.trim(), onboarded: true });
  };

  const restore = async () => {
    try {
      const data = await pickBackup();
      if (!data) return;
      const n = restoreBackup(data);
      const first = repo.vehicles()[0];
      useSettings.getState().set({ vehicleId: first?.id ?? null, onboarded: true });
      Alert.alert(t('settings.restore'), t('settings.restoreDone', { n }));
    } catch {
      Alert.alert(t('settings.restore'), t('settings.restoreInvalid'));
    }
  };

  const points: { icon: IconName; text: string }[] = [
    { icon: 'route', text: t('welcome.point1') },
    { icon: 'shield', text: t('welcome.point2') },
    { icon: 'doc', text: t('welcome.point3') },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.progressBar, { backgroundColor: i <= step ? c.accent : c.borderStrong }]} />
          ))}
        </View>

        {step === 0 ? (
          <Animated.View key="s0" entering={FadeInRight} exiting={FadeOutLeft} style={{ flex: 1, gap: space.xl }}>
            <View style={[styles.logo, { backgroundColor: c.accent }]}>
              <Icon name="route" size={34} color="#FFFFFF" />
            </View>
            <View style={{ gap: space.sm }}>
              <Text style={[type.label, { color: c.accentStrong }]}>{t('welcome.eyebrow')}</Text>
              <Text style={[type.title, { color: c.text, fontSize: 34, lineHeight: 40 }]}>{t('welcome.title')}</Text>
              <Text style={[type.body, { color: c.textSecondary }]}>{t('welcome.body')}</Text>
            </View>
            <View style={{ gap: space.lg }}>
              {points.map((p) => (
                <View key={p.text} style={styles.point}>
                  <View style={[styles.pointIcon, { backgroundColor: c.accentSoft }]}>
                    <Icon name={p.icon} size={18} color={c.accentStrong} />
                  </View>
                  <Text style={[type.callout, { color: c.text, flex: 1 }]}>{p.text}</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Button title={t('welcome.start')} large onPress={() => setStep(1)} />
            <Pressable onPress={restore} accessibilityRole="button" style={{ alignSelf: 'center', padding: space.sm }}>
              <Text style={[type.callout, { color: c.accentStrong, fontFamily: fonts.semibold }]}>{t('settings.restore')}</Text>
            </Pressable>
            <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center' }]}>{t('welcome.legal')}</Text>
          </Animated.View>
        ) : null}

        {step === 1 ? (
          <Animated.View key="s1" entering={FadeInRight} exiting={FadeOutLeft} style={{ flex: 1, gap: space.lg }}>
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <Text style={[type.title, { color: c.text }]}>{t('welcome.vehicleTitle')}</Text>
              <Text style={[type.body, { color: c.textSecondary }]}>{t('welcome.vehicleBody')}</Text>
            </View>
            <Field label={t('vehicle.odometer')} value={odometer} onChangeText={(v) => setOdometer(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" autoFocus placeholder="48210" style={[type.value, { paddingVertical: 10 }]} right={<Field.Suffix text="km" />} />
            <Field label={t('vehicle.name')} value={name} onChangeText={setName} placeholder={t('vehicle.namePlaceholder')} />
            <Field label={`${t('vehicle.plate')} (${t('common.optional')})`} value={plate} onChangeText={setPlate} placeholder={t('vehicle.platePlaceholder')} autoCapitalize="characters" />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={t('common.back')} variant="secondary" onPress={() => setStep(0)} style={{ flex: 1 }} large />
              <Button title={t('common.continue')} onPress={() => setStep(2)} disabled={!vehicleValid} style={{ flex: 2 }} large />
            </View>
          </Animated.View>
        ) : null}

        {step === 2 ? (
          <Animated.View key="s2" entering={FadeInRight} exiting={FadeOutLeft} style={{ flex: 1, gap: space.lg }}>
            <View style={{ gap: space.sm, marginBottom: space.sm }}>
              <Text style={[type.title, { color: c.text }]}>{t('welcome.modeTitle')}</Text>
              <Text style={[type.body, { color: c.textSecondary }]}>{t('welcome.modeBody')}</Text>
            </View>
            {MODES.map((m) => {
              const active = mode === m.mode;
              return (
                <PressableScale
                  key={m.mode}
                  scaleTo={0.98}
                  onPress={() => {
                    tap();
                    setMode(m.mode);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[styles.mode, { backgroundColor: active ? c.accentSoft : c.surface, borderColor: active ? c.accent : c.borderStrong }]}>
                  <View style={[styles.pointIcon, { backgroundColor: active ? c.accent : c.surfaceSunken }]}>
                    <Icon name={m.icon} size={18} color={active ? c.onAccent : c.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[type.bodyStrong, { color: c.text }]}>{t(`mode.${m.mode}`)}</Text>
                    <Text style={[type.caption, { color: c.textSecondary }]}>{t(`mode.${m.mode}Hint`)}</Text>
                  </View>
                  <View style={[styles.radio, { borderColor: active ? c.accent : c.borderStrong }]}>{active ? <View style={[styles.radioDot, { backgroundColor: c.accent }]} /> : null}</View>
                </PressableScale>
              );
            })}
            <Field label={t('welcome.driverLabel')} value={driver} onChangeText={setDriver} placeholder={t('welcome.driverPlaceholder')} autoCapitalize="words" />
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title={t('common.back')} variant="secondary" onPress={() => setStep(1)} style={{ flex: 1 }} large />
              <Button title={t('welcome.finish')} onPress={finish} style={{ flex: 2 }} large />
            </View>
          </Animated.View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: space.xl, gap: space.xl },
  progress: { flexDirection: 'row', gap: 6 },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  logo: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pointIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mode: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1.5 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
