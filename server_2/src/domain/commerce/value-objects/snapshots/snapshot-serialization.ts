import { Result } from '../../../shared/Result';
import { Money } from '../../../shared/Money';
import { Fee } from '../Fee';
import { FeeType } from '../../enums/fee-type.enum';
import { PricingBreakdown } from '../PricingBreakdown';

export interface MoneyJSON {
  amount: number;
  currency: string;
}

export function moneyToJSON(money: Money): MoneyJSON {
  return { amount: money.amount, currency: money.currency };
}

export function moneyFromJSON(json: MoneyJSON): Result<Money> {
  return Money.create(json.amount, json.currency);
}

export interface FeeJSON {
  type: string;
  amount: MoneyJSON;
}

export function feeToJSON(fee: Fee): FeeJSON {
  return { type: fee.type, amount: moneyToJSON(fee.amount) };
}

export function feeFromJSON(json: FeeJSON): Result<Fee> {
  const amountResult = moneyFromJSON(json.amount);
  if (amountResult.isFailure) return Result.fail<Fee>(amountResult.getError());
  return Fee.create({ type: json.type as FeeType, amount: amountResult.getValue() });
}

export interface PricingBreakdownJSON {
  subtotal: MoneyJSON;
  fees: FeeJSON[];
  discount: MoneyJSON;
  tax: MoneyJSON;
  total: MoneyJSON;
}

export function pricingBreakdownToJSON(breakdown: PricingBreakdown): PricingBreakdownJSON {
  return {
    subtotal: moneyToJSON(breakdown.subtotal),
    fees: breakdown.fees.map(feeToJSON),
    discount: moneyToJSON(breakdown.discount),
    tax: moneyToJSON(breakdown.tax),
    total: moneyToJSON(breakdown.total),
  };
}

export function pricingBreakdownFromJSON(json: PricingBreakdownJSON): Result<PricingBreakdown> {
  const subtotalResult = moneyFromJSON(json.subtotal);
  if (subtotalResult.isFailure) return Result.fail<PricingBreakdown>(subtotalResult.getError());

  const fees: Fee[] = [];
  for (const feeJSON of json.fees) {
    const feeResult = feeFromJSON(feeJSON);
    if (feeResult.isFailure) return Result.fail<PricingBreakdown>(feeResult.getError());
    fees.push(feeResult.getValue());
  }

  const discountResult = moneyFromJSON(json.discount);
  if (discountResult.isFailure) return Result.fail<PricingBreakdown>(discountResult.getError());

  const taxResult = moneyFromJSON(json.tax);
  if (taxResult.isFailure) return Result.fail<PricingBreakdown>(taxResult.getError());

  const totalResult = moneyFromJSON(json.total);
  if (totalResult.isFailure) return Result.fail<PricingBreakdown>(totalResult.getError());

  return PricingBreakdown.create({
    subtotal: subtotalResult.getValue(),
    fees,
    discount: discountResult.getValue(),
    tax: taxResult.getValue(),
    total: totalResult.getValue(),
  });
}
