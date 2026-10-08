import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Card, Group, Row, Screen } from '@/components/ui';
import { formatDate, formatMoney } from '@/core/format';
import { useActiveVehicle, useCosts } from '@/data/hooks';
import { useT } from '@/i18n';
import { COST_ICON } from '@/lib/cost-icons';
import { space, type, useColors } from '@/theme';

export default function CostsScreen() {
  const c = useColors();
  const { t, lang } = useT();
  const vehicle = useActiveVehicle();
  const costs = useCosts(vehicle ? { vehicleId: vehicle.id } : {});
  const year = new Date().getFullYear();
  const total = costs.filter((x) => new Date(x.date).getFullYear() === year).reduce((s, x) => s + x.amount, 0);
  return (
    <Screen underHeader>
      <Card style={{ marginBottom: space.lg }}>
        <Text style={[type.caption, { color: c.textSecondary }]}>{t('costs.total', { year })}</Text>
        <Text style={[type.value, { color: c.text }]}>{formatMoney(total, lang)}</Text>
        <Text style={[type.caption, { color: c.textTertiary, marginTop: 4 }]}>{vehicle?.name}</Text>
      </Card>
      {costs.length === 0 ? (
        <Text style={[type.body, { color: c.textSecondary, marginBottom: space.lg }]}>{t('costs.empty')}</Text>
      ) : (
        <Group>
          {costs.map((x, i) => (
            <Row
              key={x.id}
              icon={COST_ICON[x.category]}
              title={t(`costs.cat.${x.category}`)}
              subtitle={[formatDate(x.date, lang), x.note].filter(Boolean).join(' · ')}
              value={formatMoney(x.amount, lang)}
              onPress={() => router.push(`/cost/${x.id}`)}
              last={i === costs.length - 1}
            />
          ))}
        </Group>
      )}
      <View>
        <Button title={t('costs.add')} icon="plus" onPress={() => router.push('/cost/new')} />
      </View>
    </Screen>
  );
}
