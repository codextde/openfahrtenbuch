import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

import type { LedgerEntry } from './types';

export const GENESIS = '0'.repeat(64);

export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function hashEntry(entry: Omit<LedgerEntry, 'hash'>): string {
  const body = [entry.prevHash, entry.seq, entry.at, entry.entity, entry.entityId, entry.action, entry.payload].join('|');
  return bytesToHex(sha256(utf8ToBytes(body)));
}

export type ChainProblem = { seq: number; reason: 'hash' | 'link' | 'order' };

export function verifyChain(entries: LedgerEntry[]): ChainProblem[] {
  const problems: ChainProblem[] = [];
  let prev = GENESIS;
  let lastSeq = 0;
  for (const entry of entries) {
    if (entry.seq !== lastSeq + 1) problems.push({ seq: entry.seq, reason: 'order' });
    if (entry.prevHash !== prev) problems.push({ seq: entry.seq, reason: 'link' });
    if (hashEntry(entry) !== entry.hash) problems.push({ seq: entry.seq, reason: 'hash' });
    prev = entry.hash;
    lastSeq = entry.seq;
  }
  return problems;
}

export function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`;
}
