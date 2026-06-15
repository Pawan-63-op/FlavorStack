// VO: frozen PricingBreakdown stored on the OrderRequest; schemaVersion-tagged for reproducibility
// (Commerce Phase 9, commerce_module.md §3.3/§6.4). `PricingBreakdown` is itself an immutable VO whose
// `create()` enforces the total == subtotal + Σfees − discount + tax invariant; PricingSnapshot wraps
// an already-validated breakdown and stamps it with the schema version in effect at checkout time.
import { ValueObject } from '../../../shared/ValueObject';
import { Result } from '../../../shared/Result';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { PricingBreakdown } from '../PricingBreakdown';
import { COMMERCE_SNAPSHOT_SCHEMA_VERSION } from '../../constants/snapshot-schema-version';
import { PricingBreakdownJSON, pricingBreakdownFromJSON, pricingBreakdownToJSON } from './snapshot-serialization';

interface PricingSnapshotProps {
  pricing: PricingBreakdown;
  schemaVersion: number;
}

export interface PricingSnapshotJSON {
  pricing: PricingBreakdownJSON;
  schemaVersion: number;
}

export class PricingSnapshot extends ValueObject<PricingSnapshotProps> {
  private constructor(props: PricingSnapshotProps) {
    super(props);
  }

  get pricing(): PricingBreakdown {
    return this.props.pricing;
  }

  get schemaVersion(): number {
    return this.props.schemaVersion;
  }

  public static create(props: { pricing: PricingBreakdown; schemaVersion?: number }): Result<PricingSnapshot> {
    if (!(props.pricing instanceof PricingBreakdown)) {
      return Result.fail<PricingSnapshot>(new ValidationError('PricingSnapshot pricing must be a valid PricingBreakdown value object'));
    }

    const schemaVersion = props.schemaVersion ?? COMMERCE_SNAPSHOT_SCHEMA_VERSION;
    if (!Number.isInteger(schemaVersion) || schemaVersion <= 0) {
      return Result.fail<PricingSnapshot>(new ValidationError('PricingSnapshot schemaVersion must be a positive integer'));
    }

    return Result.ok<PricingSnapshot>(
      new PricingSnapshot({
        pricing: props.pricing,
        schemaVersion,
      })
    );
  }

  public toJSON(): PricingSnapshotJSON {
    return {
      pricing: pricingBreakdownToJSON(this.props.pricing),
      schemaVersion: this.props.schemaVersion,
    };
  }

  public static fromJSON(json: PricingSnapshotJSON): Result<PricingSnapshot> {
    const pricingResult = pricingBreakdownFromJSON(json.pricing);
    if (pricingResult.isFailure) return Result.fail<PricingSnapshot>(pricingResult.getError());

    return PricingSnapshot.create({
      pricing: pricingResult.getValue(),
      schemaVersion: json.schemaVersion,
    });
  }
}
