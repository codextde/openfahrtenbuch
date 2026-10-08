import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle, labelsHidden } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, Text, View } from 'react-native';

import { space, type, useColors, useIsDark } from '@/theme';

type Props = { label: string; value: number; onChange: (ms: number) => void; disabled?: boolean; min?: number; max?: number };

export function DateTimeField({ label, value, onChange, disabled, min, max }: Props) {
  const c = useColors();
  const dark = useIsDark();
  return (
    <View style={[styles.row, { borderColor: c.borderStrong, backgroundColor: disabled ? c.surfaceSunken : c.surface }]}>
      <Text style={[type.body, { color: c.textSecondary, flex: 1 }]}>{label}</Text>
      <View pointerEvents={disabled ? 'none' : 'auto'} style={{ opacity: disabled ? 0.6 : 1 }}>
        <Host matchContents colorScheme={dark ? 'dark' : 'light'} seedColor={c.accent}>
          <DatePicker
            selection={new Date(value)}
            displayedComponents={['date', 'hourAndMinute']}
            range={{ start: min != null ? new Date(min) : undefined, end: max != null ? new Date(max) : undefined }}
            onDateChange={(d) => onChange(d.getTime())}
            modifiers={[labelsHidden(), datePickerStyle('compact')]}
          />
        </Host>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingLeft: space.md, paddingRight: space.sm, minHeight: 52 },
});
