import { Session, Participant } from "../types";

/**
 * Strips formatting to show currency in the Indonesian Rupiah style: "Rp 1.500.000"
 */
export function formatIDR(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${formatted}`;
}

/**
 * Calculates intermediate subtotal and portions for each participant based on claimed items.
 * Handles proportional tax, service charge, and returns rounding discrepancies.
 */
export function calculateSessionFinance(session: Partial<Session>): {
  subtotalItems: number;
  participants: Participant[];
  roundingAmount: number;
} {
  const items = session.items || [];
  const rawParticipants = session.participants || [];
  const taxAmount = session.taxAmount || 0;
  const serviceCharge = session.serviceCharge || 0;
  const grandTotal = session.grandTotal || 0;

  // 1. Calculate the subtotal of all items in the receipt (price * quantity)
  const subtotalItems = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // If subtotal is zero, return early to prevent division by zero
  if (subtotalItems === 0) {
    return {
      subtotalItems: 0,
      participants: rawParticipants.map(v => ({
        ...v,
        subtotal: 0,
        taxPortion: 0,
        servicePortion: 0,
        total: 0,
        hasRoundingBurden: false
      })),
      roundingAmount: 0
    };
  }

  // 2. Compute normal subtotal per participant based on their claimed items
  let participants: Participant[] = rawParticipants.map(participant => {
    // For each item code claimed by this participant, we find the share of price.
    // If an item is claimed by multiple people, we split the cost of that unit split equally!
    // Wait, the specification says:
    // price = price per unit
    // claimedItems = item IDs this participant claimed
    // Let's implement the standard share cost model:
    // For each item, if it is claimed by N participants, each participant pays (item.price * item.quantity / N).
    let subtotal = 0;
    
    items.forEach(item => {
      if (item.claimedBy.includes(participant.id)) {
        const shareCount = item.claimedBy.length;
        if (shareCount > 0) {
          subtotal += (item.price * item.quantity) / shareCount;
        }
      }
    });

    return {
      ...participant,
      subtotal: Math.round(subtotal),
      taxPortion: 0,
      servicePortion: 0,
      total: 0,
      hasRoundingBurden: false
    };
  });

  // 3. Compute proportional tax and service charge shares
  let calculatedSum = 0;
  participants = participants.map(p => {
    const taxPortion = (p.subtotal / subtotalItems) * taxAmount;
    const servicePortion = (p.subtotal / subtotalItems) * serviceCharge;
    const itemAndFees = p.subtotal + taxPortion + servicePortion;
    const total = Math.round(itemAndFees);
    calculatedSum += total;

    return {
      ...p,
      taxPortion: Math.round(taxPortion),
      servicePortion: Math.round(servicePortion),
      total: total
    };
  });

  // 4. Determine rounding amount (grandTotal - sum of all participant totals)
  const roundingAmount = grandTotal - calculatedSum;

  // Let's adjust for lucky winner if selected already
  if (session.luckyDrawWinnerId) {
    participants = participants.map(p => {
      const isWinner = p.id === session.luckyDrawWinnerId;
      return {
        ...p,
        hasRoundingBurden: isWinner,
        total: isWinner ? p.total + roundingAmount : p.total
      };
    });
  }

  return {
    subtotalItems,
    participants,
    roundingAmount
  };
}
