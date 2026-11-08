import { router, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';

import { repo } from '@/data/db';
import { beginTrip } from '@/lib/start';
import { stopRecording } from '@/tracking/recorder';

export type LinkAction = 'start' | 'stop' | 'toggle';

export const TAG_URL = 'https://fahrtenbuch.codext.de/toggle';

const pattern = /^(?:openfahrtenbuch:\/\/|https:\/\/fahrtenbuch\.codext\.de\/|\/)?(start|stop|toggle)\/?(?:[?#].*)?$/i;

export function linkAction(url: string): LinkAction | null {
  const match = pattern.exec(url.trim());
  return match ? (match[1].toLowerCase() as LinkAction) : null;
}

let pending: LinkAction | null = null;
const listeners = new Set<() => void>();

export function queueAction(action: LinkAction) {
  pending = action;
  listeners.forEach((l) => l());
}

export function onAction(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function takeAction() {
  const action = pending;
  pending = null;
  return action;
}

export const externalStop = { active: false };

let running = false;

export async function runAction(action: LinkAction) {
  if (running) return;
  running = true;
  try {
    await perform(action);
  } finally {
    running = false;
  }
}

async function perform(action: LinkAction) {
  const trip = repo.recording();
  const resolved = action === 'toggle' ? (trip && Date.now() - trip.startedAt > 60000 ? 'stop' : 'start') : action;
  if (resolved === 'start') {
    if (trip) router.navigate('/recording');
    else await beginTrip();
    return;
  }
  if (!trip) return;
  externalStop.active = true;
  try {
    const done = await stopRecording();
    if (!done) return;
    if (router.canDismiss()) router.dismissAll();
    router.push(`/trip/${done.id}?finish=1`);
  } finally {
    setTimeout(() => {
      externalStop.active = false;
    }, 1000);
  }
}

export function useLinkActions(enabled: boolean) {
  const ready = !!useRootNavigationState()?.key;

  useEffect(() => {
    const run = () => {
      const action = takeAction();
      if (action && enabled && ready) runAction(action).catch(() => undefined);
    };
    if (enabled && !ready) return;
    run();
    return onAction(run);
  }, [enabled, ready]);
}
