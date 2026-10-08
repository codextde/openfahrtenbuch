import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type TrackingMode = 'gps' | 'obd' | 'manual';
export type LanguagePref = 'system' | 'de' | 'en';

type Values = {
  onboarded: boolean;
  vehicleId: string | null;
  driver: string;
  owner: string;
  mode: TrackingMode;
  autoStopMinutes: number;
  reminders: boolean;
  hidePrivateDetails: boolean;
  saveRoute: boolean;
  commuteDistanceKm: number;
  obdAutoStart: boolean;
  language: LanguagePref;
};

type SettingsState = Values & {
  set: (patch: Partial<Values>) => void;
};

const defaults: Values = {
  onboarded: false,
  vehicleId: null,
  driver: '',
  owner: '',
  mode: 'gps',
  autoStopMinutes: 10,
  reminders: true,
  hidePrivateDetails: true,
  saveRoute: true,
  commuteDistanceKm: 0,
  obdAutoStart: true,
  language: 'system',
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (patch) => set(patch),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (key: string) => Storage.getItemSync(key),
        setItem: (key: string, value: string) => Storage.setItemSync(key, value),
        removeItem: (key: string) => {
          Storage.removeItemSync(key);
        },
      })),
    },
  ),
);

export const settings = () => useSettings.getState();
