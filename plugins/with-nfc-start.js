const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const ACTION = 'android.nfc.action.NDEF_DISCOVERED';

module.exports = function withNfcStart(config, { host, paths = [], scheme }) {
  return withAndroidManifest(config, (config) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults);
    const filters = (activity['intent-filter'] ?? []).filter((f) => !f.action?.some((a) => a.$['android:name'] === ACTION));
    filters.push({
      action: [{ $: { 'android:name': ACTION } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
      data: [
        ...paths.map((path) => ({ $: { 'android:scheme': 'https', 'android:host': host, 'android:path': path } })),
        ...(scheme ? [{ $: { 'android:scheme': scheme } }] : []),
      ],
    });
    activity['intent-filter'] = filters;
    return config;
  });
};
