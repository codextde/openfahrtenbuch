import { StyleSheet, Text, View } from 'react-native';

import type { TripKind } from '@/core/types';
import { useT } from '@/i18n';
import { fonts, kindColor, radius, space, type, useColors } from '@/theme';

import { Icon } from './icon';
import type { IconName } from './icon-names';
import { PressableScale } from './pressable-scale';
import { tap } from './ui';

const KINDS: { kind: TripKind; icon: IconName }[] = [
  { kind: 'business', icon: 'briefcase' },
  { kind: 'private', icon: 'house' },
  { kind: 'commute', icon: 'building' },
];

export function KindPicker({ value, onChange, disabled }: { value: TripKind | null; onChange: (k: TripKind) => void; disabled?: boolean }) {
  const c = useColors();
  const { t } = useT();
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup">
      {KINDS.map(({ kind, icon }) => {
        const active = value === kind;
        const k = kindColor(c, kind);
        return (
          <PressableScale
            key={kind}
            disabled={disabled}
            onPress={() => {
              tap();
              onChange(kind);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, disabled }}
            accessibilityLabel={`${t(`kind.${kind}`)}. ${t(`kind.${kind}Hint`)}`}
            style={[
              styles.card,
              {
                backgroundColor: active ? k.bg : c.surface,
                borderColor: active ? k.fg : c.borderStrong,
                opacity: disabled && !active ? 0.5 : 1,
              },
            ]}>
            <View style={[styles.icon, { backgroundColor: active ? k.fg : c.surfaceSunken }]}>
              <Icon name={icon} size={17} color={active ? '#FFFFFF' : k.fg} />
            </View>
            <Text style={[type.callout, { color: c.text, fontFamily: fonts.semibold }]} numberOfLines={1} adjustsFontSizeToFit>
              {t(`kind.${kind}`)}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: space.sm },
  card: { flex: 1, borderWidth: 1.5, borderRadius: radius.md + 2, paddingVertical: space.md, paddingHorizontal: space.sm, alignItems: 'center', gap: space.sm },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
