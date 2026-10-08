import { useEffect } from 'react';
import { AppState } from 'react-native';

import { repo } from '@/data/db';
import { useSettings } from '@/store/settings';
import { obd } from '@/tracking/obd';
import { autoStart, connectObd, startRecording } from '@/tracking/recorder';

export function useObdAutoStart(enabled: boolean) {
  const mode = useSettings((s) => s.mode);
  const auto = useSettings((s) => s.obdAutoStart);
  const vehicleId = useSettings((s) => s.vehicleId);

  useEffect(() => {
    if (!enabled || mode !== 'obd' || !auto) return;
    let cancelled = false;
    let busy = false;
    const attempt = async () => {
      if (busy || cancelled || AppState.currentState !== 'active' || repo.recording()) return;
      const vehicles = repo.vehicles();
      const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
      if (!vehicle?.adapterId) return;
      busy = true;
      try {
        await connectObd(vehicle.adapterId, vehicle.adapterName ?? 'OBD');
        const rpm = await obd.rpm();
        const running = rpm != null && rpm > 300;
        if (!autoStart.armed) {
          if (!running) autoStart.armed = true;
          return;
        }
        if (!cancelled && running && !repo.recording()) await startRecording('obd');
      } catch {
      } finally {
        busy = false;
      }
    };
    attempt();
    const timer = setInterval(attempt, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') attempt();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, mode, auto, vehicleId]);
}
