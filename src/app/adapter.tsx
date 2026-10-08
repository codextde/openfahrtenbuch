import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button, Card, Group, Notice, Row, Screen, SectionTitle, success } from '@/components/ui';
import { formatInt } from '@/core/format';
import { mutate } from '@/data/db';
import { useActiveVehicle, useRecording } from '@/data/hooks';
import { useT } from '@/i18n';
import { type BluetoothState, ensureBluetoothPermission, scanAdapters, type ScannedAdapter, watchBluetoothState } from '@/obd/ble-transport';
import { useSettings } from '@/store/settings';
import { space, type, useColors } from '@/theme';
import { useLive } from '@/tracking/live';
import { obd } from '@/tracking/obd';

export default function AdapterScreen() {
  const c = useColors();
  const { t, lang } = useT();
  const vehicle = useActiveVehicle();
  const recording = useRecording();
  const [bt, setBt] = useState<BluetoothState>('unknown');
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<ScannedAdapter[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ odometer: number | null; vin: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopScan = useRef<(() => void) | null>(null);

  useEffect(() => watchBluetoothState(setBt), []);
  useEffect(() => () => stopScan.current?.(), []);

  const scan = async () => {
    setError(null);
    if (!(await ensureBluetoothPermission())) {
      setError(t('adapter.unauthorized'));
      return;
    }
    stopScan.current?.();
    setFound([]);
    setScanning(true);
    stopScan.current = scanAdapters(
      (a) => setFound((list) => (list.some((x) => x.id === a.id) ? list : [...list, a].sort((x, y) => Number(y.likelyObd) - Number(x.likelyObd)))),
      (message) => {
        setError(message);
        setScanning(false);
      },
    );
    setTimeout(() => {
      stopScan.current?.();
      setScanning(false);
    }, 12000);
  };

  const connect = async (id: string, name: string) => {
    if (!vehicle) return;
    stopScan.current?.();
    setScanning(false);
    setBusy(id);
    setError(null);
    setResult(null);
    try {
      if (!(obd.connected && vehicle.adapterId === id)) {
        await obd.connect(id, name, () => useLive.setState({ obd: 'lost' }));
      }
      const info = await obd.info();
      mutate((r) => r.saveVehicle({ ...vehicle, adapterId: id, adapterName: name, vin: info.vin ?? vehicle.vin }));
      setResult(info);
      success();
      if (!recording) await obd.close();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message === 'no-answer' ? t('adapter.noAnswer') : message);
      if (!recording) await obd.close().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const forget = () => {
    if (!vehicle) return;
    mutate((r) => r.saveVehicle({ ...vehicle, adapterId: null, adapterName: null }));
    setResult(null);
    if (useSettings.getState().mode === 'obd') useSettings.getState().set({ mode: 'gps' });
  };

  const likely = found.filter((f) => f.likelyObd);
  const other = found.filter((f) => !f.likelyObd);

  return (
    <Screen underHeader>
      <Text style={[type.body, { color: c.textSecondary, marginBottom: space.lg }]}>{t('adapter.intro')}</Text>
      {bt === 'off' ? <Notice tone="warn" icon="warning" title={t('adapter.bluetoothOff')} /> : null}
      {bt === 'unauthorized' ? <Notice tone="warn" icon="warning" title={t('adapter.unauthorized')} /> : null}

      {vehicle?.adapterId ? (
        <Card style={{ gap: space.md, marginTop: space.md }}>
          <Text style={[type.bodyStrong, { color: c.text }]}>{t('adapter.paired', { name: vehicle.adapterName ?? 'OBD' })}</Text>
          {result ? (
            <Text style={[type.callout, { color: c.textSecondary }]}>
              {result.odometer != null ? t('adapter.odometerYes', { km: formatInt(result.odometer, lang) }) : t('adapter.odometerNo')}
              {result.vin ? `\n${t('adapter.vin', { vin: result.vin })}` : ''}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title={t('adapter.test')} icon="refresh" variant="secondary" compact loading={busy === vehicle.adapterId} onPress={() => connect(vehicle.adapterId!, vehicle.adapterName ?? 'OBD')} style={{ flex: 1 }} />
            <Button title={t('adapter.forget')} icon="trash" variant="danger" compact onPress={forget} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}

      {error ? (
        <View style={{ marginTop: space.md }}>
          <Notice tone="danger" icon="warning" title={error} />
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        <Button title={scanning ? t('adapter.scanning') : t('adapter.scan')} icon="antenna" loading={scanning} onPress={scan} disabled={bt === 'off'} />
      </View>

      {[
        { title: t('adapter.likely'), list: likely },
        { title: t('adapter.other'), list: other },
      ].map((section) =>
        section.list.length ? (
          <View key={section.title} style={{ marginTop: space.xl }}>
            <SectionTitle title={section.title} />
            <Group>
              {section.list.map((a, i) => (
                <Row
                  key={a.id}
                  icon="antenna"
                  title={a.name}
                  subtitle={a.rssi != null ? `${a.rssi} dBm` : undefined}
                  onPress={() => connect(a.id, a.name)}
                  right={busy === a.id ? <ActivityIndicator color={c.accent} /> : undefined}
                  last={i === section.list.length - 1}
                />
              ))}
            </Group>
          </View>
        ) : null,
      )}

      <Text style={[type.caption, { color: c.textTertiary, marginTop: space.xl }]}>{t('adapter.tips')}</Text>
    </Screen>
  );
}
