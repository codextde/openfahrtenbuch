const handler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, fatal) => {
  console.error('[fatal]', fatal, error?.message, error?.stack);
  handler(error, fatal);
});

require('@/tracking/recorder');
require('expo-router/entry');
