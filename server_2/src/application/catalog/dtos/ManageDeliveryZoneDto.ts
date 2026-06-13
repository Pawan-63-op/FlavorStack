import { ActorContext, GeoPointInput, MoneyInput } from './shared';

export const DELIVERY_ZONE_ACTION = {
  ADD: 'ADD',
  UPDATE: 'UPDATE',
  REMOVE: 'REMOVE',
} as const;
export type DeliveryZoneAction = (typeof DELIVERY_ZONE_ACTION)[keyof typeof DELIVERY_ZONE_ACTION];

export interface DeliveryFeeTierInput {
  maxDistanceMeters: number;
  fee: MoneyInput;
}

export interface DeliveryFeeMatrixInput {
  tiers: DeliveryFeeTierInput[];
  freeAboveSubtotal?: MoneyInput;
}

export interface ManageDeliveryZoneDto extends ActorContext {
  restaurantId: string;
  action: DeliveryZoneAction;
  zoneId?: string;
  polygon?: GeoPointInput[];
  feeMatrix?: DeliveryFeeMatrixInput;
  minOrder?: MoneyInput;
}
