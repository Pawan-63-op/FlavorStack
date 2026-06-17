// Socket.IO room naming for the tracking namespace (fulfillment_module.md §9, Phase 7).
// One room per fulfillmentId — customer joins their order's room; the assigned rider joins to push.
export function trackingRoom(fulfillmentId: string): string {
  return `fulfillment:${fulfillmentId}`;
}

// Realtime event names broadcast to a tracking room.
export const TRACKING_LOCATION_EVENT = 'tracking:location';
export const TRACKING_STATUS_EVENT = 'tracking:status';
