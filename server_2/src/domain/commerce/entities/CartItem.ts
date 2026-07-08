import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { Quantity } from '../value-objects/Quantity';

export interface CartItemProps {
  menuItemId: string;
  quantity: Quantity;
  selectedOptionIds: string[];
  unitPriceSnapshot: Money;
}

export class CartItem extends Entity<CartItemProps> {
  private constructor(props: CartItemProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get menuItemId(): string {
    return this.props.menuItemId;
  }

  get quantity(): Quantity {
    return this.props.quantity;
  }

  get selectedOptionIds(): string[] {
    return [...this.props.selectedOptionIds];
  }

  get unitPriceSnapshot(): Money {
    return this.props.unitPriceSnapshot;
  }

  public static create(props: CartItemProps, id?: UniqueEntityId): Result<CartItem> {
    const menuItemIdCheck = Guard.againstEmptyString(props.menuItemId, 'MenuItemId');
    if (menuItemIdCheck.isFailure) return Result.fail<CartItem>(menuItemIdCheck.getError());

    if (!(props.quantity instanceof Quantity)) {
      return Result.fail<CartItem>(new ValidationError('Quantity must be a valid Quantity value object'));
    }

    if (!Array.isArray(props.selectedOptionIds)) {
      return Result.fail<CartItem>(new ValidationError('SelectedOptionIds must be an array'));
    }

    if (!(props.unitPriceSnapshot instanceof Money)) {
      return Result.fail<CartItem>(new ValidationError('UnitPriceSnapshot must be a valid Money value object'));
    }

    return Result.ok<CartItem>(
      new CartItem(
        {
          menuItemId: props.menuItemId,
          quantity: props.quantity,
          selectedOptionIds: [...props.selectedOptionIds],
          unitPriceSnapshot: props.unitPriceSnapshot,
        },
        id
      )
    );
  }

  /**
   * Two cart lines are the same logical line when they target the same menu item
   * with the same set of selected options, regardless of order — used by
   * Cart.addItem to merge identical lines.
   */
  public matchesSelection(menuItemId: string, selectedOptionIds: string[]): boolean {
    if (this.props.menuItemId !== menuItemId) return false;

    const a = [...this.props.selectedOptionIds].sort();
    const b = [...selectedOptionIds].sort();
    if (a.length !== b.length) return false;

    return a.every((id, index) => id === b[index]);
  }

  public increaseQuantity(by: Quantity): Result<void> {
    const newQuantity = this.props.quantity.add(by);
    if (newQuantity.isFailure) return Result.fail<void>(newQuantity.getError());

    this.props.quantity = newQuantity.getValue();
    return Result.ok<void>();
  }

  public changeQuantity(quantity: Quantity): Result<void> {
    if (!(quantity instanceof Quantity)) {
      return Result.fail<void>(new ValidationError('Quantity must be a valid Quantity value object'));
    }

    this.props.quantity = quantity;
    return Result.ok<void>();
  }

  public lineTotal(): Money {
    return this.props.unitPriceSnapshot.multiply(this.props.quantity.value);
  }
}
