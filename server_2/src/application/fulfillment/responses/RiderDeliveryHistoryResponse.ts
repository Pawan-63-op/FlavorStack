import { RiderDeliveryHistoryView } from '../../../domain/fulfillment/repositories/IFulfillmentQueryRepository';

/**
 * Rider payout model (demo/COD scope): a flat base per completed delivery plus a
 * commission on the order value. Amounts are in minor units (matching the stored
 * `total.amount`); currency mirrors the order total.
 */
export const RIDER_BASE_PAYOUT_MINOR = 2500; // ₹25 flat per delivery
export const RIDER_COMMISSION_RATE = 0.1; // 10% of the order value

export function computeRiderEarning(total: { amount: number; currency: string }): {
  amount: number;
  currency: string;
} {
  return {
    amount: RIDER_BASE_PAYOUT_MINOR + Math.round(total.amount * RIDER_COMMISSION_RATE),
    currency: total.currency,
  };
}

export interface RiderDeliveryHistoryItemResponse {
  fulfillmentId: string;
  restaurantId: string;
  status: string;
  total: { amount: number; currency: string };
  earning: { amount: number; currency: string };
  deliveredAt: string;
}

export interface RiderDeliveryHistoryResponse {
  deliveries: RiderDeliveryHistoryItemResponse[];
  summary: {
    totalDeliveries: number;
    totalEarnings: { amount: number; currency: string };
  };
}

export function toRiderDeliveryHistoryResponse(
  views: RiderDeliveryHistoryView[]
): RiderDeliveryHistoryResponse {
  const deliveries = views.map((view) => ({
    fulfillmentId: view.fulfillmentId,
    restaurantId: view.restaurantId,
    status: view.status,
    total: view.total,
    earning: computeRiderEarning(view.total),
    deliveredAt:
      view.deliveredAt instanceof Date ? view.deliveredAt.toISOString() : String(view.deliveredAt),
  }));

  const currency = deliveries[0]?.earning.currency ?? 'INR';
  const totalEarningsAmount = deliveries.reduce((sum, d) => sum + d.earning.amount, 0);

  return {
    deliveries,
    summary: {
      totalDeliveries: deliveries.length,
      totalEarnings: { amount: totalEarningsAmount, currency },
    },
  };
}
