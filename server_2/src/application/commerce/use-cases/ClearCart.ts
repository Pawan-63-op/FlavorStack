import { Result } from '../../../domain/shared/Result';
import { NotFoundError } from '../../../domain/shared/errors/NotFoundError';
import { ICartRepository } from '../../../domain/commerce/repositories/ICartRepository';
import { IUnitOfWork } from '../../shared/ports/IUnitOfWork';
import { IEventBus } from '../../shared/events/IEventBus';
import { ClearCartDto } from '../dtos/ClearCartDto';
import { CartResponseDto, toCartResponse } from '../dtos/CartResponseDto';

export class ClearCart {
  constructor(
    private readonly cartRepo: ICartRepository,
    private readonly unitOfWork: IUnitOfWork,
    private readonly eventBus: IEventBus
  ) {}

  async execute(dto: ClearCartDto): Promise<Result<CartResponseDto>> {
    const cart = await this.cartRepo.findByCustomerId(dto.customerId);
    if (!cart) return Result.fail(new NotFoundError('cart_not_found'));

    const clearResult = cart.clear();
    if (clearResult.isFailure) return Result.fail(clearResult.getError());

    const events = cart.pullDomainEvents();

    await this.unitOfWork.runInTransaction(async () => {
      await this.cartRepo.save(cart);
    });

    await this.eventBus.publishAll(events);

    return Result.ok(toCartResponse(cart));
  }
}
