import * as Application from 'expo-application';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActionSheetIOS, Alert, Platform } from 'react-native';

import { useState } from 'react';

import { Prompt } from '@/components/prompt';
import { Group, Header, Row, Screen, ToggleRow } from '@/components/ui';
import { repo } from '@/data/db';
import { useVehicles } from '@/data/hooks';
import { useT } from '@/i18n';
import { pickBackup, restoreBackup } from '@/lib/export';
import { LINKS } from '@/lib/links';
import { scheduleReminders, requestNotificationPermission } from '@/lib/notify';
import { type LanguagePref, type TrackingMode, useSettings } from '@/store/settings';
import { useColors } from '@/theme';

function choose<T extends string | number>(title: string, options: { value: T; label: string }[], cancel: string, onPick: (v: T) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options.map((o) => o.label), cancel], cancelButtonIndex: options.length }, (i) => {
      if (i < options.length) onPick(options[i].value);
    });
  } else {
    Alert.alert(title, undefined, [...options.map((o) => ({ text: o.label, onPress: () => onPick(o.value) })), { text: cancel, style: 'cancel' as const }]);
  }
}

export default function SettingsScreen() {
  const c = useColors();
  const { t } = useT();
  const s = useSettings();
  const vehicles = useVehicles();
  const activeId = s.vehicleId ?? vehicles[0]?.id;
  const [edit, setEdit] = useState<{ title: string; value: string; numeric?: boolean; onSave: (v: string) => void } | null>(null);
  const promptText = (title: string, value: string, onSave: (v: string) => void, keyboard?: 'number-pad') =>
    setEdit({ title, value, numeric: keyboard === 'number-pad', onSave });

  const restore = () => {
    if ((repo.trips().length ?? 0) > 0) {
      Alert.alert(t('settings.restore'), t('settings.restoreNotEmpty'));
      return;
    }
    Alert.alert(t('settings.restoreTitle'), t('settings.restoreBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.restore'),
        onPress: async () => {
          try {
            const data = await pickBackup();
            if (!data) return;
            const n = restoreBackup(data);
            const first = repo.vehicles()[0];
            if (first) useSettings.getState().set({ vehicleId: first.id });
            Alert.alert(t('settings.restore'), t('settings.restoreDone', { n }));
          } catch (error) {
            const code = error instanceof Error ? error.message : '';
            Alert.alert(t('settings.restore'), code === 'not-empty' ? t('settings.restoreNotEmpty') : t('settings.restoreInvalid'));
          }
        },
      },
    ]);
  };

  const modes: TrackingMode[] = ['gps', 'obd', 'manual'];
  const langs: LanguagePref[] = ['system', 'de', 'en'];
  const langLabel = (l: LanguagePref) => (l === 'system' ? t('settings.languageSystem') : l === 'de' ? 'Deutsch' : 'English');

  return (
    <Screen>
      <Header title={t('settings.title')} />

      <Group title={t('settings.vehicles')}>
        {vehicles.map((v) => (
          <Row
            key={v.id}
            icon="car"
            iconColor={v.id === activeId ? c.onAccent : c.accentStrong}
            iconBg={v.id === activeId ? c.accent : c.accentSoft}
            title={v.name}
            subtitle={[v.plate, v.adapterName ? `OBD: ${v.adapterName}` : null].filter(Boolean).join(' · ') || undefined}
            onPress={() => router.push(`/vehicle/${v.id}`)}
          />
        ))}
        <Row icon="plus" title={t('settings.addVehicle')} onPress={() => router.push('/vehicle/new')} last />
      </Group>

      <Group title={t('settings.recording')}>
        <Row
          icon={s.mode === 'obd' ? 'antenna' : s.mode === 'manual' ? 'hand' : 'gps'}
          title={t('settings.mode')}
          value={t(`mode.${s.mode}`)}
          onPress={() => choose(t('settings.mode'), modes.map((m) => ({ value: m, label: t(`mode.${m}`) })), t('common.cancel'), (mode) => s.set({ mode }))}
        />
        <Row icon="antenna" title={t('settings.adapter')} value={vehicles.find((v) => v.id === activeId)?.adapterName ?? t('common.none')} onPress={() => router.push('/adapter')} />
        {s.mode === 'obd' ? <ToggleRow icon="play" title={t('settings.obdAutoStart')} value={s.obdAutoStart} onChange={(obdAutoStart) => s.set({ obdAutoStart })} /> : null}
        <Row
          icon="clock"
          title={t('settings.autoStop')}
          subtitle={t('settings.autoStopHint')}
          value={s.autoStopMinutes > 0 ? t('common.minutes', { n: s.autoStopMinutes }) : t('common.off')}
          onPress={() =>
            choose(
              t('settings.autoStop'),
              [5, 10, 15, 30, 0].map((n) => ({ value: n, label: n > 0 ? t('common.minutes', { n }) : t('common.off') })),
              t('common.cancel'),
              (autoStopMinutes) => s.set({ autoStopMinutes }),
            )
          }
        />
        <ToggleRow icon="route" title={t('settings.saveRoute')} subtitle={t('settings.saveRouteHint')} value={s.saveRoute} onChange={(saveRoute) => s.set({ saveRoute })} />
        <Row icon="pin" title={t('settings.places')} subtitle={t('settings.placesHint')} onPress={() => router.push('/places')} last />
      </Group>

      <Group title={t('settings.people')}>
        <Row icon="person" title={t('settings.driver')} value={s.driver || '–'} onPress={() => promptText(t('settings.driver'), s.driver, (driver) => s.set({ driver }))} />
        <Row icon="person" title={t('settings.owner')} value={s.owner || '–'} onPress={() => promptText(t('settings.owner'), s.owner, (owner) => s.set({ owner }))} />
        <Row
          icon="building"
          title={t('settings.commuteKm')}
          value={s.commuteDistanceKm ? `${s.commuteDistanceKm} km` : '–'}
          onPress={() => promptText(t('settings.commuteKm'), String(s.commuteDistanceKm || ''), (v) => s.set({ commuteDistanceKm: Math.max(0, parseInt(v, 10) || 0) }), 'number-pad')}
          last
        />
      </Group>

      <Group title={t('settings.reminders')}>
        <ToggleRow
          icon="bell"
          title={t('settings.reminders')}
          subtitle={t('settings.remindersHint')}
          value={s.reminders}
          onChange={async (reminders) => {
            if (reminders) await requestNotificationPermission();
            s.set({ reminders });
            scheduleReminders().catch(() => undefined);
          }}
          last
        />
      </Group>

      <Group title={t('settings.export')}>
        <ToggleRow icon="house" title={t('settings.hidePrivate')} subtitle={t('settings.hidePrivateHint')} value={s.hidePrivateDetails} onChange={(hidePrivateDetails) => s.set({ hidePrivateDetails })} last />
      </Group>

      <Group title={t('settings.data')}>
        <Row icon="shield" title={t('settings.integrity')} onPress={() => router.push('/integrity')} />
        <Row icon="restore" title={t('settings.restore')} onPress={restore} last />
      </Group>

      <Group title={t('settings.about')}>
        <Row icon="scale" title={t('settings.rules')} onPress={() => router.push('/rules')} />
        <Row
          icon="globe"
          title={t('settings.language')}
          value={langLabel(s.language)}
          onPress={() => choose(t('settings.language'), langs.map((l) => ({ value: l, label: langLabel(l) })), t('common.cancel'), (language) => s.set({ language }))}
        />
        <Row icon="info" title={t('about.title')} onPress={() => router.push('/about')} />
        <Row icon="code" title={t('settings.sourceCode')} onPress={() => WebBrowser.openBrowserAsync(LINKS.github)} />
        <Row icon="question" title={t('settings.support')} onPress={() => WebBrowser.openBrowserAsync(LINKS.support)} />
        <Row icon="shield" title={t('settings.privacy')} onPress={() => WebBrowser.openBrowserAsync(LINKS.privacy)} />
        <Row icon="doc" title={t('settings.imprint')} value={t('settings.version', { v: Application.nativeApplicationVersion ?? '1.0.0' })} onPress={() => WebBrowser.openBrowserAsync(LINKS.imprint)} last />
      </Group>
      <Prompt
        visible={!!edit}
        title={edit?.title ?? ''}
        initial={edit?.value ?? ''}
        keyboardType={edit?.numeric ? 'number-pad' : 'default'}
        multiline={false}
        allowEmpty
        confirm={t('common.save')}
        onClose={() => setEdit(null)}
        onSubmit={(v) => edit?.onSave(v)}
      />
    </Screen>
  );
}
