import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { formatInt, formatTime } from '@/core/format';
import { daysLeft, distance, isLocked } from '@/core/rules';
import type { Trip } from '@/core/types';
import { useT } from '@/i18n';
import { fonts, kindColor, radius, space, type, useColors } from '@/theme';

import { Icon } from './icon';
import { PressableScale } from './pressable-scale';
import { Pill, tap } from './ui';

export function deadlineText(trip: Trip, t: ReturnType<typeof useT>['t']) {
  const days = daysLeft(trip);
  if (days < 0) return t('trips.overdue');
  if (days === 0) return t('trips.today');
  if (days === 1) return t('trips.dayLeft');
  return t('trips.daysLeft', { n: days });
}

export function TripRow({ trip, last }: { trip: Trip; last?: boolean }) {
  const c = useColors();
  const { t, lang } = useT();
  const k = kindColor(c, trip.kind);
  const voided = trip.status === 'void';
  const open = trip.status === 'open';
  const isPrivate = trip.kind === 'private';
  const from = trip.startAddress || t('trips.unknownPlace');
  const to = trip.endAddress || t('trips.unknownPlace');
  return (
    <PressableScale
      scaleTo={0.985}
      onPress={() => {
        tap();
        router.push(`/trip/${trip.id}`);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${t(`kind.${trip.kind ?? 'none'}`)}, ${formatInt(distance(trip), lang)} km, ${from} → ${to}`}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <View style={[styles.kindBar, { backgroundColor: voided ? c.borderStrong : k.fg }]} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={styles.top}>
          <Text style={[type.caption, { color: c.textSecondary }]}>
            {formatTime(trip.startedAt)}
            {trip.endedAt ? ` – ${formatTime(trip.endedAt)}` : ''}
          </Text>
          {open ? <Pill text={deadlineText(trip, t)} color={c.danger} bg={c.dangerSoft} /> : null}
          {voided ? <Pill text={t('trips.void')} color={c.textSecondary} bg={c.surfaceSunken} /> : null}
          {trip.lockedAt ? <Icon name="lock" size={11} color={c.textTertiary} /> : null}
        </View>
        <View style={styles.route}>
          <View style={styles.dots}>
            <View style={[styles.dot, { borderColor: c.textTertiary }]} />
            <View style={[styles.line, { backgroundColor: c.borderStrong }]} />
            <View style={[styles.dot, { backgroundColor: k.fg, borderColor: k.fg }]} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[type.callout, { color: voided ? c.textTertiary : c.textSecondary, textDecorationLine: voided ? 'line-through' : 'none' }]} numberOfLines={1}>
              {from}
            </Text>
            <Text style={[type.bodyStrong, { color: voided ? c.textTertiary : c.text, textDecorationLine: voided ? 'line-through' : 'none' }]} numberOfLines={1}>
              {to}
            </Text>
            {trip.kind === 'business' && trip.purpose ? (
              <Text style={[type.caption, { color: c.textSecondary }]} numberOfLines={1}>
                {trip.purpose}
                {trip.partner ? ` · ${trip.partner}` : ''}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[type.valueSmall, { color: voided ? c.textTertiary : c.text }]}>{formatInt(distance(trip), lang)}</Text>
        <Text style={[type.caption, { color: c.textTertiary, marginTop: -2 }]}>km</Text>
        <View style={[styles.kindPill, { backgroundColor: k.bg }]}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: k.fg }} numberOfLines={1}>
            {isPrivate ? t('kind.private') : t(`kind.${trip.kind ?? 'none'}`)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

export function isTripLocked(trip: Trip) {
  return isLocked(trip);
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md + 2, paddingRight: space.lg, paddingLeft: space.md, alignItems: 'stretch' },
  kindBar: { width: 3, borderRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  route: { flexDirection: 'row', gap: space.sm + 2 },
  dots: { alignItems: 'center', paddingTop: 6, width: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  line: { width: 1.5, flex: 1, minHeight: 12, marginVertical: 2, maxHeight: 16 },
  right: { alignItems: 'flex-end', minWidth: 58, gap: 2 },
  kindPill: { marginTop: 4, paddingHorizontal: 7, paddingVertical: 2.5, borderRadius: radius.pill },
});
