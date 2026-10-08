import { useColorScheme, type TextStyle } from 'react-native';

import type { TripKind } from '@/core/types';

const light = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  surfaceSunken: '#ECEEF1',
  surfacePressed: '#E6E9ED',
  border: 'rgba(15,18,22,0.07)',
  borderStrong: 'rgba(15,18,22,0.14)',
  text: '#0F1216',
  textSecondary: '#5B6370',
  textTertiary: '#8B929D',
  accent: '#0E9F6E',
  accentStrong: '#0B8A5F',
  accentSoft: 'rgba(14,159,110,0.12)',
  onAccent: '#FFFFFF',
  business: '#2F6BFF',
  businessSoft: 'rgba(47,107,255,0.12)',
  private: '#D98A00',
  privateSoft: 'rgba(229,154,11,0.14)',
  commute: '#7B5CFF',
  commuteSoft: 'rgba(123,92,255,0.13)',
  warn: '#D98A00',
  warnSoft: 'rgba(229,154,11,0.13)',
  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.11)',
  scrim: 'rgba(15,18,22,0.4)',
  hero: '#0F1216',
  onHero: '#FFFFFF',
  onHeroSecondary: 'rgba(255,255,255,0.62)',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0A0C0F',
  surface: '#14171C',
  surfaceRaised: '#1A1E24',
  surfaceSunken: '#0F1216',
  surfacePressed: '#22272E',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.13)',
  text: '#F2F4F6',
  textSecondary: '#9AA1AB',
  textTertiary: '#646B75',
  accent: '#22C08A',
  accentStrong: '#2BD49A',
  accentSoft: 'rgba(43,212,154,0.14)',
  onAccent: '#04130D',
  business: '#5C8BFF',
  businessSoft: 'rgba(92,139,255,0.16)',
  private: '#F2B23D',
  privateSoft: 'rgba(242,178,61,0.15)',
  commute: '#9C85FF',
  commuteSoft: 'rgba(156,133,255,0.16)',
  warn: '#F2B23D',
  warnSoft: 'rgba(242,178,61,0.14)',
  danger: '#FF6369',
  dangerSoft: 'rgba(255,99,105,0.14)',
  scrim: 'rgba(0,0,0,0.6)',
  hero: '#1A1E24',
  onHero: '#FFFFFF',
  onHeroSecondary: 'rgba(255,255,255,0.6)',
};

export const palettes = { light, dark };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark() {
  return useColorScheme() === 'dark';
}

export function kindColor(c: Palette, kind: TripKind | null) {
  if (kind === 'business') return { fg: c.business, bg: c.businessSoft };
  if (kind === 'private') return { fg: c.private, bg: c.privateSoft };
  if (kind === 'commute') return { fg: c.commute, bg: c.commuteSoft };
  return { fg: c.danger, bg: c.dangerSoft };
}

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  numMedium: 'BarlowSemiCondensed_500Medium',
  numSemibold: 'BarlowSemiCondensed_600SemiBold',
  numBold: 'BarlowSemiCondensed_700Bold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const type = {
  hero: { fontFamily: fonts.numBold, fontSize: 68, lineHeight: 72, letterSpacing: -1, fontVariant: tabular },
  display: { fontFamily: fonts.numBold, fontSize: 40, lineHeight: 44, letterSpacing: -0.5, fontVariant: tabular },
  value: { fontFamily: fonts.numSemibold, fontSize: 28, lineHeight: 32, fontVariant: tabular },
  valueSmall: { fontFamily: fonts.numSemibold, fontSize: 21, lineHeight: 25, fontVariant: tabular },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  headline: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
  body: { fontFamily: fonts.regular, fontSize: 15.5, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22 },
  callout: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  mono: { fontFamily: fonts.numMedium, fontSize: 14, lineHeight: 18, letterSpacing: 0.3, fontVariant: tabular },
} satisfies Record<string, TextStyle>;
