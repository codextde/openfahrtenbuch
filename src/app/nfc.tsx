import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Button, Card, Notice, Screen, success } from '@/components/ui';
import { useT } from '@/i18n';
import { cancelWrite, isCancel, nfcEnabled, openNfcSettings, writeTag } from '@/lib/nfc';
import { space, type, useColors } from '@/theme';

type State = 'idle' | 'writing' | 'done' | 'failed';

export default function NfcScreen() {
  const c = useColors();
  const { t } = useT();
  const [state, setState] = useState<State>('idle');
  const [enabled, setEnabled] = useState(true);
  const cancelled = useRef(false);

  useEffect(() => {
    const check = () => nfcEnabled().then(setEnabled);
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      sub.remove();
      cancelWrite();
    };
  }, []);

  const write = async () => {
    cancelled.current = false;
    setState('writing');
    try {
      await writeTag(t('nfc.hold'), t('nfc.written'));
      success();
      setState('done');
    } catch (error) {
      setState(cancelled.current || isCancel(error) ? 'idle' : 'failed');
    }
  };

  const cancel = () => {
    cancelled.current = true;
    cancelWrite();
  };

  const done = state === 'done';
  const waiting = state === 'writing' && Platform.OS === 'android';

  return (
    <Screen underHeader>
      <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          {waiting ? <ActivityIndicator color={c.accentStrong} /> : <Icon name={done ? 'checkCircle' : 'nfc'} size={40} color={c.accentStrong} />}
        </View>
        {waiting || done ? <Text style={[type.headline, { color: c.text, textAlign: 'center' }]}>{waiting ? t('nfc.hold') : t('nfc.written')}</Text> : null}
        <Text style={[type.callout, { color: c.textSecondary, textAlign: 'center' }]}>{done ? t('nfc.done') : t('nfc.body')}</Text>
      </Card>

      {!enabled ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="warn" icon="warning" title={t('nfc.off')} action={t('nfc.openSettings')} onAction={openNfcSettings} />
        </View>
      ) : null}
      {state === 'failed' ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="danger" icon="warning" title={t('nfc.failed')} />
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        {waiting ? (
          <Button title={t('common.cancel')} variant="secondary" large onPress={cancel} />
        ) : (
          <Button
            title={done ? t('nfc.again') : t('nfc.write')}
            icon="nfc"
            variant={done ? 'secondary' : 'primary'}
            large
            loading={state === 'writing'}
            disabled={!enabled}
            onPress={write}
          />
        )}
      </View>
    </Screen>
  );
}
