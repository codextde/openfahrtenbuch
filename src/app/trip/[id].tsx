import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import type { IconName } from '@/components/icon-names';
import { Prompt } from '@/components/prompt';
import { RouteSketch } from '@/components/route-sketch';
import { type Draft, draftErrors, draftFromTrip, draftMissing, draftToPatch, TripForm } from '@/components/trip-form';
import { deadlineText } from '@/components/trip-row';
import { Button, Card, Group, Label, Notice, Pill, Row, Screen, success } from '@/components/ui';
import { formatDate, formatDateTime, formatInt, formatTime } from '@/core/format';
import { changeText, isRealChange } from '@/core/report';
import { deadline, distance, isLocked } from '@/core/rules';
import type { LedgerAction, TripEvent } from '@/core/types';
import { mutate, repo } from '@/data/db';
import { useEvents, useTrip } from '@/data/hooks';
import { useT } from '@/i18n';
import { scheduleReminders } from '@/lib/notify';
import { kindColor, radius, space, type, useColors } from '@/theme';

const EVENT_ICON: Record<LedgerAction, IconName> = {
  create: 'play',
  complete: 'checkCircle',
  update: 'pencil',
  lock: 'lock',
  void: 'voidIcon',
  annotate: 'note',
};

function History({ events }: { events: TripEvent[] }) {
  const c = useColors();
  const { t, lang } = useT();
  const title = (e: TripEvent) =>
    ({
      create: t('trip.historyCreated'),
      complete: t('trip.historyCompleted'),
      update: t('trip.historyUpdated'),
      lock: t('trip.historyLocked'),
      void: t('trip.historyVoided'),
      annotate: t('trip.historyAnnotated'),
    })[e.action];
  return (
    <View style={{ gap: 0 }}>
      {events.map((e, i) => {
        const real = e.changes.filter(isRealChange);
        const filled = e.changes.filter((ch) => !isRealChange(ch) && ch.field !== 'note');
        const detail = [
          ...real.map((ch) => changeText(ch, lang)),
          e.action === 'complete' || e.action === 'update' ? filled.map((ch) => t(`trip.field.${ch.field}`)).join(', ') : '',
          e.text,
        ].filter(Boolean);
        return (
          <View key={e.seq} style={styles.event}>
            <View style={styles.eventRail}>
              <View style={[styles.eventDot, { backgroundColor: c.surfaceSunken }]}>
                <Icon name={EVENT_ICON[e.action]} size={11} color={e.action === 'void' ? c.danger : c.textSecondary} />
              </View>
              {i < events.length - 1 ? <View style={[styles.eventLine, { backgroundColor: c.borderStrong }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: space.lg, gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
                <Text style={[type.callout, { color: c.text }]}>{title(e)}</Text>
                <Text style={[type.caption, { color: c.textTertiary }]}>{formatDateTime(e.at, lang)}</Text>
              </View>
              {detail.map((d, j) => (
                <Text key={j} style={[type.caption, { color: real.length && j < real.length ? c.warn : c.textSecondary }]}>
                  {d}
                </Text>
              ))}
              <Text style={[type.caption, { color: c.textTertiary, fontSize: 10.5 }]} selectable>
                #{e.seq} · {e.hash.slice(0, 16)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function TripScreen() {
  const { id, finish } = useLocalSearchParams<{ id: string; finish?: string }>();
  const c = useColors();
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const trip = useTrip(id);
  const events = useEvents(id);
  const track = useMemo(() => (id ? repo.track(id) : []), [id]);
  const [draft, setDraft] = useState<Draft | null>(trip ? draftFromTrip(trip) : null);
  const [dirty, setDirty] = useState(false);
  const [prompt, setPrompt] = useState<'void' | 'annotate' | null>(null);
  const baseline = useRef(trip?.updatedAt);

  useEffect(() => {
    if (trip && (!dirty || baseline.current !== trip.updatedAt)) {
      setDraft(draftFromTrip(trip));
      baseline.current = trip.updatedAt;
      setDirty(false);
    }
  }, [trip?.updatedAt]);

  if (!trip || !draft) return <Screen underHeader>{null}</Screen>;

  const locked = isLocked(trip);
  const voided = trip.status === 'void';
  const k = kindColor(c, trip.kind);
  const missing = draftMissing(draft);
  const errors = draftErrors(draft, t);
  const hasErrors = Object.keys(errors).length > 0;
  const finishing = finish === '1';

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setDirty(true);
  };

  const save = () => {
    if (hasErrors) return;
    try {
      mutate((r) => r.updateTrip(trip.id, draftToPatch(draft)));
      success();
      setDirty(false);
      scheduleReminders().catch(() => undefined);
      if (finishing) router.back();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : String(error));
    }
  };

  const lock = () => {
    Alert.alert(t('trip.lockTitle'), t('trip.lockBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('trip.lock'), onPress: () => mutate((r) => r.lockTrip(trip.id)) },
    ]);
  };

  const openMaps = () => {
    const s = trip.startPoint;
    const e = trip.endPoint;
    if (!e) return;
    const url =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?${s ? `saddr=${s.lat},${s.lng}&` : ''}daddr=${e.lat},${e.lng}`
        : `https://www.google.com/maps/dir/?api=1${s ? `&origin=${s.lat},${s.lng}` : ''}&destination=${e.lat},${e.lng}`;
    Linking.openURL(url).catch(() => undefined);
  };

  let notice: React.ReactNode = null;
  if (voided) notice = <Notice tone="info" icon="voidIcon" title={t('trips.void')} body={t('trip.voidedInfo', { reason: trip.voidReason })} />;
  else if (trip.lockedAt) notice = <Notice tone="info" icon="lock" title={t('trips.locked')} body={t('trip.lockedInfo', { date: formatDate(trip.lockedAt, lang) })} />;
  else if (trip.status === 'open')
    notice = (
      <Notice
        tone={Date.now() > deadline(trip) ? 'danger' : 'warn'}
        icon="warning"
        title={`${t('trip.missing')}: ${missing.map((m) => t(`trip.field.${m}`)).join(', ')}`}
        body={Date.now() > deadline(trip) ? t('trip.lateInfo') : `${deadlineText(trip, t)} · ${t('trip.deadlineInfo', { date: formatDate(deadline(trip), lang) })}`}
      />
    );
  else if (trip.status === 'done') notice = <Notice tone="good" icon="checkCircle" title={t('trip.complete')} body={t('trip.autoLockInfo', { date: formatDate(deadline(trip), lang) })} />;

  const showSave = !locked && (dirty || finishing);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: finishing ? t('trip.finishTitle') : t('trip.title', { n: trip.number }) }} />
      <Screen underHeader bottomInset={showSave ? 120 : undefined}>
        <Card style={{ gap: space.md }}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={[type.display, { color: voided ? c.textTertiary : c.text }]}>
                {formatInt(distance(trip), lang)} <Text style={[type.headline, { color: c.textSecondary }]}>km</Text>
              </Text>
              <Text style={[type.callout, { color: c.textSecondary }]}>
                {formatDate(trip.startedAt, lang)} · {formatTime(trip.startedAt)}
                {trip.endedAt ? ` – ${formatTime(trip.endedAt)}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Pill text={t(`kind.${trip.kind ?? 'none'}`)} color={k.fg} bg={k.bg} />
              <Pill text={t(`source.${trip.source}`)} color={c.textSecondary} bg={c.surfaceSunken} icon={trip.source === 'obd' ? 'antenna' : trip.source === 'gps' ? 'gps' : 'hand'} />
            </View>
          </View>
          {track.length >= 2 || (trip.startPoint && trip.endPoint) ? (
            <RouteSketch points={track} start={trip.startPoint} end={trip.endPoint} color={trip.kind ? k.fg : c.accent} />
          ) : null}
          {trip.endPoint ? <Button title={t('trip.openMaps')} icon="maps" variant="secondary" compact onPress={openMaps} /> : null}
        </Card>

        {notice ? <View style={{ marginTop: space.lg }}>{notice}</View> : null}
        {finishing && !locked ? (
          <View style={{ marginTop: space.md }}>
            <Notice tone="info" icon="gauge" title={t('trip.checkOdometer')} body={t('vehicle.gpsFactorHint')} />
          </View>
        ) : null}

        <View style={{ marginTop: space.xl }}>
          <TripForm draft={draft} onChange={update} disabled={locked} gpsMeters={trip.gpsMeters} showMissing={!voided} />
        </View>

        {!voided ? (
          <Group style={{ marginTop: space.xxl }}>
            {trip.endPoint && !locked ? (
              <Row icon="pin" title={t('trip.savePlace')} onPress={() => router.push(`/place/new?trip=${trip.id}`)} />
            ) : null}
            {trip.status === 'done' && !trip.lockedAt ? <Row icon="lock" title={t('trip.lock')} subtitle={t('trip.lockBody')} onPress={lock} /> : null}
            <Row icon="note" title={t('trip.annotate')} subtitle={t('trip.annotateBody')} onPress={() => setPrompt('annotate')} last={!!trip.lockedAt} />
            {!trip.lockedAt ? (
              <Row icon="voidIcon" iconColor={c.danger} iconBg={c.dangerSoft} title={t('trip.voidAction')} subtitle={t('trip.voidBody')} destructive onPress={() => setPrompt('void')} last />
            ) : null}
          </Group>
        ) : null}

        <View style={{ marginTop: voided ? space.xxl : 0 }}>
          <Label style={{ marginBottom: space.md, marginLeft: space.xs }}>{t('trip.history')}</Label>
          <Card>
            <History events={events} />
          </Card>
        </View>
      </Screen>

      {showSave ? (
        <View style={[styles.saveBar, { paddingBottom: insets.bottom + space.md, backgroundColor: c.background, borderTopColor: c.border }]}>
          {missing.length > 0 && draft.kind ? (
            <Text style={[type.caption, { color: c.textSecondary, textAlign: 'center' }]} numberOfLines={1}>
              {t('trip.missing')}: {missing.map((m) => t(`trip.field.${m}`)).join(', ')}
            </Text>
          ) : null}
          <Button title={finishing ? t('trip.finish') : t('trip.save')} icon="check" large disabled={hasErrors || (!dirty && !finishing)} onPress={save} />
        </View>
      ) : null}

      <Prompt
        visible={prompt === 'void'}
        title={t('trip.voidTitle')}
        body={t('trip.voidBody')}
        placeholder={t('trip.voidReasonPlaceholder')}
        confirm={t('trip.voidAction')}
        destructive
        onClose={() => setPrompt(null)}
        onSubmit={(reason) => {
          mutate((r) => r.voidTrip(trip.id, reason));
          scheduleReminders().catch(() => undefined);
        }}
      />
      <Prompt
        visible={prompt === 'annotate'}
        title={t('trip.annotateTitle')}
        body={t('trip.annotateBody')}
        confirm={t('common.save')}
        onClose={() => setPrompt(null)}
        onSubmit={(text) => mutate((r) => r.annotate(trip.id, text))}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  event: { flexDirection: 'row', gap: space.md },
  eventRail: { alignItems: 'center', width: 22 },
  eventDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  eventLine: { width: 1.5, flex: 1, marginTop: 2 },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
