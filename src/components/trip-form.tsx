import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatInt, parseNumber } from '@/core/format';
import { missingFields, type MissingField } from '@/core/rules';
import type { Place, Trip, TripKind, TripPatch } from '@/core/types';
import { repo } from '@/data/db';
import { usePlaces } from '@/data/hooks';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';
import { placeLabel } from '@/tracking/places';

import { DateTimeField } from './datetime-field';
import { KindPicker } from './kind-picker';
import { Chips, Field, Label } from './ui';

export type Draft = {
  kind: TripKind | null;
  startedAt: number;
  endedAt: number;
  odoStart: string;
  odoEnd: string;
  startAddress: string;
  endAddress: string;
  purpose: string;
  partner: string;
  route: string;
  driver: string;
  note: string;
};

export function draftFromTrip(trip: Trip): Draft {
  return {
    kind: trip.kind,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt ?? Date.now(),
    odoStart: String(trip.odoStart),
    odoEnd: trip.odoEnd != null ? String(trip.odoEnd) : '',
    startAddress: trip.startAddress,
    endAddress: trip.endAddress,
    purpose: trip.purpose,
    partner: trip.partner,
    route: trip.route,
    driver: trip.driver,
    note: trip.note,
  };
}

export function draftToPatch(d: Draft): TripPatch {
  const odoStart = parseNumber(d.odoStart);
  const odoEnd = parseNumber(d.odoEnd);
  return {
    kind: d.kind,
    startedAt: d.startedAt,
    endedAt: d.endedAt,
    odoStart: odoStart ?? undefined,
    odoEnd: odoEnd ?? null,
    startAddress: d.startAddress.trim(),
    endAddress: d.endAddress.trim(),
    purpose: d.purpose.trim(),
    partner: d.partner.trim(),
    route: d.route.trim(),
    driver: d.driver.trim(),
    note: d.note.trim(),
  };
}

export function draftErrors(d: Draft, t: ReturnType<typeof useT>['t']) {
  const errors: Partial<Record<'odoEnd' | 'endedAt', string>> = {};
  const a = parseNumber(d.odoStart);
  const b = parseNumber(d.odoEnd);
  if (a != null && b != null && b < a) errors.odoEnd = t('trip.odoEndBeforeStart');
  if (d.endedAt <= d.startedAt) errors.endedAt = t('trip.endBeforeStart');
  return errors;
}

export function draftMissing(d: Draft): MissingField[] {
  const p = draftToPatch(d);
  return missingFields({
    kind: p.kind ?? null,
    endedAt: p.endedAt ?? null,
    odoEnd: p.odoEnd ?? null,
    endAddress: p.endAddress ?? '',
    startAddress: p.startAddress ?? '',
    purpose: p.purpose ?? '',
    partner: p.partner ?? '',
  });
}

