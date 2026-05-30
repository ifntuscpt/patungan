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
  let participants = rawParticipants.map(participant => {
    // For each item, if it is claimed by N participants, each participant pays (item.price * item.quantity / N).
    let subtotalClaimed = 0;
    
    items.forEach(item => {
      if (item.claimedBy.includes(participant.id)) {
        const shareCount = item.claimedBy.length;
        if (shareCount > 0) {
          subtotalClaimed += (item.price * item.quantity) / shareCount;
        }
      }
    });

    return {
      ...participant,
      subtotalClaimed,
      subtotal: 0,
      taxPortion: 0,
      servicePortion: 0,
      total: 0,
      hasRoundingBurden: false
    };
  });

  const totalClaimedSum = participants.reduce((sum, p) => sum + p.subtotalClaimed, 0);
  const unclaimedCost = subtotalItems - totalClaimedSum;

  // 3. Compute proportional final subtotals, tax, and service charge shares
  let calculatedSum = 0;
  participants = participants.map(p => {
    let subFloat = 0;
    if (totalClaimedSum > 0) {
      subFloat = p.subtotalClaimed + (p.subtotalClaimed / totalClaimedSum) * unclaimedCost;
    } else {
      subFloat = subtotalItems / participants.length;
    }

    const taxPortion = (subFloat / subtotalItems) * taxAmount;
    const servicePortion = (subFloat / subtotalItems) * serviceCharge;
    const finalTotalWithFees = subFloat + taxPortion + servicePortion;
    const totalRounded = Math.round(finalTotalWithFees);
    
    calculatedSum += totalRounded;

    return {
      ...p,
      subtotal: Math.round(subFloat),
      taxPortion: Math.round(taxPortion),
      servicePortion: Math.round(servicePortion),
      total: totalRounded
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

/**
 * Ensures that the copied / shared URL is always a public-accessible "ais-pre-" URL
 * instead of the private host "ais-dev-" URL.
 */
export function getPublicShareUrl(sessionId: string): string {
  const origin = window.location.origin;
  if (origin.includes("ais-dev-")) {
    return `${origin.replace("ais-dev-", "ais-pre-")}/s/${sessionId}`;
  }
  return `${origin}/s/${sessionId}`;
}

