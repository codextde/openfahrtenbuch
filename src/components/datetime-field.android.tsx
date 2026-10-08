import { DatePickerDialog, Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDate, formatTime } from '@/core/format';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';

type Props = { label: string; value: number; onChange: (ms: number) => void; disabled?: boolean; min?: number; max?: number };

export function DateTimeField({ label, value, onChange, disabled, min, max }: Props) {
  const c = useColors();
  const { t, lang } = useT();
  const [step, setStep] = useState<'date' | 'time' | null>(null);
  const [pending, setPending] = useState<Date | null>(null);
  const current = new Date(value);

  return (
    <View style={[styles.row, { borderColor: c.borderStrong, backgroundColor: disabled ? c.surfaceSunken : c.surface }]}>
      <Text style={[type.body, { color: c.textSecondary, flex: 1 }]}>{label}</Text>
      <Pressable disabled={disabled} onPress={() => setStep('date')} style={[styles.chip, { backgroundColor: c.surfaceSunken }]} accessibilityRole="button" accessibilityLabel={`${label} ${formatDate(value, lang)}`}>
        <Text style={[type.callout, { color: c.text }]}>{formatDate(value, lang)}</Text>
      </Pressable>
      <Pressable disabled={disabled} onPress={() => setStep('time')} style={[styles.chip, { backgroundColor: c.surfaceSunken }]} accessibilityRole="button" accessibilityLabel={`${label} ${formatTime(value)}`}>
        <Text style={[type.callout, { color: c.text }]}>{formatTime(value)}</Text>
      </Pressable>
      {step ? (
        <Host style={styles.host}>
          {step === 'date' ? (
            <DatePickerDialog
              initialDate={new Date(Date.UTC(current.getFullYear(), current.getMonth(), current.getDate())).toISOString()}
              color={c.accent}
              confirmButtonLabel={t('common.ok')}
              dismissButtonLabel={t('common.cancel')}
              selectableDates={{ start: min != null ? new Date(min - 86400000) : undefined, end: max != null ? new Date(max) : undefined }}
              onDateSelected={(d) => {
                const next = new Date(value);
                next.setFullYear(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
                setPending(next);
                setStep(null);
                onChange(next.getTime());
              }}
              onDismissRequest={() => setStep(null)}
            />
          ) : (
            <TimePickerDialog
              initialDate={(pending ?? current).toISOString()}
              is24Hour
              color={c.accent}
              confirmButtonLabel={t('common.ok')}
              dismissButtonLabel={t('common.cancel')}
              onDateSelected={(d) => {
                const next = new Date(value);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                setStep(null);
                onChange(next.getTime());
              }}
              onDismissRequest={() => setStep(null)}
            />
          )}
        </Host>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 14, paddingLeft: space.md, paddingRight: space.sm, minHeight: 52 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  host: { position: 'absolute', width: 1, height: 1 },
});
