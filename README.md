# OpenFahrtenbuch

Free, open-source mileage log (Fahrtenbuch) for iPhone and Android, built to the requirements of the German tax office. Record trips with the phone's GPS, with a cheap Bluetooth LE OBD adapter, or by hand. No account, no server, no ads, no subscription.

Website: [fahrtenbuch.codext.de](https://fahrtenbuch.codext.de) · [App Store](https://apps.apple.com/app/id6820417114) · [Google Play](https://play.google.com/store/apps/details?id=de.codext.fahrtenbuch)

## What it does

- **Three ways to record:** one tap Start/Stop with GPS (keeps recording in the background while a trip runs), an ELM327 Bluetooth LE OBD adapter (reads the real odometer via OBD PID `A6` where the car supports it, otherwise integrates vehicle speed; can start and stop trips on its own), or manual entry like a paper logbook.
- **Business, private, commute:** business trips require destination, purpose and business contact, with an optional route/detour note. Private trips only need kilometres; their destinations can be hidden in the export.
- **Places:** home, main workplace and customers fill destination, purpose and contact automatically. Home to work is recognised as a commute.
- **7-day rule:** reminders for incomplete trips. Complete trips are locked 7 days after the trip ended. Later entries are marked as "completed late" in the export.
- **Tamper evidence:** every entry and change is appended to a SHA-256 hash chain. SQLite triggers block updates and deletes of the ledger and deletes of trips; trips can only be voided with a reason. The integrity check replays the ledger and compares it with the stored trips. Changes are printed next to the trip in the PDF with date, time and the original value.
- **Odometer checks:** gaps and overlaps between trips are detected and can be closed with one tap.
- **Exports:** PDF (A4 landscape) for the tax office and accountants, CSV for machine evaluation (§ 147 AO), full JSON backup with the ledger that is verified before it can be restored.
- **Costs and the 1 % rule:** log vehicle costs and compare the 1 % rule with the logbook method.
- German and English, light and dark mode.

## What the rules say (short)

R 8.1 Abs. 9 LStR and the BMF letters require, for each business trip, date and odometer at start and end, destination (and the route for detours), purpose and the business partner visited. Private trips need the kilometres, commutes a note. The log must be complete, kept promptly and in closed form. For electronic logbooks, later changes must be technically impossible or documented and visible in the file itself (BFH VI B 37/23, FG Düsseldorf 3 K 1887/22 H(L)).

The tax office does not certify any software. Whether a logbook is accepted always depends on its entries. This app is not tax advice.

## Development

Expo SDK 57, React Native 0.86, expo-router, expo-sqlite, expo-location + expo-task-manager, react-native-ble-plx.

```sh
bun install
bun run check        # TypeScript + core checks (ledger, rules, exports, OBD parsing)
bunx expo prebuild
bunx expo run:ios    # or run:android
```

- `src/core` holds the platform-independent logic (ledger, rules, report, repository) and is tested with `bun scripts/core.check.ts` against `bun:sqlite`.
- `src/tracking` contains the GPS task, OBD link and recorder.
- `src/obd` is the ELM327 / BLE transport shared with [OpenBimmer](https://github.com/openbimmer/openbimmer).

## Privacy

All data stays on the device. Location is only used while a trip is recording. Start and end coordinates are turned into addresses by the operating system's geocoder (Apple or Google). Bluetooth is only used to talk to the OBD adapter. Exports leave the device only when you share them.

## License

MIT, © 2026 Codext GmbH
