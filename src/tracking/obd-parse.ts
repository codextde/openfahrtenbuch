const compact = (s: string) => s.replace(/\s/g, '').toUpperCase();

export function parsePid(lines: string[], pid: string, bytes: number): number[] | null {
  const marker = `41${pid}`;
  for (const line of lines) {
    const hex = compact(line);
    const at = hex.indexOf(marker);
    if (at === -1) continue;
    const data = hex.slice(at + marker.length, at + marker.length + bytes * 2);
    if (data.length < bytes * 2 || !/^[0-9A-F]+$/.test(data)) continue;
    const out: number[] = [];
    for (let i = 0; i < data.length; i += 2) out.push(parseInt(data.slice(i, i + 2), 16));
    return out;
  }
  return null;
}

export function decodeOdometer(b: number[]) {
  return (b[0] * 16777216 + b[1] * 65536 + b[2] * 256 + b[3]) / 10;
}

export function parseVin(lines: string[]) {
  const hex = lines
    .map((l) => compact(l).replace(/^[0-9A-F]:/, ''))
    .filter((l) => !/^[0-9A-F]{3}$/.test(l))
    .join('')
    .replace(/[^0-9A-F]/g, '');
  const at = hex.indexOf('4902');
  if (at === -1) return null;
  const body = hex.slice(at + 4).replace(/^0[0-9A-F]/, '');
  let text = '';
  for (let i = 0; i + 1 < body.length; i += 2) {
    const code = parseInt(body.slice(i, i + 2), 16);
    if (code >= 0x30 && code <= 0x5a) text += String.fromCharCode(code);
  }
  const match = /[A-HJ-NPR-Z0-9]{17}/.exec(text);
  return match ? match[0] : null;
}
