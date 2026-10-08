export type Lang = 'de' | 'en';

const pad = (n: number) => String(n).padStart(2, '0');

export function formatInt(value: number, lang: Lang = 'de') {
  const sep = lang === 'de' ? '.' : ',';
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.round(Math.abs(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function formatDecimal(value: number, digits = 1, lang: Lang = 'de') {
  const fixed = Math.abs(value).toFixed(digits);
  const [int, frac] = fixed.split('.');
  const sign = value < 0 ? '-' : '';
  const body = formatInt(Number(int), lang) + (frac ? (lang === 'de' ? ',' : '.') + frac : '');
  return sign + body;
}

export function formatMoney(value: number, lang: Lang = 'de') {
  return lang === 'de' ? `${formatDecimal(value, 2, lang)} €` : `€${formatDecimal(value, 2, lang)}`;
}

export function formatDate(ms: number, lang: Lang = 'de') {
  const d = new Date(ms);
  return lang === 'de'
    ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatTime(ms: number) {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDateTime(ms: number, lang: Lang = 'de') {
  return `${formatDate(ms, lang)} ${formatTime(ms)}`;
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDurationShort(ms: number, lang: Lang = 'de') {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ${lang === 'de' ? 'Std.' : 'h'} ${m} min` : `${h} ${lang === 'de' ? 'Std.' : 'h'}`;
}

const MONTHS = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

const WEEKDAYS = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

export function monthName(month: number, lang: Lang = 'de') {
  return MONTHS[lang][month];
}

export function weekday(ms: number, lang: Lang = 'de') {
  return WEEKDAYS[lang][new Date(ms).getDay()];
}

export function dayLabel(ms: number, lang: Lang = 'de', now = Date.now()) {
  const d = new Date(ms);
  const today = new Date(now);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return lang === 'de' ? 'Heute' : 'Today';
  if (diff === 1) return lang === 'de' ? 'Gestern' : 'Yesterday';
  if (diff < 7 && diff > 0) return weekday(ms, lang);
  return lang === 'de'
    ? `${weekday(ms, lang).slice(0, 2)}., ${d.getDate()}. ${monthName(d.getMonth(), lang)}`
    : `${weekday(ms, lang).slice(0, 3)}, ${monthName(d.getMonth(), lang)} ${d.getDate()}`;
}

export function parseNumber(text: string) {
  const cleaned = text.replace(/[^\d,.-]/g, '');
  if (!cleaned) return null;
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