export function TripForm({
  draft,
  onChange,
  disabled,
  gpsMeters,
  showMissing,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  disabled?: boolean;
  gpsMeters?: number;
  showMissing?: boolean;
}) {
  const c = useColors();
  const { t, lang } = useT();
  const places = usePlaces();
  const missing = showMissing ? draftMissing(draft) : [];
  const errors = draftErrors(draft, t);
  const business = draft.kind === 'business';

  const suggestions = useMemo(
    () => ({
      purpose: repo.suggestions('purpose'),
      partner: repo.suggestions('partner'),
      route: repo.suggestions('route', 4),
      end: repo.suggestions('endAddress', 4),
    }),
    [],
  );

  const placeChips = (field: 'startAddress' | 'endAddress') => {
    const labels = places.map(placeLabel);
    const extra = field === 'endAddress' ? suggestions.end.filter((s) => !labels.includes(s)) : [];
    return [...places.map((p) => p.name), ...extra].slice(0, 10);
  };

  const pickPlace = (field: 'startAddress' | 'endAddress', value: string) => {
    const place: Place | undefined = places.find((p) => p.name === value);
    if (!place) return onChange({ [field]: value });
    const patch: Partial<Draft> = { [field]: placeLabel(place) };
    if (field === 'endAddress') {
      if (place.kind && !draft.kind) patch.kind = place.kind;
      if (place.purpose && !draft.purpose) patch.purpose = place.purpose;
      if (place.partner && !draft.partner) patch.partner = place.partner;
    }
    onChange(patch);
  };

  const odoStart = parseNumber(draft.odoStart);
  const odoEnd = parseNumber(draft.odoEnd);
  const km = odoStart != null && odoEnd != null && odoEnd >= odoStart ? odoEnd - odoStart : null;
  const is = (f: MissingField) => missing.includes(f);

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <View style={styles.labelRow}>
          <Label>{t('trip.kind')}</Label>
          {is('kind') ? <View style={[styles.dot, { backgroundColor: c.danger }]} /> : null}
        </View>
        <KindPicker value={draft.kind} onChange={(kind) => onChange({ kind })} disabled={disabled} />
        {draft.kind ? <Text style={[type.caption, { color: c.textTertiary }]}>{t(`kind.${draft.kind}Hint`)}</Text> : null}
      </View>

      <View style={{ gap: space.md }}>
        <Label>{t('trip.start')}</Label>
        <DateTimeField label={t('trip.startedAt')} value={draft.startedAt} onChange={(startedAt) => onChange({ startedAt })} disabled={disabled} max={Date.now()} />
        <Field
          label={t('trip.startAddress')}
          value={draft.startAddress}
          onChangeText={(startAddress) => onChange({ startAddress })}
          placeholder={t('trip.addressPlaceholder')}
          disabled={disabled}
          missing={is('startAddress')}
          autoCapitalize="words"
        />
        {!disabled && places.length > 0 && !draft.startAddress ? <Chips items={places.map((p) => p.name)} onPick={(v) => pickPlace('startAddress', v)} /> : null}
        <Field
          label={t('trip.odoStart')}
          value={draft.odoStart}
          onChangeText={(v) => onChange({ odoStart: v.replace(/[^\d]/g, '') })}
          keyboardType="number-pad"
          disabled={disabled}
          style={[type.valueSmall, { fontSize: 18 }]}
        />
      </View>

      <View style={{ gap: space.md }}>
        <Label>{t('trip.end')}</Label>
        <DateTimeField label={t('trip.endedAt')} value={draft.endedAt} onChange={(endedAt) => onChange({ endedAt })} disabled={disabled} min={draft.startedAt} max={Date.now() + 60000} />
        {errors.endedAt ? <Text style={[type.caption, { color: c.danger }]}>{errors.endedAt}</Text> : null}
        <Field
          label={t('trip.endAddress')}
          value={draft.endAddress}
          onChangeText={(endAddress) => onChange({ endAddress })}
          placeholder={t('trip.addressPlaceholder')}
          disabled={disabled}
          missing={is('endAddress')}
          autoCapitalize="words"
        />
        {!disabled ? <Chips items={placeChips('endAddress')} onPick={(v) => pickPlace('endAddress', v)} /> : null}
        <Field
          label={t('trip.odoEnd')}
          value={draft.odoEnd}
          onChangeText={(v) => onChange({ odoEnd: v.replace(/[^\d]/g, '') })}
          keyboardType="number-pad"
          disabled={disabled}
          missing={is('odoEnd')}
          error={errors.odoEnd}
          hint={[km != null ? `${t('trip.distance')}: ${formatInt(km, lang)} km` : null, gpsMeters ? t('trip.gpsDistance', { km: formatInt(gpsMeters / 1000, lang) }) : null].filter(Boolean).join(' · ')}
          style={[type.valueSmall, { fontSize: 18 }]}
        />
      </View>

      {business ? (
        <View style={{ gap: space.md }}>
          <Label>{t('kind.business')}</Label>
          <Field
            label={t('trip.purpose')}
            value={draft.purpose}
            onChangeText={(purpose) => onChange({ purpose })}
            placeholder={t('trip.purposePlaceholder')}
            disabled={disabled}
            missing={is('purpose')}
          />
          {!disabled && !draft.purpose ? <Chips items={suggestions.purpose} onPick={(purpose) => onChange({ purpose })} /> : null}
          <Field
            label={t('trip.partner')}
            value={draft.partner}
            onChangeText={(partner) => onChange({ partner })}
            placeholder={t('trip.partnerPlaceholder')}
            disabled={disabled}
            missing={is('partner')}
          />
          {!disabled && !draft.partner ? <Chips items={suggestions.partner} onPick={(partner) => onChange({ partner })} /> : null}
          <Field
            label={`${t('trip.route')} (${t('common.optional')})`}
            value={draft.route}
            onChangeText={(route) => onChange({ route })}
            placeholder={t('trip.routePlaceholder')}
            disabled={disabled}
          />
        </View>
      ) : null}

      <View style={{ gap: space.md }}>
        <Field label={t('trip.driver')} value={draft.driver} onChangeText={(driver) => onChange({ driver })} disabled={disabled} autoCapitalize="words" />
        <Field label={`${t('trip.note')} (${t('common.optional')})`} value={draft.note} onChangeText={(note) => onChange({ note })} placeholder={t('trip.notePlaceholder')} disabled={disabled} multiline />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
