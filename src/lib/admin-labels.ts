/** Words staff see instead of database codes (PROCESSING, MANUAL…). */
export const ORDER_STATUS: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_REVIEW: "Payment to check",
  PAID: "Paid",
  PROCESSING: "Working",
  FULFILLED: "Done",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  CANCELED: "Canceled",
};
export const ITEM_STATUS: Record<string, string> = { PENDING: "Working", DELIVERED: "Done", FAILED: "Refunded" };
export const PAYMENT_STATUS: Record<string, string> = { PENDING: "Waiting", REVIEW: "To check", SUCCEEDED: "Received", FAILED: "Failed", REJECTED: "Rejected", EXPIRED: "Expired", CANCELED: "Canceled" };
export const METHOD: Record<string, string> = { WALLET: "Wallet", MONCASH: "MonCash", NATCASH: "NatCash", CARD: "Card", MANUAL: "Manual method", USDT: "USDT" };
export const SUPPLIER_STATUS: Record<string, string> = { SUBMITTING: "sending", WAITING: "waiting at", IN_PROCESS: "in process at", UNKNOWN: "no clear answer from", SUCCESS: "done at", REJECTED: "rejected by" };
export const label = (map: Record<string, string>, v: string) => map[v] ?? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");
