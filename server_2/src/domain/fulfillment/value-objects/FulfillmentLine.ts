import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Money } from '../../shared/Money';

export interface FulfillmentLineOption {
  optionId: string;
  label: string;
  priceDelta: Money;
}

interface FulfillmentLineProps {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOption[];
  lineTotal: Money;
}

export interface CreateFulfillmentLineInput {
  menuItemId: string;
  name: string;
  quantity: number;
  selectedOptions: FulfillmentLineOption[];
  lineTotal: Money;
}

export class FulfillmentLine extends ValueObject<FulfillmentLineProps> {
  private constructor(props: FulfillmentLineProps) {
    super(props);
  }

  get menuItemId(): string {
    return this.props.menuItemId;
  }

  get name(): string {
    return this.props.name;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get selectedOptions(): FulfillmentLineOption[] {
    return [...this.props.selectedOptions];
  }

  get lineTotal(): Money {
    return this.props.lineTotal;
  }

  public static create(input: CreateFulfillmentLineInput): Result<FulfillmentLine> {
    const menuItemIdCheck = Guard.againstEmptyString(input.menuItemId, 'MenuItemId');
    if (menuItemIdCheck.isFailure) return Result.fail<FulfillmentLine>(menuItemIdCheck.getError());

    const nameCheck = Guard.againstEmptyString(input.name, 'Line name');
    if (nameCheck.isFailure) return Result.fail<FulfillmentLine>(nameCheck.getError());

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      return Result.fail<FulfillmentLine>(new ValidationError('FulfillmentLine quantity must be a positive integer'));
    }

    if (!Array.isArray(input.selectedOptions)) {
      return Result.fail<FulfillmentLine>(new ValidationError('FulfillmentLine selectedOptions must be an array'));
    }

    if (!(input.lineTotal instanceof Money)) {
      return Result.fail<FulfillmentLine>(new ValidationError('FulfillmentLine lineTotal must be a valid Money'));
    }

    for (const option of input.selectedOptions) {
      if (!(option.priceDelta instanceof Money)) {
        return Result.fail<FulfillmentLine>(
          new ValidationError('FulfillmentLine selectedOptions priceDelta must be a valid Money')
        );
      }
    }

    return Result.ok<FulfillmentLine>(
      new FulfillmentLine({
        menuItemId: input.menuItemId,
        name: input.name,
        quantity: input.quantity,
        selectedOptions: [...input.selectedOptions],
        lineTotal: input.lineTotal,
      })
    );
  }
}
