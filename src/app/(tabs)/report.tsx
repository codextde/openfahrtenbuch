import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Card, Group, Header, Notice, Row, Screen, SectionTitle, tap } from '@/components/ui';
import { formatDecimal, formatInt, formatMoney } from '@/core/format';
import { compareMethods, odometerIssues, totals } from '@/core/rules';
import type { TripKind } from '@/core/types';
import { useActiveVehicle, useCosts, useTrips } from '@/data/hooks';
import { useT } from '@/i18n';
import { exportBackup, exportCsv, exportPdf } from '@/lib/export';
import { useSettings } from '@/store/settings';
import { fonts, kindColor, radius, space, type, useColors } from '@/theme';

export default function ReportScreen() {
  const c = useColors();
  const { t, lang } = useT();
  const vehicle = useActiveVehicle();
  const commuteDistanceKm = useSettings((s) => s.commuteDistanceKm);
  const allTrips = useTrips(vehicle ? { vehicleId: vehicle.id } : {});
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    for (const trip of allTrips) set.add(new Date(trip.startedAt).getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [allTrips, thisYear]);
  const [year, setYear] = useState(thisYear);
  const [busy, setBusy] = useState<string | null>(null);

  const from = new Date(year, 0, 1).getTime();
  const to = new Date(year + 1, 0, 1).getTime();
  const trips = allTrips.filter((tr) => tr.startedAt >= from && tr.startedAt < to);
  const costs = useCosts(vehicle ? { vehicleId: vehicle.id, from, to } : {});
  const sum = totals(trips);
  const open = trips.filter((tr) => tr.status === 'open').length;
  const issues = vehicle ? odometerIssues(allTrips, vehicle.odometerInitial) : { gaps: [], overlaps: [] };
  const gaps = issues.gaps.filter((g) => {
    const before = allTrips.find((tr) => tr.id === g.beforeId);
    return before && before.startedAt >= from && before.startedAt < to;
  }).length;
  const costTotal = costs.reduce((s, x) => s + x.amount, 0);
  const firstMonth = trips.length ? Math.min(...trips.map((tr) => new Date(tr.startedAt).getMonth())) : 0;
  const lastMonth = year === thisYear ? new Date().getMonth() : 11;
  const months = Math.max(1, lastMonth - firstMonth + 1);
  const compare =
    vehicle?.listPrice && costTotal > 0 && sum.km > 0
      ? compareMethods({
          listPrice: vehicle.listPrice,
          totalCosts: costTotal,
          totalKm: sum.km,
          privateKm: sum.private.km,
          commuteKm: sum.commute.km,
          commuteDistanceKm,
          months,
        })
      : null;

  const run = async (key: string, task: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await task();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };

  const kinds: TripKind[] = ['business', 'private', 'commute'];

  return (
    <Screen>
      <Header eyebrow={vehicle ? [vehicle.name, vehicle.plate].filter(Boolean).join(' · ') : undefined} title={t('report.title')} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, marginBottom: space.lg }}>
        {years.map((y) => (
          <PressableScale
            key={y}
            onPress={() => {
              tap();
              setYear(y);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: y === year }}
            style={[styles.year, { backgroundColor: y === year ? c.text : c.surface, borderColor: c.borderStrong }]}>
            <Text style={[type.callout, { color: y === year ? c.background : c.text, fontFamily: fonts.semibold }]}>{y}</Text>
          </PressableScale>
        ))}
      </ScrollView>

      <Card style={{ gap: space.lg }}>
        <View>
          <Text style={[type.label, { color: c.textTertiary }]}>{t('report.total')}</Text>
          <Text style={[type.display, { color: c.text }]}>
            {formatInt(sum.km, lang)} <Text style={[type.headline, { color: c.textSecondary }]}>km</Text>
          </Text>
          <Text style={[type.caption, { color: c.textSecondary }]}>{t('report.trips', { n: sum.business.trips + sum.private.trips + sum.commute.trips + sum.unclassified.trips })}</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: c.surfaceSunken }]}>
          {kinds.map((kind) =>
            sum[kind].km > 0 ? <View key={kind} style={{ flex: sum[kind].km, backgroundColor: kindColor(c, kind).fg }} /> : null,
          )}
          {sum.unclassified.km > 0 ? <View style={{ flex: sum.unclassified.km, backgroundColor: c.danger }} /> : null}
        </View>
        <View style={styles.legend}>
          {kinds.map((kind) => {
            const share = sum.km > 0 ? (sum[kind].km / sum.km) * 100 : 0;
            return (
              <View key={kind} style={styles.legendItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.swatch, { backgroundColor: kindColor(c, kind).fg }]} />
                  <Text style={[type.caption, { color: c.textSecondary }]}>{t(`kind.${kind}`)}</Text>
                </View>
                <Text style={[type.valueSmall, { color: c.text }]}>{formatInt(sum[kind].km, lang)}</Text>
                <Text style={[type.caption, { color: c.textTertiary }]}>{formatDecimal(share, 1, lang)} %</Text>
              </View>
            );
          })}
        </View>
      </Card>

      <SectionTitle title={t('report.issues')} style={{ marginTop: space.xl }} />
      {open === 0 && gaps === 0 ? (
        <Notice tone="good" icon="checkCircle" title={t('report.allGood')} body={t('report.allGoodBody')} />
      ) : (
        <View style={{ gap: space.sm }}>
          {open > 0 ? <Notice tone="danger" icon="warning" title={open === 1 ? t('report.openTripsOne') : t('report.openTrips', { n: open })} action={t('trips.open')} onAction={() => router.navigate('/')} /> : null}
          {gaps > 0 ? <Notice tone="warn" icon="ruler" title={gaps === 1 ? t('report.gapsOne') : t('report.gaps', { n: gaps })} action={t('trips.open')} onAction={() => router.navigate('/')} /> : null}
        </View>
      )}

      <Group title={t('report.exportTitle')} style={{ marginTop: space.xl }}>
        <Row
          icon="doc"
          title={t('report.pdf')}
          subtitle={busy === 'pdf' ? t('report.exporting') : t('report.pdfHint')}
          onPress={() => vehicle && run('pdf', () => exportPdf(vehicle.id, year))}
          right={<Icon name="share" size={16} color={c.textTertiary} />}
        />
        <Row
          icon="table"
          title={t('report.csv')}
          subtitle={busy === 'csv' ? t('report.exporting') : t('report.csvHint')}
          onPress={() => vehicle && run('csv', () => exportCsv(vehicle.id, year))}
          right={<Icon name="share" size={16} color={c.textTertiary} />}
        />
        <Row
          icon="archive"
          title={t('report.backup')}
          subtitle={busy === 'backup' ? t('report.exporting') : t('report.backupHint')}
          onPress={() => run('backup', exportBackup)}
          right={<Icon name="share" size={16} color={c.textTertiary} />}
          last
        />
      </Group>

      <SectionTitle title={t('report.costsTitle')} action={t('report.manageCosts')} onAction={() => router.push('/costs')} />
      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={[type.caption, { color: c.textSecondary }]}>{t('report.costs', { year })}</Text>
            <Text style={[type.value, { color: c.text }]}>{formatMoney(costTotal, lang)}</Text>
          </View>
          {sum.km > 0 && costTotal > 0 ? (
            <Text style={[type.callout, { color: c.textSecondary }]}>{t('report.perKm', { value: formatMoney(costTotal / sum.km, lang) })}</Text>
          ) : null}
        </View>
        <View style={[styles.divider, { backgroundColor: c.border }]} />
        <Text style={[type.bodyStrong, { color: c.text }]}>{t('report.compare')}</Text>
        {compare ? (
          <>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {[
                { label: t('report.flat'), value: compare.flat, best: compare.flat <= compare.logbook },
                { label: t('report.logbook'), value: compare.logbook, best: compare.logbook < compare.flat },
              ].map((m) => (
                <View key={m.label} style={[styles.method, { backgroundColor: m.best ? c.accentSoft : c.surfaceSunken, borderColor: m.best ? c.accent : 'transparent' }]}>
                  <Text style={[type.caption, { color: c.textSecondary }]}>{m.label}</Text>
                  <Text style={[type.valueSmall, { color: c.text }]}>{formatMoney(m.value, lang)}</Text>
                </View>
              ))}
            </View>
            <Text style={[type.callout, { color: c.text }]}>
              {compare.saving > 0 ? t('report.saving', { value: formatMoney(compare.saving, lang) }) : t('report.noSaving')}
            </Text>
            <Text style={[type.caption, { color: c.textTertiary }]}>{t('report.compareNote')}</Text>
          </>
        ) : (
          <Text style={[type.callout, { color: c.textSecondary }]}>{t('report.compareMissing')}</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  year: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  bar: { height: 10, borderRadius: 5, overflow: 'hidden', flexDirection: 'row', gap: 2 },
  legend: { flexDirection: 'row', gap: space.sm },
  legendItem: { flex: 1, gap: 2 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  divider: { height: StyleSheet.hairlineWidth },
  method: { flex: 1, padding: space.md, borderRadius: radius.md, gap: 4, borderWidth: 1 },
});
