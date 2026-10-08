import { openDatabaseSync, type SQLiteBindValue } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { Repo } from '@/core/repo';
import { migrate, type Sql } from '@/core/sql';

const database = openDatabaseSync('fahrtenbuch.db');

let depth = 0;
export const sql: Sql = {
  exec: (source) => database.execSync(source),
  run: (source, params = []) => {
    database.runSync(source, params as SQLiteBindValue[]);
  },
  all: (source, params = []) => database.getAllSync(source, params as SQLiteBindValue[]),
  get: (source, params = []) => database.getFirstSync(source, params as SQLiteBindValue[]),
  transaction: (task) => {
    if (depth > 0) return task();
    depth++;
    try {
      database.withTransactionSync(task);
    } finally {
      depth--;
    }
  },
};

migrate(sql);

export const repo = new Repo(sql);

let version = 0;
const listeners = new Set<() => void>();

export function changed() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDataVersion() {
  return useSyncExternalStore(subscribe, () => version);
}

export function mutate<T>(task: (r: Repo) => T): T {
  const result = task(repo);
  changed();
  return result;
}
