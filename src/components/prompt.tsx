import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { radius, space, type, useColors } from '@/theme';

import { Button } from './ui';

export function Prompt({
  visible,
  title,
  body,
  placeholder,
  confirm,
  destructive,
  initial = '',
  keyboardType = 'default',
  allowEmpty,
  multiline = true,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  body?: string;
  placeholder?: string;
  confirm: string;
  destructive?: boolean;
  initial?: string;
  keyboardType?: 'default' | 'number-pad';
  allowEmpty?: boolean;
  multiline?: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const { t } = useT();
  const [text, setText] = useState('');
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.backdrop, { backgroundColor: c.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.cancel')} />
        <View style={[styles.sheet, { backgroundColor: c.surface }]}>
          <Text style={[type.headline, { color: c.text }]}>{title}</Text>
          {body ? <Text style={[type.callout, { color: c.textSecondary }]}>{body}</Text> : null}
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={c.textTertiary}
            autoFocus
            multiline={multiline}
            keyboardType={keyboardType}
            style={[type.body, styles.input, !multiline && { minHeight: 48 }, { color: c.text, borderColor: c.borderStrong, backgroundColor: c.background }]}
            selectionColor={c.accent}
          />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={t('common.cancel')} variant="secondary" onPress={onClose} style={{ flex: 1 }} />
            <Button
              title={confirm}
              variant={destructive ? 'danger' : 'primary'}
              disabled={!allowEmpty && !text.trim()}
              onPress={() => {
                onSubmit(text.trim());
                onClose();
              }}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.xl },
  sheet: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
  input: { minHeight: 90, borderWidth: 1, borderRadius: radius.md, padding: space.md, textAlignVertical: 'top' },
});
