import { ValueObject } from '../../../shared/ValueObject';
import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../constants/snapshot-schema-version';
import { MoneyJSON, moneyFromJSON, moneyToJSON } from './snapshot-serialization';

interface MenuItemSnapshotProps {
  menuItemId: string;
  name: string;
  basePrice: Money;
  categoryId: string;
  schemaVersion: number;
}

export interface MenuItemSnapshotJSON {
  menuItemId: string;
  name: string;
  basePrice: MoneyJSON;
  categoryId: string;
  schemaVersion: number;
}

export class MenuItemSnapshot extends ValueObject<MenuItemSnapshotProps> {
  private constructor(props: MenuItemSnapshotProps) {
    super(props);
  }

  get menuItemId(): string {
    return this.props.menuItemId;
  }

  get name(): string {
    return this.props.name;
  }

  get basePrice(): Money {
    return this.props.basePrice;
  }

  get categoryId(): string {
    return this.props.categoryId;
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  public static create(props: {
    menuItemId: string;
    name: string;
    basePrice: Money;
    categoryId: string;
    schemaVersion?: number;
  }): Result<MenuItemSnapshot> {
    if (!props.menuItemId || typeof props.menuItemId !== 'string' || props.menuItemId.trim().length === 0) {
      return Result.fail<MenuItemSnapshot>(new ValidationError('MenuItemSnapshot menuItemId must be a non-empty string'));
    }

    if (!props.name || typeof props.name !== 'string' || props.name.trim().length === 0) {
      return Result.fail<MenuItemSnapshot>(new ValidationError('MenuItemSnapshot name must be a non-empty string'));
    }

    if (!(props.basePrice instanceof Money)) {
      return Result.fail<MenuItemSnapshot>(new ValidationError('MenuItemSnapshot basePrice must be a valid Money value object'));
    }

    if (!props.categoryId || typeof props.categoryId !== 'string' || props.categoryId.trim().length === 0) {
      return Result.fail<MenuItemSnapshot>(new ValidationError('MenuItemSnapshot categoryId must be a non-empty string'));
    }

    const schemaVersion = props.schemaVersion ?? COMMERCE_SNAPSHOT_SCHEMA_VERSION;
    if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
      return Result.fail<MenuItemSnapshot>(new ValidationError('MenuItemSnapshot schemaVersion must be a positive integer'));
    }

    return Result.ok<MenuItemSnapshot>(
      new MenuItemSnapshot({
        menuItemId: props.menuItemId,
        name: props.name,
        basePrice: props.basePrice,
        categoryId: props.categoryId,
        schemaVersion,
      })
    );
  }

  public toJSON(): MenuItemSnapshotJSON {
    return {
      menuItemId: this.props.menuItemId,
      name: this.props.name,
      basePrice: moneyToJSON(this.props.basePrice),
      categoryId: this.props.categoryId,
      schemaVersion: this.props.schemaVersion,
    };
  }

  public static fromJSON(json: MenuItemSnapshotJSON): Result<MenuItemSnapshot> {
    const basePriceResult = moneyFromJSON(json.basePrice);
    if (basePriceResult.isFailure) return Result.fail<MenuItemSnapshot>(basePriceResult.getError());

    return MenuItemSnapshot.create({
      menuItemId: json.menuItemId,
      name: json.name,
      basePrice: basePriceResult.getValue(),
      categoryId: json.categoryId,
      schemaVersion: json.schemaVersion,
    });
  }
}
