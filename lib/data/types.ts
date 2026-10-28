/** Shapes shared by the customer book and the priorities list. */

export type CustomerClass =
  | "Growing" | "Healthy" | "Stable" | "Declining" | "Dormant" | "Lost"
  | "Recovered" | "High Potential" | "VIP" | "New" | "Seasonal" | "Price Sensitive";

export type Customer = {
  id: string;
  name: string;
  country: string;
  flag: string;
  segment: CustomerClass;
  health: number;            // 0–100 composite health score
  churnRisk: number;         // probability %
  rfm: { r: number; f: number; m: number };
  ltv: number;               // forward-looking lifetime value
  riskAdjustedValue: number;
  ytd: number;
  lastYear: number;
  growth: number;            // % vs comparable period
  carats: number;
  stones: number;
  transactions: number;
  firstPurchase: string;
  lastPurchase: string;
  daysSince: number;
  cycleDays: [number, number];   // typical reorder window
  cycleType: "Regular" | "Irregular" | "Seasonal" | "High frequency";
  avgTxn: number;
  owner: string;
  broker: string | null;
  terms: string;
  paymentScore: number;
  avgDiscount: number;
  priceSensitivity: "Low" | "Medium" | "High";
  walletShare: number;           // estimated %
  estimatedCapacity: number;
  preferences: { shape: string; carat: string; colour: string; clarity: string; lab: string };
  crossSell: string[];
  action: string;
  /** Set while a note has paused this customer's alerts: the last day of the pause (YYYY-MM-DD). */
  pausedUntil?: string | null;
};

export type PriorityKind =
  | "Due now" | "Past their usual time" | "Lapsed" | "At risk"
  | "Reorder due" | "May stop buying" | "Recovery" | "Upsell" | "Cross-sell"
  | "VIP attention" | "Pricing" | "Stock match" | "New buyer" | "Target gap";

export type Priority = {
  id: string;
  rank: number;
  kind: PriorityKind;
  customer: string;
  customerId: string;
  flag: string;
  owner: string;
  value: number;          // estimated opportunity value
  probability: number;    // %
  why: string;
  action: string;
  bestDay: string;
  channel: string;
  tone: "negative" | "warn" | "positive" | "info" | "violet" | "accent";
};
