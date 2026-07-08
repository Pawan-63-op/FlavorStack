export function trackingRoom(fulfillmentId: string): string {
  return `fulfillment:${fulfillmentId}`;
}

export const TRACKING_LOCATION_EVENT = 'tracking:location';
export const TRACKING_STATUS_EVENT = 'tracking:status';
