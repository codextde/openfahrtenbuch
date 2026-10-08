import * as Application from 'expo-application';
import * as WebBrowser from 'expo-web-browser';
import { Image, Text, View } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { useT } from '@/i18n';
import { LINKS } from '@/lib/links';
import { radius, space, type, useColors } from '@/theme';

export default function AboutScreen() {
  const c = useColors();
  const { t } = useT();
  return (
    <Screen underHeader>
      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
        <Image source={require('@/assets/images/icon.png')} style={{ width: 84, height: 84, borderRadius: radius.xl }} accessibilityIgnoresInvertColors />
        <Text style={[type.headline, { color: c.text }]}>{t('appName')}</Text>
        <Text style={[type.caption, { color: c.textTertiary }]}>{t('settings.version', { v: `${Application.nativeApplicationVersion ?? '1.0.0'} (${Application.nativeBuildVersion ?? '1'})` })}</Text>
        <Text style={[type.callout, { color: c.textSecondary, textAlign: 'center' }]}>{t('about.body')}</Text>
        <Text style={[type.caption, { color: c.textTertiary, textAlign: 'center' }]}>{t('about.by')}</Text>
      </Card>
      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <Button title={t('settings.sourceCode')} icon="code" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(LINKS.github)} />
        <Button title="fahrtenbuch.codext.de" icon="globe" variant="secondary" onPress={() => WebBrowser.openBrowserAsync(LINKS.site)} />
      </View>
    </Screen>
  );
}
