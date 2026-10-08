import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, Group, Row, Screen } from '@/components/ui';
import { usePlaces } from '@/data/hooks';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';

export default function PlacesScreen() {
  const c = useColors();
  const { t } = useT();
  const places = usePlaces();
  return (
    <Screen underHeader>
      {places.length === 0 ? (
        <Text style={[type.body, { color: c.textSecondary, marginBottom: space.lg }]}>{t('places.empty')}</Text>
      ) : (
        <Group>
          {places.map((p, i) => (
            <Row
              key={p.id}
              icon={p.role === 'home' ? 'house' : p.role === 'work' ? 'building' : 'pin'}
              title={p.name}
              subtitle={[p.address, p.kind ? t(`kind.${p.kind}`) : null, p.partner].filter(Boolean).join(' · ')}
              onPress={() => router.push(`/place/${p.id}`)}
              last={i === places.length - 1}
            />
          ))}
        </Group>
      )}
      <View>
        <Button title={t('places.add')} icon="plus" variant="secondary" onPress={() => router.push('/place/new')} />
      </View>
    </Screen>
  );
}
