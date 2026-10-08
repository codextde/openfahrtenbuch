import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DateTimeField } from '@/components/datetime-field';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { Button, Field, Label, success, tap } from '@/components/ui';
import { formatDecimal, parseNumber } from '@/core/format';
import type { CostCategory } from '@/core/types';
import { mutate, repo } from '@/data/db';
import { useActiveVehicle } from '@/data/hooks';
import { useT } from '@/i18n';
import { COST_ICON } from '@/lib/cost-icons';
import { radius, space, type, useColors } from '@/theme';

const CATS: CostCategory[] = ['fuel', 'service', 'insurance', 'tax', 'leasing', 'other'];

export default function CostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const { t, lang } = useT();
  const vehicle = useActiveVehicle();
  const existing = id && id !== 'new' ? repo.costs().find((x) => x.id === id) : null;
  const [category, setCategory] = useState<CostCategory>(existing?.category ?? 'fuel');
  const [amount, setAmount] = useState(existing ? formatDecimal(existing.amount, 2, lang) : '');
  const [date, setDate] = useState(existing?.date ?? Date.now());
  const [note, setNote] = useState(existing?.note ?? '');
  const value = parseNumber(amount);

  const save = () => {
    if (!vehicle || value == null) return;
    mutate((r) => r.saveCost({ id: existing?.id, vehicleId: existing?.vehicleId ?? vehicle.id, category, amount: value, date, note: note.trim() }));
    success();
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.lg, paddingTop: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <Text style={[type.headline, { color: c.text }]}>{existing ? t(`costs.cat.${existing.category}`) : t('costs.add')}</Text>
      <View style={{ gap: space.sm }}>
        <Label>{t('costs.category')}</Label>
        <View style={styles.grid}>
          {CATS.map((cat) => {
            const active = cat === category;
            return (
              <PressableScale
                key={cat}
                onPress={() => {
                  tap();
                  setCategory(cat);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[styles.cat, { backgroundColor: active ? c.accentSoft : c.surface, borderColor: active ? c.accent : c.borderStrong }]}>
                <Icon name={COST_ICON[cat]} size={16} color={active ? c.accentStrong : c.textSecondary} />
                <Text style={[type.caption, { color: c.text }]} numberOfLines={1}>
                  {t(`costs.cat.${cat}`)}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>
      <Field label={t('costs.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" autoFocus={!existing} right={<Field.Suffix text="€" />} />
      <DateTimeField label={t('costs.date')} value={date} onChange={setDate} />
      <Field label={t('costs.note')} value={note} onChangeText={setNote} placeholder={t('costs.notePlaceholder')} />
      <Button title={t('common.save')} icon="check" large disabled={value == null} onPress={save} />
      {existing ? (
        <Button
          title={t('common.delete')}
          icon="trash"
          variant="danger"
          onPress={() =>
            Alert.alert(t('common.delete'), undefined, [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('common.delete'),
                style: 'destructive',
                onPress: () => {
                  mutate((r) => r.deleteCost(existing.id));
                  router.back();
                },
              },
            ])
          }
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cat: { width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
