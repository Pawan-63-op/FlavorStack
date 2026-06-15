export const PAYMENT_METHOD = {
  CARD: "CARD",
  UPI: "UPI",
  WALLET: "WALLET",
  COD: "COD",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD]
