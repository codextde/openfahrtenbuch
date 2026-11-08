import { FlexWidget, registerWidgetTaskHandler, requestPinWidget, requestWidgetUpdate, SvgWidget, TextWidget } from 'react-native-android-widget';

import { formatTime } from '@/core/format';
import { repo, subscribe } from '@/data/db';
import { t } from '@/i18n';

const NAME = 'Trip';

const glyph = (running: boolean, color: string) =>
  running
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="${color}"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.5 6.6c0-.8.9-1.3 1.6-.9l8.2 5.1c.6.4.6 1.4 0 1.8l-8.2 5.1c-.7.4-1.6-.1-1.6-.9z" fill="${color}"/></svg>`;

const palette = {
  light: { bg: '#FFFFFF', text: '#0F1216', sub: '#5B6370', accent: '#0E9F6E', onAccent: '#FFFFFF', live: '#0F1216', liveSub: '#FFFFFFA0' },
  dark: { bg: '#1A1E24', text: '#F2F4F6', sub: '#9AA1AB', accent: '#22C08A', onAccent: '#04130D', live: '#0F1216', liveSub: '#FFFFFFA0' },
} as const;

function TripWidget({ scheme, startedAt }: { scheme: keyof typeof palette; startedAt: number | null }) {
  const c = palette[scheme];
  const running = startedAt != null;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: running ? 'openfahrtenbuch://stop' : 'openfahrtenbuch://start' }}
      accessibilityLabel={running ? t('widget.stop') : t('widget.start')}
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: running ? c.live : c.bg,
        borderRadius: 28,
        paddingHorizontal: 12,
      }}
    >
      <FlexWidget
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: running ? '#E5484D' : c.accent,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <SvgWidget svg={glyph(running, running ? '#FFFFFF' : c.onAccent)} style={{ width: 26, height: 26 }} />
      </FlexWidget>
      <FlexWidget style={{ marginLeft: 12, flex: 1, flexDirection: 'column' }}>
        <TextWidget
          text={running ? t('widget.stop') : t('widget.start')}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: running ? '#FFFFFF' : c.text }}
        />
        <TextWidget
          text={running ? t('widget.since', { time: formatTime(startedAt) }) : t('appName')}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: running ? c.liveSub : c.sub, marginTop: 1 }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

function render() {
  let startedAt: number | null = null;
  try {
    startedAt = repo.recording()?.startedAt ?? null;
  } catch {}
  return { light: <TripWidget scheme="light" startedAt={startedAt} />, dark: <TripWidget scheme="dark" startedAt={startedAt} /> };
}

export const widgetSupported = true;

let lastId: string | null | undefined;

export function registerWidget() {
  registerWidgetTaskHandler(async ({ widgetAction, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED') return;
    renderWidget(render());
  });
  subscribe(() => {
    let id: string | null = null;
    try {
      id = repo.recording()?.id ?? null;
    } catch {}
    if (id === lastId) return;
    lastId = id;
    requestWidgetUpdate({ widgetName: NAME, renderWidget: render }).catch(() => undefined);
  });
}

export const pinWidget = () => requestPinWidget({ widgetName: NAME }).catch(() => false);
