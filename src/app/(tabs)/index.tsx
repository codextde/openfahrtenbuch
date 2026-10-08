import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { deadlineText, TripRow } from '@/components/trip-row';
import { Button, Card, Header, Notice, Screen, SectionTitle, tap } from '@/components/ui';
import { dayLabel, formatDecimal, formatDuration, formatInt, formatTime } from '@/core/format';
import { distance, odometerIssues } from '@/core/rules';
import type { Trip } from '@/core/types';
import { repo } from '@/data/db';
import { useActiveVehicle, useRecording, useTrips, useVehicles } from '@/data/hooks';
import { useT } from '@/i18n';
import { beginTrip } from '@/lib/start';
import { useSettings } from '@/store/settings';
import { fonts, radius, space, type, useColors } from '@/theme';
import { useLive } from '@/tracking/live';
import { liveDistanceKm } from '@/tracking/recorder';

function useNow(interval = 1000, active = true) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval, active]);
  return now;
}

function PulseDot({ color }: { color: string }) {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withTiming(0.25, { duration: 900 }), -1, true);
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, style]} />;
}

function Hero({ recording }: { recording: Trip | null }) {
  const c = useColors();
  const { t, lang } = useT();
  const vehicle = useActiveVehicle();
  const mode = useSettings((s) => s.mode);
  const now = useNow(1000, !!recording);
  const [starting, setStarting] = useState(false);
  const odometer = vehicle ? repo.lastOdometer(vehicle.id) : 0;

  const km = useLive((s) => (recording ? liveDistanceKm(recording, s) : 0));
  if (recording) {
    return (
      <PressableScale
        scaleTo={0.98}
        onPress={() => {
          tap();
          router.push('/recording');
        }}
        style={[styles.hero, { backgroundColor: c.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('trips.recording')}>
        <View style={styles.heroTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PulseDot color="#FFFFFF" />
            <Text style={[type.label, { color: 'rgba(255,255,255,0.85)' }]}>{t('trips.recording')}</Text>
          </View>
          <Text style={[type.caption, { color: 'rgba(255,255,255,0.8)' }]}>{t('trips.recordingSince', { time: formatTime(recording.startedAt) })}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text style={[type.hero, { color: '#FFFFFF' }]}>{formatDecimal(km, 1, lang)}</Text>
            <Text style={[type.callout, { color: 'rgba(255,255,255,0.8)', marginTop: -4 }]}>km · {formatDuration(now - recording.startedAt)}</Text>
          </View>
          <View style={styles.openBadge}>
            <Text style={[type.callout, { color: c.accentStrong, fontFamily: fonts.semibold }]}>{t('trips.open')}</Text>
            <Icon name="chevronRight" size={12} color={c.accentStrong} />
          </View>
        </View>
      </PressableScale>
    );
  }

  return (
    <View style={[styles.hero, { backgroundColor: c.hero }]}>
      <View style={styles.heroTop}>
        <Text style={[type.label, { color: c.onHeroSecondary }]}>{t('trips.odometer')}</Text>
        <View style={[styles.modeChip]}>
          <Icon name={mode === 'obd' ? 'antenna' : mode === 'manual' ? 'hand' : 'gps'} size={11} color={c.onHeroSecondary} />
          <Text style={[type.caption, { color: c.onHeroSecondary }]}>{t(`source.${mode}`)}</Text>
        </View>
      </View>
      <View>
        <Text style={[type.hero, { color: c.onHero }]} accessibilityLabel={`${t('trips.odometer')} ${formatInt(odometer, lang)} km`}>
          {formatInt(odometer, lang)}
        </Text>
        <Text style={[type.callout, { color: c.onHeroSecondary, marginTop: -4 }]} numberOfLines={1}>
          km · {vehicle?.name ?? ''}
          {vehicle?.plate ? ` · ${vehicle.plate}` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        {mode === 'manual' ? (
          <Button title={t('trips.addManual')} icon="pencil" large style={{ flex: 1 }} onPress={() => router.push('/trip/new')} />
        ) : (
          <>
            <Button
              title={mode === 'obd' ? t('trips.startObd') : t('trips.start')}
              icon="play"
              large
              loading={starting}
              style={{ flex: 1 }}
              onPress={async () => {
                setStarting(true);
                await beginTrip();
                setStarting(false);
              }}
            />
            <PressableScale
              onPress={() => {
                tap();
                router.push('/trip/new');
              }}
              accessibilityRole="button"
              accessibilityLabel={t('trips.addManual')}
              style={styles.squareButton}>
              <Icon name="pencil" size={20} color="#FFFFFF" />
            </PressableScale>
          </>
        )}
      </View>
    </View>
  );
}

function pickVehicle(vehicles: { id: string; name: string; plate: string }[], title: string, cancel: string) {
  const labels = vehicles.map((v) => (v.plate ? `${v.name} · ${v.plate}` : v.name));
  const choose = (i: number) => {
    if (i >= 0 && i < vehicles.length) useSettings.getState().set({ vehicleId: vehicles[i].id });
  };
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ options: [...labels, cancel], cancelButtonIndex: labels.length, title }, choose);
  } else {
    Alert.alert(title, undefined, [...labels.map((l, i) => ({ text: l, onPress: () => choose(i) })), { text: cancel, style: 'cancel' as const }]);
  }
}

export default function TripsScreen() {
  const c = useColors();
  const { t, lang } = useT();
  const vehicles = useVehicles();
  const vehicle = useActiveVehicle();
  const recording = useRecording();
  const trips = useTrips(vehicle ? { vehicleId: vehicle.id } : {});

  const { groups, open, gaps } = useMemo(() => {
    const visible = trips.filter((tr) => tr.status !== 'recording');
    const map = new Map<string, Trip[]>();
    for (const trip of visible) {
      const d = new Date(trip.startedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(trip);
    }
    const issues = vehicle ? odometerIssues(visible, vehicle.odometerInitial) : { gaps: [] };
    return {
      groups: [...map.values()],
      open: visible.filter((tr) => tr.status === 'open').sort((a, b) => a.startedAt - b.startedAt),
      gaps: issues.gaps,
    };
  }, [trips, vehicle]);

  return (
    <Screen>
      <Header
        eyebrow={vehicles.length > 1 ? `${vehicle?.name ?? ''} ▾` : vehicle?.plate || undefined}
        title={t('trips.title')}
        right={
          vehicles.length > 1 ? (
            <Button title={vehicle?.plate || vehicle?.name || ''} compact variant="secondary" icon="carSide" onPress={() => pickVehicle(vehicles, t('settings.vehicles'), t('common.cancel'))} />
          ) : undefined
        }
      />
      <Hero recording={recording} />

      {open.length > 0 ? (
        <View style={{ marginTop: space.lg }}>
          <Notice
            tone="danger"
            icon="warning"
            title={open.length === 1 ? t('trips.todoOne') : t('trips.todoBody', { n: open.length })}
            body={deadlineText(open[0], t)}
            action={t('trips.open')}
            onAction={() => router.push(`/trip/${open[0].id}`)}
          />
        </View>
      ) : null}

      {gaps.slice(0, 2).map((gap) => (
        <View key={`${gap.from}-${gap.to}`} style={{ marginTop: space.md }}>
          <Notice
            tone="warn"
            icon="ruler"
            title={t('trips.gap', { km: formatInt(gap.km, lang) })}
            body={`${formatInt(gap.from, lang)} → ${formatInt(gap.to, lang)}`}
            action={t('trips.gapAction')}
            onAction={() => router.push(`/trip/new?odoStart=${gap.from}&odoEnd=${gap.to}`)}
          />
        </View>
      ))}

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
            <Icon name="road" size={28} color={c.accentStrong} />
          </View>
          <Text style={[type.headline, { color: c.text, textAlign: 'center' }]}>{t('trips.emptyTitle')}</Text>
          <Text style={[type.body, { color: c.textSecondary, textAlign: 'center' }]}>{t('trips.emptyBody')}</Text>
        </View>
      ) : (
        groups.map((group) => {
          const km = group.filter((tr) => tr.status !== 'void').reduce((s, tr) => s + distance(tr), 0);
          return (
            <View key={group[0].id} style={{ marginTop: space.xl }}>
              <SectionTitle title={`${dayLabel(group[0].startedAt, lang)} · ${formatInt(km, lang)} km`} />
              <Card padded={false}>
                {group.map((trip, i) => (
                  <TripRow key={trip.id} trip={trip} last={i === group.length - 1} />
                ))}
              </Card>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.1)' },
  squareButton: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  openBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, marginBottom: 6 },
  empty: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.xl, paddingVertical: space.xxxl },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
});
