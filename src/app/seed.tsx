import { Redirect, useLocalSearchParams } from 'expo-router';

import { SCREENSHOT_MODE, seedDemo, seedLive } from '@/lib/demo';

export default function Seed() {
  const { live } = useLocalSearchParams<{ live?: string }>();
  if (SCREENSHOT_MODE) {
    if (live === '1') seedLive();
    else seedDemo();
  }
  return <Redirect href="/" />;
}
