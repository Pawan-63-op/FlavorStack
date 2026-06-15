import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { PricingLineInput } from '../../types/PricingContext';

// Pricing pipeline stage 1 (Commerce Phase 7, §4.2) — pure, Money-based.
// Computes Σ over lines of (basePrice + Σ variant priceDelta) × quantity.
// Currency is derived from the lines themselves; Money.add rejects any mismatch,
// so a single-currency cart is enforced implicitly.
export class SubtotalStage {
  public static run(lines: PricingLineInput[]): Result<Money> {
    if (!Array.isArray(lines) || lines.length === 0) {
      return Result.fail<Money>(new ValidationError('Subtotal requires at least one line'));
    }

    let subtotal: Money | null = null;

    for (const line of lines) {
      if (!(line.basePrice instanceof Money)) {
        return Result.fail<Money>(new ValidationError('Line basePrice must be a valid Money value object'));
      }

      // unit price = basePrice + Σ variant priceDelta
      let unitPrice = line.basePrice;
      for (const variant of line.selectedVariants ?? []) {
        if (!(variant.priceDelta instanceof Money)) {
          return Result.fail<Money>(new ValidationError('Variant priceDelta must be a valid Money value object'));
        }
        const addResult = unitPrice.add(variant.priceDelta);
        if (addResult.isFailure) return Result.fail<Money>(addResult.getError());
        unitPrice = addResult.getValue();
      }

      // line total = unit price × quantity
      const lineTotal = unitPrice.multiply(line.quantity.value);

      if (subtotal === null) {
        subtotal = lineTotal;
      } else {
        const sumResult: Result<Money> = subtotal.add(lineTotal);
        if (sumResult.isFailure) return Result.fail<Money>(sumResult.getError());
        subtotal = sumResult.getValue();
      }
    }

    return Result.ok<Money>(subtotal as Money);
  }
}
