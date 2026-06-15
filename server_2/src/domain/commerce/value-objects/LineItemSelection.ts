import { ValueObject } from '../../shared/ValueObject';
import { Result } from '../../shared/Result';
import { Guard } from '../../shared/Guard';
import { ValidationError } from '../../shared/errors/ValidationError';
import { Quantity } from './Quantity';

interface LineItemSelectionProps {
  menuItemId: string;
  selectedOptionIds: string[];
  quantity: Quantity;
}

export class LineItemSelection extends ValueObject<LineItemSelectionProps> {
  private constructor(props: LineItemSelectionProps) {
    super(props);
  }

  get menuItemId(): string {
    return this.props.menuItemId;
  }

  get selectedOptionIds(): string[] {
    return [...this.props.selectedOptionIds];
  }

  get quantity(): Quantity {
    return this.props.quantity;
  }

  public static create(props: {
    menuItemId: string;
    selectedOptionIds?: string[];
    quantity: number | Quantity;
  }): Result<LineItemSelection> {
    const menuItemIdCheck = Guard.againstEmptyString(props.menuItemId, 'MenuItemId');
    if (menuItemIdCheck.isFailure) return Result.fail<LineItemSelection>(menuItemIdCheck.getError());

    let selectedOptionIds: string[] = [];
    if (props.selectedOptionIds !== undefined) {
      if (!Array.isArray(props.selectedOptionIds)) {
        return Result.fail<LineItemSelection>(new ValidationError('SelectedOptionIds must be an array'));
      }
      selectedOptionIds = props.selectedOptionIds;
    }

    let quantity: Quantity;
    if (props.quantity instanceof Quantity) {
      quantity = props.quantity;
    } else {
      const quantityResult = Quantity.create(props.quantity);
      if (quantityResult.isFailure) return Result.fail<LineItemSelection>(quantityResult.getError());
      quantity = quantityResult.getValue();
    }

    return Result.ok<LineItemSelection>(
      new LineItemSelection({
        menuItemId: props.menuItemId,
        selectedOptionIds,
        quantity,
      })
    );
  }

  /**
   * Two selections refer to the same logical cart line when they target the same
   * menu item with the same set of selected options, regardless of order.
   */
  public hasSameSelection(other: LineItemSelection): boolean {
    if (this.props.menuItemId !== other.menuItemId) return false;

    const a = [...this.props.selectedOptionIds].sort();
    const b = [...other.selectedOptionIds].sort();
    if (a.length !== b.length) return false;

    return a.every((id, index) => id === b[index]);
  }
}
