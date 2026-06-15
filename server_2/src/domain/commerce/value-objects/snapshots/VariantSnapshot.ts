// VO: { optionId, label, priceDelta: Money, schemaVersion } — immutable copy of a selected
// variant/add-on option taken at checkout (Commerce Phase 9, commerce_module.md §3.3/§6.4).
import { ValueObject } from '../../../shared/ValueObject';
import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { Money } from '../../../shared/Money';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../constants/snapshot-schema-version';
import { MoneyJSON, moneyFromJSON, moneyToJSON } from './snapshot-serialization';

interface VariantSnapshotProps {
  optionId: string;
  label: string;
  priceDelta: Money;
  schemaVersion: number;
}

export interface VariantSnapshotJSON {
  optionId: string;
  label: string;
  priceDelta: MoneyJSON;
  schemaVersion: number;
}

export class VariantSnapshot extends ValueObject<VariantSnapshotProps> {
  private constructor(props: VariantSnapshotProps) {
    super(props);
  }

  get optionId(): string {
    return this.props.optionId;
  }

  get label(): string {
    return this.props.label;
  }

  get priceDelta(): Money {
    return this.props.priceDelta;
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  public static create(props: {
    optionId: string;
    label: string;
    priceDelta: Money;
    schemaVersion?: number;
  }): Result<VariantSnapshot> {
    if (!props.optionId || typeof props.optionId !== 'string' || props.optionId.trim().length === 0) {
      return Result.fail<VariantSnapshot>(new ValidationError('VariantSnapshot optionId must be a non-empty string'));
    }

    if (!props.label || typeof props.label !== 'string' || props.label.trim().length === 0) {
      return Result.fail<VariantSnapshot>(new ValidationError('VariantSnapshot label must be a non-empty string'));
    }

    if (!(props.priceDelta instanceof Money)) {
      return Result.fail<VariantSnapshot>(new ValidationError('VariantSnapshot priceDelta must be a valid Money value object'));
    }

    const schemaVersion = props.schemaVersion ?? COMMERCE_SNAPSHOT_SCHEMA_VERSION;
    if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
      return Result.fail<VariantSnapshot>(new ValidationError('VariantSnapshot schemaVersion must be a positive integer'));
    }

    return Result.ok<VariantSnapshot>(
      new VariantSnapshot({
        optionId: props.optionId,
        label: props.label,
        priceDelta: props.priceDelta,
        schemaVersion,
      })
    );
  }

  public toJSON(): VariantSnapshotJSON {
    return {
      optionId: this.props.optionId,
      label: this.props.label,
      priceDelta: moneyToJSON(this.props.priceDelta),
      schemaVersion: this.props.schemaVersion,
    };
  }

  public static fromJSON(json: VariantSnapshotJSON): Result<VariantSnapshot> {
    const priceDeltaResult = moneyFromJSON(json.priceDelta);
    if (priceDeltaResult.isFailure) return Result.fail<VariantSnapshot>(priceDeltaResult.getError());

    return VariantSnapshot.create({
      optionId: json.optionId,
      label: json.label,
      priceDelta: priceDeltaResult.getValue(),
      schemaVersion: json.schemaVersion,
    });
  }
}
