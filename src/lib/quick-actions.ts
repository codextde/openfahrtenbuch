import * as QuickActions from 'expo-quick-actions';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { repo, subscribe } from '@/data/db';
import { t } from '@/i18n';
import { type LinkAction, queueAction } from '@/lib/actions';
import { useSettings } from '@/store/settings';

function sync() {
  const running = !!repo.recording();
  const item = running
    ? { id: 'stop', title: t('widget.stop'), icon: Platform.OS === 'ios' ? 'symbol:stop.fill' : 'shortcut_stop' }
    : { id: 'start', title: t('widget.start'), icon: Platform.OS === 'ios' ? 'symbol:play.fill' : 'shortcut_start' };
  QuickActions.setItems([item]).catch(() => undefined);
}

const handle = (id: string) => {
  if (id === 'start' || id === 'stop') queueAction(id as LinkAction);
};

export function useQuickActions(enabled: boolean) {
  const language = useSettings((s) => s.language);

  useEffect(() => {
    if (!enabled) return;
    if (QuickActions.initial) handle(QuickActions.initial.id);
    const sub = QuickActions.addListener((action) => handle(action.id));
    return () => sub.remove();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      QuickActions.setItems([]).catch(() => undefined);
      return;
    }
    sync();
    let running = !!repo.recording();
    return subscribe(() => {
      const next = !!repo.recording();
      if (next === running) return;
      running = next;
      sync();
    });
  }, [enabled, language]);
}
