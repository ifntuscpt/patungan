export type SessionStatus = "setup" | "claiming" | "payment" | "settled";
export type PaymentStatus = "unclaimed" | "claimed" | "pending_verification" | "verified";

export interface ReceiptItem {
  id: string; // UUID/String
  name: string;
  price: number; // integer price per unit in Rupiah
  quantity: number;
  claimedBy: string[]; // array of participant IDs who claimed this item
}

export interface Participant {
  id: string; // UUID/String
  name: string;
  claimedItems: string[]; // item IDs claimed
  subtotal: number;
  taxPortion: number;
  servicePortion: number;
  total: number; // subtotal + taxPortion + servicePortion + roundingAmount
  hasRoundingBurden: boolean;
  paymentStatus: PaymentStatus;
  proofImageUrl: string | null;
}

export interface PaymentInfo {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl: string | null;
}

export interface Session {
  id: string;
  hostId: string;
  hostEmail: string;
  name: string;
  createdAt: any; // Firestore Timestamp
  status: SessionStatus;
  items: ReceiptItem[];
  participants: Participant[];
  taxAmount: number;
  serviceCharge: number;
  subtotalItems: number;
  grandTotal: number;
  roundingAmount: number;
  luckyDrawWinnerId: string | null;
  paymentInfo: PaymentInfo;
}
