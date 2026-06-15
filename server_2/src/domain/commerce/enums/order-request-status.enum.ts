export const ORDER_REQUEST_STATUS = {
  REQUESTED: "REQUESTED",
} as const;
export type OrderRequestStatus = (typeof ORDER_REQUEST_STATUS)[keyof typeof ORDER_REQUEST_STATUS]
