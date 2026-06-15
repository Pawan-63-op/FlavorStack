// Entity (within OrderRequest, immutable): menuItem: MenuItemSnapshot, selectedOptions: VariantSnapshot[],
// quantity: Quantity, lineTotal: Money (Commerce Phase 11, commerce_module.md §3.2). Enforces the
// Price-Integrity invariant at the line level: lineTotal == (basePrice + Σ variant priceDelta) × quantity,
// all sharing one currency. Built once at checkout from authoritative snapshots; never mutated.
import { Entity } from '../../shared/Entity';
import { Result } from '../../shared/Result';
import { UniqueEntityId } from '../../shared/UniqueEntityId';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';
import { Quantity } from '../value-objects/Quantity';
import { MenuItemSnapshot } from '../value-objects/snapshots/MenuItemSnapshot';
import { VariantSnapshot } from '../value-objects/snapshots/VariantSnapshot';

export interface OrderRequestLineProps {
  menuItem: MenuItemSnapshot;
  selectedOptions: VariantSnapshot[];
  quantity: Quantity;
  lineTotal: Money;
}

export class OrderRequestLine extends Entity<OrderRequestLineProps> {
  private constructor(props: OrderRequestLineProps, id?: UniqueEntityId) {
    super(props, id);
  }

  get menuItem(): MenuItemSnapshot {
    return this.props.menuItem;
  }

  get selectedOptions(): VariantSnapshot[] {
    return [...this.props.selectedOptions];
  }

  get quantity(): Quantity {
    return this.props.quantity;
  }

  get lineTotal(): Money {
    return this.props.lineTotal;
  }

  public static create(props: OrderRequestLineProps, id?: UniqueEntityId): Result<OrderRequestLine> {
    if (!(props.menuItem instanceof MenuItemSnapshot)) {
      return Result.fail<OrderRequestLine>(new ValidationError('OrderRequestLine menuItem must be a valid MenuItemSnapshot'));
    }

    if (!Array.isArray(props.selectedOptions) || props.selectedOptions.some((o) => !(o instanceof VariantSnapshot))) {
      return Result.fail<OrderRequestLine>(
        new ValidationError('OrderRequestLine selectedOptions must be an array of VariantSnapshot value objects')
      );
    }

    if (!(props.quantity instanceof Quantity)) {
      return Result.fail<OrderRequestLine>(new ValidationError('OrderRequestLine quantity must be a valid Quantity'));
    }

    if (!(props.lineTotal instanceof Money)) {
      return Result.fail<OrderRequestLine>(new ValidationError('OrderRequestLine lineTotal must be a valid Money value object'));
    }

    // Price-Integrity invariant: unitPrice = basePrice + Σ variant priceDelta; lineTotal = unitPrice × quantity.
    // Money.add rejects currency mismatches, so this also enforces single-currency lines.
    let unitPrice = props.menuItem.basePrice;
    for (const option of props.selectedOptions) {
      const addResult = unitPrice.add(option.priceDelta);
      if (addResult.isFailure) return Result.fail<OrderRequestLine>(addResult.getError());
      unitPrice = addResult.getValue();
    }

    const expectedTotal = unitPrice.multiply(props.quantity.value);
    if (!expectedTotal.equals(props.lineTotal)) {
      return Result.fail<OrderRequestLine>(
        new ValidationError('OrderRequestLine lineTotal must equal (basePrice + Σ variant priceDelta) × quantity')
      );
    }

    return Result.ok<OrderRequestLine>(
      new OrderRequestLine(
        {
          menuItem: props.menuItem,
          selectedOptions: [...props.selectedOptions],
          quantity: props.quantity,
          lineTotal: props.lineTotal,
        },
        id
      )
    );
  }

  /** Rehydrate an already-valid line from persistence (repository entry point; raises no events). */
  public static reconstitute(props: OrderRequestLineProps, id: UniqueEntityId): OrderRequestLine {
    return new OrderRequestLine({ ...props, selectedOptions: [...props.selectedOptions] }, id);
  }
}
