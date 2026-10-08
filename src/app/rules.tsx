import { Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Notice, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';

export default function RulesScreen() {
  const c = useColors();
  const { t } = useT();
  return (
    <Screen underHeader>
      <Text style={[type.body, { color: c.textSecondary, marginBottom: space.lg }]}>{t('rules.intro')}</Text>
      <Card style={{ gap: space.xl }}>
        {(['r1', 'r2', 'r3', 'r4', 'r5', 'r6'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.md }}>
            <Icon name="checkCircle" size={20} color={c.accentStrong} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[type.bodyStrong, { color: c.text }]}>{t(`rules.${k}`)}</Text>
              <Text style={[type.callout, { color: c.textSecondary }]}>{t(`rules.${k}b`)}</Text>
            </View>
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.lg }}>
        <Notice tone="info" icon="info" title={t('rules.disclaimer')} />
      </View>
    </Screen>
  );
}
