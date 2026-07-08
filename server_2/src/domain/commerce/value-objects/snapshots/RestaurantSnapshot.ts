import { ValueObject } from '../../../shared/ValueObject';
import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { COMMERCE_RESTAURANT_STATUS, CommerceRestaurantStatus } from '../../enums/restaurant-status.enum';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../constants/snapshot-schema-version';
import { MoneyJSON, moneyFromJSON, moneyToJSON } from './snapshot-serialization';

export interface RestaurantSnapshotDeliveryFeeTier {
  maxDistanceMeters: number;
  fee: Money;
}

export interface RestaurantSnapshotDeliveryFeeInputs {
  feeTiers: RestaurantSnapshotDeliveryFeeTier[];
  freeAboveSubtotal?: Money;
}

interface RestaurantSnapshotProps {
  restaurantId: string;
  name: string;
  status: CommerceRestaurantStatus;
  openAtCheckout: boolean;
  deliveryFeeInputs: RestaurantSnapshotDeliveryFeeInputs;
  schemaVersion: number;
}

export interface RestaurantSnapshotDeliveryFeeTierJSON {
  maxDistanceMeters: number;
  fee: MoneyJSON;
}

export interface RestaurantSnapshotJSON {
  restaurantId: string;
  name: string;
  status: string;
  openAtCheckout: boolean;
  deliveryFeeInputs: {
    feeTiers: RestaurantSnapshotDeliveryFeeTierJSON[];
    freeAboveSubtotal?: MoneyJSON;
  };
  schemaVersion: number;
}

export class RestaurantSnapshot extends ValueObject<RestaurantSnapshotProps> {
  private constructor(props: RestaurantSnapshotProps) {
    super(props);
  }

  get restaurantId(): string {
    return this.props.restaurantId;
  }

  get name(): string {
    return this.props.name;
  }

  get status(): CommerceRestaurantStatus {
    return this.props.status;
  }

  get openAtCheckout(): boolean {
    return this.props.openAtCheckout;
  }

  get deliveryFeeInputs(): RestaurantSnapshotDeliveryFeeInputs {
    return {
      feeTiers: this.props.deliveryFeeInputs.feeTiers.map((tier) => ({ ...tier })),
      freeAboveSubtotal: this.props.deliveryFeeInputs.freeAboveSubtotal,
    };
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  public static create(props: {
    restaurantId: string;
    name: string;
    status: CommerceRestaurantStatus;
    openAtCheckout: boolean;
    deliveryFeeInputs: RestaurantSnapshotDeliveryFeeInputs;
    schemaVersion?: number;
  }): Result<RestaurantSnapshot> {
    if (!props.restaurantId || typeof props.restaurantId !== 'string' || props.restaurantId.trim().length === 0) {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot restaurantId must be a non-empty string'));
    }

    if (!props.name || typeof props.name !== 'string' || props.name.trim().length === 0) {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot name must be a non-empty string'));
    }

    const validStatuses = Object.values(COMMERCE_RESTAURANT_STATUS) as string[];
    if (!validStatuses.includes(props.status)) {
      return Result.fail<RestaurantSnapshot>(
        new ValidationError(`RestaurantSnapshot status must be one of: ${validStatuses.join(', ')}`)
      );
    }

    if (typeof props.openAtCheckout !== 'boolean') {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot openAtCheckout must be a boolean'));
    }

    const feeTiers = props.deliveryFeeInputs?.feeTiers;
    if (!Array.isArray(feeTiers) || feeTiers.length === 0) {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot deliveryFeeInputs.feeTiers must be a non-empty array'));
    }

    let previousMax = 0;
    for (const tier of feeTiers) {
      if (typeof tier.maxDistanceMeters !== 'number' || isNaN(tier.maxDistanceMeters) || tier.maxDistanceMeters <= 0) {
        return Result.fail<RestaurantSnapshot>(new ValidationError('Delivery fee tier maxDistanceMeters must be a positive number'));
      }
      if (tier.maxDistanceMeters <= previousMax) {
        return Result.fail<RestaurantSnapshot>(new ValidationError('Delivery fee tier maxDistanceMeters must be strictly increasing'));
      }
      if (!(tier.fee instanceof Money)) {
        return Result.fail<RestaurantSnapshot>(new ValidationError('Delivery fee tier fee must be a valid Money value object'));
      }
      previousMax = tier.maxDistanceMeters;
    }

    const freeAboveSubtotal = props.deliveryFeeInputs.freeAboveSubtotal;
    if (freeAboveSubtotal !== undefined && !(freeAboveSubtotal instanceof Money)) {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot deliveryFeeInputs.freeAboveSubtotal must be a valid Money value object'));
    }

    const schemaVersion = props.schemaVersion ?? COMMERCE_SNAPSHOT_SCHEMA_VERSION;
    if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
      return Result.fail<RestaurantSnapshot>(new ValidationError('RestaurantSnapshot schemaVersion must be a positive integer'));
    }

    return Result.ok<RestaurantSnapshot>(
      new RestaurantSnapshot({
        restaurantId: props.restaurantId,
        name: props.name,
        status: props.status,
        openAtCheckout: props.openAtCheckout,
        deliveryFeeInputs: {
          feeTiers: feeTiers.map((tier) => ({ maxDistanceMeters: tier.maxDistanceMeters, fee: tier.fee })),
          freeAboveSubtotal,
        },
        schemaVersion,
      })
    );
  }

  public toJSON(): RestaurantSnapshotJSON {
    return {
      restaurantId: this.props.restaurantId,
      name: this.props.name,
      status: this.props.status,
      openAtCheckout: this.props.openAtCheckout,
      deliveryFeeInputs: {
        feeTiers: this.props.deliveryFeeInputs.feeTiers.map((tier) => ({
          maxDistanceMeters: tier.maxDistanceMeters,
          fee: moneyToJSON(tier.fee),
        })),
        freeAboveSubtotal: this.props.deliveryFeeInputs.freeAboveSubtotal
          ? moneyToJSON(this.props.deliveryFeeInputs.freeAboveSubtotal)
          : undefined,
      },
      schemaVersion: this.props.schemaVersion,
    };
  }

  public static fromJSON(json: RestaurantSnapshotJSON): Result<RestaurantSnapshot> {
    const feeTiers: RestaurantSnapshotDeliveryFeeTier[] = [];
    for (const tierJSON of json.deliveryFeeInputs.feeTiers) {
      const feeResult = moneyFromJSON(tierJSON.fee);
      if (feeResult.isFailure) return Result.fail<RestaurantSnapshot>(feeResult.getError());
      feeTiers.push({ maxDistanceMeters: tierJSON.maxDistanceMeters, fee: feeResult.getValue() });
    }

    let freeAboveSubtotal: Money | undefined;
    if (json.deliveryFeeInputs.freeAboveSubtotal) {
      const freeAboveSubtotalResult = moneyFromJSON(json.deliveryFeeInputs.freeAboveSubtotal);
      if (freeAboveSubtotalResult.isFailure) return Result.fail<RestaurantSnapshot>(freeAboveSubtotalResult.getError());
      freeAboveSubtotal = freeAboveSubtotalResult.getValue();
    }

    return RestaurantSnapshot.create({
      restaurantId: json.restaurantId,
      name: json.name,
      status: json.status as CommerceRestaurantStatus,
      openAtCheckout: json.openAtCheckout,
      deliveryFeeInputs: { feeTiers, freeAboveSubtotal },
      schemaVersion: json.schemaVersion,
    });
  }
}
