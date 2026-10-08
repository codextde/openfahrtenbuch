import type { IconName } from '@/components/icon-names';
import type { CostCategory } from '@/core/types';

export const COST_ICON: Record<CostCategory, IconName> = {
  fuel: 'fuel',
  service: 'wrench',
  insurance: 'shield',
  tax: 'scale',
  leasing: 'doc',
  other: 'euro',
};
