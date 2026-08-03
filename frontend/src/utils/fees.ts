import type { FeeItem } from '../api/client';

/** Line amount for a fee add-on given membership duration. */
export function feeAddonLineAmount(fee: FeeItem, durationMonths: number): number {
  const price = Number(fee.price);
  const unit = (fee.unit || '').trim().toLowerCase();
  if (unit === 'per month') {
    return price * durationMonths;
  }
  return price;
}

export function selectedAddonTotal(
  fees: FeeItem[],
  selectedIds: number[],
  durationMonths: number,
): number {
  const selected = new Set(selectedIds);
  return fees
    .filter((fee) => selected.has(fee.id))
    .reduce((sum, fee) => sum + feeAddonLineAmount(fee, durationMonths), 0);
}

export function selectedAddonLines(
  fees: FeeItem[],
  selectedIds: number[],
  durationMonths: number,
): { fee: FeeItem; amount: number }[] {
  const selected = new Set(selectedIds);
  return fees
    .filter((fee) => selected.has(fee.id))
    .map((fee) => ({ fee, amount: feeAddonLineAmount(fee, durationMonths) }));
}
