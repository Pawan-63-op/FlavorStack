// UC: PreviewCheckout — dry-run of the Checkout pricing pipeline against the ACL/local projection;
// returns a CheckoutView; no persistence, no OrderRequest created
import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { GeoPoint } from '../../../domain/identity/value-objects/GeoPoint.vo';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IPricingCalculator } from '../../../domain/commerce/services/IPricingCalculator';
import { PreviewCheckoutDto } from '../dtos/PreviewCheckoutDto';
import { CheckoutViewResponse, toCheckoutViewResponse } from '../responses/CheckoutViewResponse';
import { CheckoutContextAssembler } from '../services/CheckoutContextAssembler';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

// PreviewCheckout (Commerce Phase 11 Batch 3) — the dry-run pricing path (commerce_module.md §4.4 / §7).
//
// Loads the customer's active cart, runs the SHARED checkout assembly (authoritative ACL reads + projected
// variants + pricing policy + re-validated promotion, see CheckoutContextAssembler), and folds the result
// through the pure pricing pipeline into a PricingBreakdown — WITHOUT persisting anything. Because Checkout
// (Batch 4) reuses the same assembler + calculator, the preview a customer sees matches what checkout commits.
export class PreviewCheckout {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly assembler: CheckoutContextAssembler,
    private readonly pricingCalculator: IPricingCalculator,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: PreviewCheckoutDto): Promise<Result<CheckoutViewResponse>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail<CheckoutViewResponse>(new NotFoundError('cart_not_found'));

    const pointResult = GeoPoint.create(dto.deliveryPoint.lat, dto.deliveryPoint.lng);
    if (pointResult.isFailure) return Result.fail<CheckoutViewResponse>(pointResult.getError());

    const assemblyResult = await this.assembler.assemble(cart, pointResult.getValue());
    if (assemblyResult.isFailure) return Result.fail<CheckoutViewResponse>(assemblyResult.getError());
    const assembly = assemblyResult.getValue();

    const pricingStartedAt = Date.now();
    const breakdownResult = this.pricingCalculator.calculate(assembly.pricingContext);
    this.telemetry.recordPricingLatency(Date.now() - pricingStartedAt, { mode: 'preview' });
    if (breakdownResult.isFailure) return Result.fail<CheckoutViewResponse>(breakdownResult.getError());

    return Result.ok<CheckoutViewResponse>(toCheckoutViewResponse(assembly, breakdownResult.getValue()));
  }
}
