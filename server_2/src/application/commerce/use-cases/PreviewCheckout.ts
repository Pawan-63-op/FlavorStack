import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IPricingCalculator } from '../../../domain/commerce/services/IPricingCalculator';
import { PreviewCheckoutDto } from '../dtos/PreviewCheckoutDto';
import { CheckoutViewResponse, toCheckoutViewResponse } from '../responses/CheckoutViewResponse';
import { CheckoutContextAssembler } from '../services/CheckoutContextAssembler';
import { DeliveryAddressResolver } from '../services/DeliveryAddressResolver';
import { CommerceTelemetry } from '../observability/CommerceTelemetry';

export class PreviewCheckout {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly assembler: CheckoutContextAssembler,
    private readonly addressResolver: DeliveryAddressResolver,
    private readonly pricingCalculator: IPricingCalculator,
    private readonly telemetry: CommerceTelemetry = new CommerceTelemetry()
  ) {}

  async execute(dto: PreviewCheckoutDto): Promise<Result<CheckoutViewResponse>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail<CheckoutViewResponse>(new NotFoundError('cart_not_found'));

    // Same resolution as `Checkout`, so the previewed delivery fee and the charged one
    // are computed from the same point.
    const pointResult = await this.addressResolver.resolvePoint({
      customerId: dto.customerId,
      addressId: dto.addressId,
      point: dto.deliveryPoint,
    });
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
