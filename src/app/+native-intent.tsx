import { linkAction, queueAction } from '@/lib/actions';

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  const action = linkAction(path);
  if (!action) return path;
  queueAction(action);
  return initial ? '/' : '';
}
