import '@/tracking/recorder';

import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { changed, repo } from '@/data/db';
import { useT } from '@/i18n';
import { useObdAutoStart } from '@/lib/auto-obd';
import { SCREENSHOT_MODE } from '@/lib/demo';
import { iconFonts, textFonts } from '@/lib/fonts';
import { scheduleReminders } from '@/lib/notify';
import { useSettings } from '@/store/settings';
import { useColors, useIsDark } from '@/theme';
import { resumeRecording } from '@/tracking/recorder';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ fade: true, duration: 250 });

export const unstable_settings = {
  anchor: '(tabs)',
};

function useAppLifecycle(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => {
      try {
        if (repo.autoLock().length) changed();
      } catch {}
      resumeRecording().catch(() => undefined);
      scheduleReminders().catch(() => undefined);
    };
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    const tapSub = Notifications.addNotificationResponseReceivedListener(open);
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => undefined);
    return () => {
      sub.remove();
      tapSub.remove();
    };
  }, [enabled]);
}

function Navigator() {
  const onboarded = useSettings((s) => s.onboarded);
  const c = useColors();
  const dark = useIsDark();
  const { t } = useT();
  useAppLifecycle(onboarded);
  useObdAutoStart(onboarded);

  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: c.accent, background: c.background, card: c.background, text: c.text, border: c.border },
  };
  const sheet = {
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetCornerRadius: 28,
    contentStyle: { backgroundColor: c.background },
  };
  const pushed = {
    headerShown: true,
    headerTransparent: Platform.OS === 'ios',
    headerStyle: Platform.OS === 'android' ? { backgroundColor: c.background } : undefined,
    headerTintColor: c.text,
    headerTitleStyle: { fontFamily: 'Inter_600SemiBold', color: c.text },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="recording" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="trip/[id]" options={{ ...pushed, title: '' }} />
          <Stack.Screen name="trip/new" options={{ ...pushed, title: t('trip.newTitle') }} />
          <Stack.Screen name="vehicle/[id]" options={{ ...pushed, title: t('vehicle.editTitle') }} />
          <Stack.Screen name="places" options={{ ...pushed, title: t('places.title') }} />
          <Stack.Screen name="place/[id]" options={{ ...pushed, title: t('places.title') }} />
          <Stack.Screen name="costs" options={{ ...pushed, title: t('costs.title') }} />
          <Stack.Screen name="cost/[id]" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
          <Stack.Screen name="adapter" options={{ ...pushed, title: t('adapter.title') }} />
          <Stack.Screen name="integrity" options={{ ...pushed, title: t('integrity.title') }} />
          <Stack.Screen name="rules" options={{ ...pushed, title: t('rules.title') }} />
          <Stack.Screen name="about" options={{ ...pushed, title: t('about.title') }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="welcome" />
        </Stack.Protected>
        <Stack.Protected guard={SCREENSHOT_MODE}>
          <Stack.Screen name="seed" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ ...textFonts, ...iconFonts });
  const [hydrated, setHydrated] = useState(useSettings.persist.hasHydrated());
  const [timedOut, setTimedOut] = useState(false);
  const c = useColors();

  useEffect(() => {
    if (hydrated) return;
    const unsub = useSettings.persist.onFinishHydration(() => setHydrated(true));
    if (useSettings.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [hydrated]);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 2500);
    return () => clearTimeout(id);
  }, []);

  const ready = ((loaded || !!error) && hydrated) || timedOut;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <Navigator />
    </GestureHandlerRootView>
  );
}
