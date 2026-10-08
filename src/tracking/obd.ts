import { BleTransport } from '@/obd/ble-transport';
import { Elm327, ElmError } from '@/obd/elm327';

import { decodeOdometer, parsePid, parseVin } from './obd-parse';

export type ObdInfo = { odometer: number | null; vin: string | null; rpm: number | null };

export class ObdLink {
  private elm: Elm327 | null = null;
  private onLost: (() => void) | null = null;
  odometerSupported = true;

  get connected() {
    return !!this.elm;
  }

  async connect(id: string, name: string, onLost: () => void) {
    await this.close();
    const transport = await BleTransport.connect(id, name);
    const elm = new Elm327(transport);
    this.onLost = onLost;
    transport.onClose((reason) => {
      if (this.elm === elm) {
        this.elm = null;
        if (reason !== 'closed') this.onLost?.();
      }
    });
    let reset: string[] = [];
    for (let i = 0; i < 2 && reset.length === 0; i++) reset = await elm.send('ATZ', 3500).catch(() => []);
    for (const cmd of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATAT1', 'ATSP0']) await elm.send(cmd, 1500).catch(() => undefined);
    try {
      await elm.send('0100', 15000);
    } catch (error) {
      await elm.close().catch(() => undefined);
      if (error instanceof ElmError && (error.code === 'unable-to-connect' || error.code === 'no-data')) throw new Error('no-answer');
      throw error;
    }
    this.elm = elm;
    this.odometerSupported = true;
  }

  async info(): Promise<ObdInfo> {
    const odometer = await this.odometer();
    const vin = await this.vin();
    const rpm = await this.rpm();
    return { odometer, vin, rpm };
  }

  async odometer(): Promise<number | null> {
    if (!this.elm || !this.odometerSupported) return null;
    try {
      const b = parsePid(await this.elm.send('01A6', 3000), 'A6', 4);
      if (!b) {
        this.odometerSupported = false;
        return null;
      }
      const km = decodeOdometer(b);
      return km > 0 ? km : null;
    } catch (error) {
      if (error instanceof ElmError && error.code === 'no-data') this.odometerSupported = false;
      return null;
    }
  }

  async speed(): Promise<number | null> {
    if (!this.elm) return null;
    const b = parsePid(await this.elm.send('010D', 2000).catch(() => []), '0D', 1);
    return b ? b[0] : null;
  }

  async rpm(): Promise<number | null> {
    if (!this.elm) return null;
    const b = parsePid(await this.elm.send('010C', 2000).catch(() => []), '0C', 2);
    return b ? (b[0] * 256 + b[1]) / 4 : null;
  }

  async vin(): Promise<string | null> {
    if (!this.elm) return null;
    return parseVin(await this.elm.send('0902', 5000).catch(() => []));
  }

  async close() {
    const elm = this.elm;
    this.elm = null;
    this.onLost = null;
    if (elm) await elm.close().catch(() => undefined);
  }
}

export const obd = new ObdLink();
