// Result shape produced by ICartValidator (Commerce Phase 6) — a multi-issue report
// over a Cart validated against a CommerceCatalogRestaurantView (commerce_catalog_view).
//
// `isValid` reflects only ERROR-severity issues; WARNING issues (e.g. a possible
// min-order shortfall) are surfaced for the client but never block cart-time use.
// The authoritative, address-aware checks (serviceability, true min-order) run at
// checkout via the ICatalogGateway ACL (Phase 10/11).

export const VALIDATION_ISSUE_CODE = {
  RESTAURANT_NOT_FOUND: 'RESTAURANT_NOT_FOUND',
  RESTAURANT_INACTIVE: 'RESTAURANT_INACTIVE',
  RESTAURANT_NOT_VISIBLE: 'RESTAURANT_NOT_VISIBLE',
  RESTAURANT_CLOSED: 'RESTAURANT_CLOSED',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ITEM_UNAVAILABLE: 'ITEM_UNAVAILABLE',
  VARIANT_INVALID: 'VARIANT_INVALID',
  MIN_ORDER_NOT_MET: 'MIN_ORDER_NOT_MET',
} as const;
export type ValidationIssueCode = (typeof VALIDATION_ISSUE_CODE)[keyof typeof VALIDATION_ISSUE_CODE];

export const VALIDATION_SEVERITY = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
} as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITY)[keyof typeof VALIDATION_SEVERITY];

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  cartItemId?: string;
  menuItemId?: string;
}

export interface ValidationReport {
  isValid: boolean;
  issues: ValidationIssue[];
}
