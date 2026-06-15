import { AggregateRoot } from '../../shared/AggregateRoot';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { ConflictError } from '../../shared/errors/ConflictError';
import { NotFoundError } from '../../shared/errors/NotFoundError';
import { Money } from '../../shared/Money';

import { CartItem } from './CartItem';
import { LineItemSelection } from '../value-objects/LineItemSelection';
import { Quantity } from '../value-objects/Quantity';
import { AppliedPromotion } from '../value-objects/AppliedPromotion';
import { CartItemAdded } from '../events/CartItemAdded';
import { CartCleared } from '../events/CartCleared';

// AggregateRoot: customerId, restaurantId (null until first item), items: CartItem[],
// currency (locked to first item's currency), appliedPromotion (Phase 8), version —
// addItem(restaurantId, selection, unitPrice), removeItem(cartItemId),
// updateQuantity(cartItemId, qty), applyPromotion(promo), removePromotion(), clear().
// Enforces single-restaurant + currency invariants + one-promotion-per-cart;
// raises CartItemAdded / CartCleared.
export interface CartProps {
  customerId: string;
  restaurantId: string | null;
  items: CartItem[];
  currency: string | null;
  appliedPromotion: AppliedPromotion | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Cart extends AggregateRoot<CartProps> {
  // The `version` present when this aggregate was loaded from persistence (0 for a
  // freshly created one). `touch()` advances `props.version` past this on each
  // mutation; the repository uses it as the optimistic-lock guard while writing the
  // new `version`.
  private readonly _persistedVersion: number;

  private constructor(props: CartProps, id?: UniqueEntityId) {
    super(props, id);
    this._persistedVersion = props.version;
  }

  get persistedVersion(): number {
    return this._persistedVersion;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get restaurantId(): string | null {
    return this.props.restaurantId;
  }

  get items(): CartItem[] {
    return [...this.props.items];
  }

  get currency(): string | null {
    return this.props.currency;
  }

  get appliedPromotion(): AppliedPromotion | null {
    return this.props.appliedPromotion;
  }

  get version(): number {
    return this.props.version;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get isEmpty(): boolean {
    return this.props.items.length === 0;
  }

  private touch(): void {
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  public static create(customerId: string, id?: UniqueEntityId): Result<Cart> {
    const customerIdCheck = Guard.againstEmptyString(customerId, 'CustomerId');
    if (customerIdCheck.isFailure) return Result.fail<Cart>(customerIdCheck.getError());

    const now = new Date();
    return Result.ok<Cart>(
      new Cart(
        {
          customerId,
          restaurantId: null,
          items: [],
          currency: null,
          appliedPromotion: null,
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
        id
      )
    );
  }

  /**
   * Rebuild a Cart from already-valid persisted state. Unlike `create()`, this
   * raises no domain events — it is the repository's rehydration entry point.
   */
  public static reconstitute(props: CartProps, id: UniqueEntityId): Cart {
    return new Cart(props, id);
  }

  private findItem(cartItemId: string): CartItem | undefined {
    return this.props.items.find((item) => item.id.toString() === cartItemId);
  }

  public addItem(restaurantId: string, selection: LineItemSelection, unitPrice: Money): Result<void> {
    const restaurantIdCheck = Guard.againstEmptyString(restaurantId, 'RestaurantId');
    if (restaurantIdCheck.isFailure) return Result.fail<void>(restaurantIdCheck.getError());

    if (!(selection instanceof LineItemSelection)) {
      return Result.fail<void>(new ValidationError('Selection must be a valid LineItemSelection value object'));
    }

    if (!(unitPrice instanceof Money)) {
      return Result.fail<void>(new ValidationError('UnitPrice must be a valid Money value object'));
    }

    // Single-restaurant invariant
    if (this.props.restaurantId !== null && this.props.restaurantId !== restaurantId) {
      return Result.fail<void>(
        new ConflictError('Cart already contains items from a different restaurant')
      );
    }

    // Currency invariant
    if (this.props.currency !== null && this.props.currency !== unitPrice.currency) {
      return Result.fail<void>(
        new ValidationError(`Currency mismatch: cart is in ${this.props.currency}, item is in ${unitPrice.currency}`)
      );
    }

    const existing = this.props.items.find((item) =>
      item.matchesSelection(selection.menuItemId, selection.selectedOptionIds)
    );

    if (existing) {
      const increaseResult = existing.increaseQuantity(selection.quantity);
      if (increaseResult.isFailure) return Result.fail<void>(increaseResult.getError());
    } else {
      const itemResult = CartItem.create({
        menuItemId: selection.menuItemId,
        quantity: selection.quantity,
        selectedOptionIds: selection.selectedOptionIds,
        unitPriceSnapshot: unitPrice,
      });
      if (itemResult.isFailure) return Result.fail<void>(itemResult.getError());

      this.props.items.push(itemResult.getValue());
    }

    this.props.restaurantId = restaurantId;
    this.props.currency = unitPrice.currency;
    // Line set changed → any applied promotion's discount is stale; drop it so a
    // discount computed against a different subtotal is never persisted. The customer
    // re-applies; checkout re-validates/recomputes regardless.
    this.props.appliedPromotion = null;
    this.touch();
    this.addDomainEvent(new CartItemAdded(this.id.toString(), selection.menuItemId, selection.quantity.value));
    return Result.ok<void>();
  }

  public removeItem(cartItemId: string): Result<void> {
    const item = this.findItem(cartItemId);
    if (!item) {
      return Result.fail<void>(new NotFoundError(`Cart item not found: ${cartItemId}`));
    }

    this.props.items = this.props.items.filter((i) => i.id.toString() !== cartItemId);
    this.props.appliedPromotion = null;

    if (this.props.items.length === 0) {
      this.props.restaurantId = null;
      this.props.currency = null;
    }

    this.touch();
    return Result.ok<void>();
  }

  public updateQuantity(cartItemId: string, quantity: Quantity): Result<void> {
    const item = this.findItem(cartItemId);
    if (!item) {
      return Result.fail<void>(new NotFoundError(`Cart item not found: ${cartItemId}`));
    }

    const changeResult = item.changeQuantity(quantity);
    if (changeResult.isFailure) return Result.fail<void>(changeResult.getError());

    this.props.appliedPromotion = null;
    this.touch();
    return Result.ok<void>();
  }

  /**
   * Attach an already-validated promotion to the cart (Phase 8). The AppliedPromotion
   * is produced by IPromotionService (which enforces eligibility / min-order); the
   * aggregate enforces the structural invariants: a non-empty cart and a discount whose
   * currency matches the cart. One promotion per cart — applying replaces any existing one.
   */
  public applyPromotion(promotion: AppliedPromotion): Result<void> {
    if (!(promotion instanceof AppliedPromotion)) {
      return Result.fail<void>(new ValidationError('Promotion must be a valid AppliedPromotion value object'));
    }

    if (this.props.items.length === 0) {
      return Result.fail<void>(new ValidationError('Cannot apply a promotion to an empty cart'));
    }

    if (this.props.currency !== null && promotion.discount.currency !== this.props.currency) {
      return Result.fail<void>(
        new ValidationError(
          `Promotion currency mismatch: cart is in ${this.props.currency}, promotion is in ${promotion.discount.currency}`
        )
      );
    }

    this.props.appliedPromotion = promotion;
    this.touch();
    return Result.ok<void>();
  }

  public removePromotion(): Result<void> {
    if (this.props.appliedPromotion === null) {
      return Result.fail<void>(new ValidationError('No promotion is applied to this cart'));
    }

    this.props.appliedPromotion = null;
    this.touch();
    return Result.ok<void>();
  }

  /**
   * Fold the cart's line totals into a single subtotal Money. Used to build the
   * PromotionContext for cart-time promotion validation. Fails on an empty cart
   * (no currency yet) or any Money currency mismatch.
   */
  public calculateSubtotal(): Result<Money> {
    if (this.props.items.length === 0) {
      return Result.fail<Money>(new ValidationError('Cannot compute subtotal for an empty cart'));
    }

    let subtotal = this.props.items[0]!.lineTotal();
    for (let i = 1; i < this.props.items.length; i += 1) {
      const addResult = subtotal.add(this.props.items[i]!.lineTotal());
      if (addResult.isFailure) return Result.fail<Money>(addResult.getError());
      subtotal = addResult.getValue();
    }
    return Result.ok<Money>(subtotal);
  }

  public clear(): Result<void> {
    this.props.items = [];
    this.props.restaurantId = null;
    this.props.currency = null;
    this.props.appliedPromotion = null;
    this.touch();
    this.addDomainEvent(new CartCleared(this.id.toString()));
    return Result.ok<void>();
  }
}
