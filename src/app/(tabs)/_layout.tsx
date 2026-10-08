import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { useT } from '@/i18n';
import { useColors } from '@/theme';

const android = Platform.OS === 'android';

export default function TabsLayout() {
  const c = useColors();
  const { t } = useT();
  return (
    <NativeTabs
      tintColor={c.accentStrong}
      minimizeBehavior="onScrollDown"
      backgroundColor={android ? c.surface : undefined}
      indicatorColor={android ? c.accentSoft : undefined}
      iconColor={android ? { default: c.textSecondary, selected: c.accentStrong } : undefined}
      labelStyle={android ? { default: { color: c.textSecondary }, selected: { color: c.text } } : undefined}
      rippleColor={android ? c.accentSoft : undefined}
      labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.trips')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'car', selected: 'car.fill' }} md="directions_car" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="report">
        <NativeTabs.Trigger.Label>{t('tabs.report')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.xaxis" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
