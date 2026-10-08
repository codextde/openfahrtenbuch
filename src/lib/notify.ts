import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { distance } from '@/core/rules';
import { deadline, DAY } from '@/core/rules';
import type { Trip } from '@/core/types';
import { repo } from '@/data/db';
import { t } from '@/i18n';
import { settings } from '@/store/settings';

const REMINDER = 'open-trips';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let channelReady = false;

async function ready() {
  if (Platform.OS === 'android' && !channelReady) {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: t('notify.channel'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    channelReady = true;
  }
  const permission = await Notifications.getPermissionsAsync();
  return permission.granted;
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

export async function scheduleReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.kind === REMINDER) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  if (!settings().reminders || !(await ready())) return;
  const open = repo.trips({ status: ['open'] });
  if (open.length === 0) return;
  const now = Date.now();
  const upcoming = open.map((trip) => deadline(trip)).filter((d) => d > now);
  const earliest = upcoming.length ? Math.min(...upcoming) : now + 2 * DAY;
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening.getTime() <= now + 30 * 60000) evening.setTime(evening.getTime() + DAY);
  const times = [evening.getTime(), earliest - DAY].filter((x, i, a) => x > now + 30 * 60000 && x < earliest && a.indexOf(x) === i);
  for (const at of times) {
    const days = Math.max(1, Math.ceil((earliest - at) / DAY));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notify.openTitle'),
        body: open.length === 1 ? t('notify.openBodyOne', { days }) : t('notify.openBody', { n: open.length, days }),
        data: { kind: REMINDER, url: '/' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: 'reminders' },
    });
  }
}

export async function notifyFinished(trip: Trip, place: string) {
  if (!(await ready())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notify.finishedTitle'),
      body: t('notify.finishedBody', { km: distance(trip), place: place || t('trips.unknownPlace') }),
      data: { kind: 'finished', url: `/trip/${trip.id}` },
    },
    trigger: Platform.OS === 'android' ? { channelId: 'reminders' } : null,
  });
}
