import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton, success, tap } from '@/components/ui';
import { formatDecimal, formatDuration, formatInt, formatTime } from '@/core/format';
import { useRecording } from '@/data/hooks';
import { useT } from '@/i18n';
import { fonts, radius, space, type } from '@/theme';
import { useLive } from '@/tracking/live';
import { discardRecording, liveDistanceKm, stopRecording } from '@/tracking/recorder';

const BG = '#0A0C0F';
const SUB = 'rgba(255,255,255,0.55)';
const ACCENT = '#2BD49A';

function StopButton({ onStop, label, hint }: { onStop: () => void; label: string; hint: string }) {
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const gesture = Gesture.LongPress()
    .minDuration(900)
    .onBegin(() => {
      progress.value = withTiming(1, { duration: 900 });
      runOnJS(setHolding)(true);
      runOnJS(tap)();
    })
    .onStart(() => {
      runOnJS(onStop)();
    })
    .onFinalize(() => {
      cancelAnimation(progress);
      progress.value = withTiming(0, { duration: 200 });
      runOnJS(setHolding)(false);
    });
  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.stop} accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={onStop}>
        <Animated.View style={[styles.stopFill, fill]} />
        <Icon name="stop" size={20} color="#FFFFFF" />
        <Text style={[type.headline, { color: '#FFFFFF' }]}>{holding ? hint : label}</Text>
      </View>
    </GestureDetector>
  );
}

export default function RecordingScreen() {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { t, lang } = useT();
  const trip = useRecording();
  const live = useLive();
  const [now, setNow] = useState(Date.now());
  const finished = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!trip && !finished.current) router.back();
  }, [trip]);

  if (!trip) return <View style={{ flex: 1, backgroundColor: BG }} />;

  const km = liveDistanceKm(trip);
  const speed = trip.source === 'obd' && live.obdSpeed != null ? live.obdSpeed : live.last?.speed != null && now - live.last.t < 10000 ? live.last.speed * 3.6 : null;
  const odometer = trip.odoStart + Math.floor(km);

  const stop = async () => {
    finished.current = true;
    success();
    const done = await stopRecording();
    if (done) router.replace(`/trip/${done.id}?finish=1`);
    else router.back();
  };

  const discard = () => {
    Alert.alert(t('recording.discardTitle'), t('recording.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('recording.discard'),
        style: 'destructive',
        onPress: async () => {
          finished.current = true;
          await discardRecording(t('recording.discardReason'));
          router.back();
        },
      },
    ]);
  };

  const menu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('recording.discard'), t('common.cancel')], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
        (i) => i === 0 && discard(),
      );
    } else discard();
  };

  let status: { text: string; color: string } | null = null;
  if (trip.source === 'obd') {
    if (live.obd === 'connected') status = { text: t('recording.obdConnected'), color: ACCENT };
    else if (live.obd === 'lost') status = { text: t('recording.obdLost'), color: '#F2B23D' };
  }
  if (!status) {
    if (!live.last) status = { text: t('recording.waitingGps'), color: SUB };
    else if (live.weak) status = { text: t('recording.gpsWeak'), color: '#F2B23D' };
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg }]}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <IconButton icon="minimize" label={t('recording.minimize')} onPress={() => router.back()} tint="#FFFFFF" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={[type.label, { color: '#FFFFFF' }]}>{t('recording.title')}</Text>
        </View>
        <IconButton icon="more" label={t('recording.discard')} onPress={menu} tint="#FFFFFF" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
      </View>

      <View style={styles.center}>
        <Text style={[type.label, { color: SUB }]}>{t('recording.distance')}</Text>
        <Text style={styles.km} accessibilityLabel={`${formatDecimal(km, 1, lang)} km`}>
          {formatDecimal(km, 1, lang)}
        </Text>
        <Text style={[type.headline, { color: SUB, marginTop: -8 }]}>km</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={[type.label, { color: SUB }]}>{t('recording.duration')}</Text>
          <Text style={[type.value, { color: '#FFFFFF' }]}>{formatDuration(now - trip.startedAt)}</Text>
        </View>
        <View style={[styles.stat, styles.statMid]}>
          <Text style={[type.label, { color: SUB }]}>{t('recording.speed')}</Text>
          <Text style={[type.value, { color: '#FFFFFF' }]}>{speed != null ? formatInt(speed, lang) : '–'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[type.label, { color: SUB }]}>{t('recording.odometer')}</Text>
          <Text style={[type.value, { color: '#FFFFFF' }]}>{formatInt(odometer, lang)}</Text>
        </View>
      </View>

      <View style={styles.from}>
        <Icon name="pin" size={16} color={SUB} />
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: SUB }]}>
            {t('recording.from')} · {formatTime(trip.startedAt)}
          </Text>
          <Text style={[type.bodyStrong, { color: '#FFFFFF' }]} numberOfLines={1}>
            {trip.startAddress || '…'}
          </Text>
        </View>
      </View>

      {status ? (
        <View style={styles.status}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[type.caption, { color: status.color }]}>{status.text}</Text>
        </View>
      ) : (
        <Text style={[type.caption, { color: SUB, textAlign: 'center', marginBottom: space.md }]}>{t('recording.background')}</Text>
      )}

      <StopButton onStop={stop} label={t('recording.stop')} hint={t('recording.holdToStop')} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(43,212,154,0.16)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  km: { fontFamily: fonts.numBold, fontSize: 132, lineHeight: 140, color: '#FFFFFF', letterSpacing: -3, fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: space.lg, marginBottom: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statMid: { borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' },
  from: { flexDirection: 'row', gap: space.md, alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: space.lg },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: space.md },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  stop: { height: 64, borderRadius: radius.lg, backgroundColor: '#E5484D', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, overflow: 'hidden' },
  stopFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
});
