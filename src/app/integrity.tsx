import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Card, Label, Screen } from '@/components/ui';
import { repo } from '@/data/db';
import { useT } from '@/i18n';
import { space, type, useColors } from '@/theme';

export default function IntegrityScreen() {
  const c = useColors();
  const { t } = useT();
  const [result, setResult] = useState<ReturnType<typeof repo.verify> | null>(null);
  const head = repo.head();

  useEffect(() => {
    const id = setTimeout(() => setResult(repo.verify()), 250);
    return () => clearTimeout(id);
  }, []);

  const bad = result ? result.problems.length + result.mismatched.length : 0;

  return (
    <Screen underHeader>
      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
        {!result ? (
          <>
            <ActivityIndicator color={c.accent} />
            <Text style={[type.callout, { color: c.textSecondary }]}>{t('integrity.checking')}</Text>
          </>
        ) : (
          <>
            <View style={{ width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: bad ? c.dangerSoft : c.accentSoft }}>
              <Icon name={bad ? 'warning' : 'shield'} size={30} color={bad ? c.danger : c.accentStrong} />
            </View>
            <Text style={[type.headline, { color: c.text, textAlign: 'center' }]}>{bad ? t('integrity.bad') : t('integrity.ok')}</Text>
            <Text style={[type.callout, { color: c.textSecondary, textAlign: 'center' }]}>
              {bad ? t('integrity.badBody', { n: bad }) : t('integrity.okBody', { n: result.entries })}
            </Text>
          </>
        )}
      </Card>
      {head ? (
        <Card style={{ marginTop: space.lg, gap: space.xs }}>
          <Label>{t('integrity.head')}</Label>
          <Text style={[type.mono, { color: c.text, fontSize: 12.5 }]} selectable>
            #{head.seq} · {head.hash}
          </Text>
        </Card>
      ) : null}
      <Label style={{ marginTop: space.xl, marginBottom: space.md, marginLeft: space.xs }}>{t('integrity.how')}</Label>
      <Card style={{ gap: space.lg }}>
        {(['how1', 'how2', 'how3', 'how4'] as const).map((k, i) => (
          <View key={k} style={{ flexDirection: 'row', gap: space.md }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[type.caption, { color: c.textSecondary }]}>{i + 1}</Text>
            </View>
            <Text style={[type.callout, { color: c.text, flex: 1 }]}>{t(`integrity.${k}`)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
