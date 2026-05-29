import { useState } from "react";
import { doc, runTransaction } from "firebase/firestore";
import { db } from "../firebase";
import { Session, ReceiptItem, Participant } from "../types";
import { formatIDR } from "../utils/calculations";
import { Check, AlertTriangle, ArrowRight, HelpCircle, Utensils, X, Users } from "lucide-react";

interface GuestItemClaimProps {
  session: Session;
  participantId: string;
  onClaimCompleted: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function GuestItemClaim({
  session,
  participantId,
  onClaimCompleted,
  onError,
  onSuccess,
}: GuestItemClaimProps) {
  const currentParticipant = session.participants.find((p) => p.id === participantId);
  const participantName = currentParticipant?.name || "Guest";

  // Local selection of item IDs
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>(() => {
    // Pre-populate if they already claimed items previously
    return session.items
      .filter((item) => item.claimedBy.includes(participantId))
      .map((item) => item.id);
  });

  // Modal alert state for split claim conflicts
  const [conflictModalItem, setConflictModalItem] = useState<ReceiptItem | null>(null);

  const handleToggleItem = (item: ReceiptItem) => {
    const isSelected = selectedItemIds.includes(item.id);

    if (isSelected) {
      // Unclaim directly
      setSelectedItemIds(selectedItemIds.filter((id) => id !== item.id));
    } else {
      // If someone else already claimed it, show confirmation modal
      const otherClaimants = item.claimedBy.filter((cid) => cid !== participantId);
      if (otherClaimants.length > 0) {
        setConflictModalItem(item);
      } else {
        setSelectedItemIds([...selectedItemIds, item.id]);
      }
    }
  };

  const confirmConflictClaim = () => {
    if (conflictModalItem) {
      setSelectedItemIds([...selectedItemIds, conflictModalItem.id]);
      setConflictModalItem(null);
      onSuccess(`Item "${conflictModalItem.name}" berhasil diklaim bersama.`);
    }
  };

  // Sticky footer calculation
  const runningSubtotal = session.items
    .filter((item) => selectedItemIds.includes(item.id))
    .reduce((sum, item) => {
      // Divide by the number of claimants + 1 (if she joins)
      const currentClaimants = item.claimedBy.filter((cid) => cid !== participantId).length;
      const isClaimedLocallyNow = selectedItemIds.includes(item.id);
      const totalClaimants = currentClaimants + (isClaimedLocallyNow ? 0 : 1); // math estimate
      
      const shareCount = totalClaimants > 0 ? totalClaimants : 1;
      return sum + (item.price * item.quantity) / shareCount;
    }, 0);

  const handleSubmitClaims = async () => {
    setConflictModalItem(null);
    try {
      const docRef = doc(db, "sessions", session.id);

      await runTransaction(db, async (transaction) => {
        const freshDoc = await transaction.get(docRef);
        if (!freshDoc.exists()) {
          throw new Error("Sesi tidak ditemukan di database.");
        }

        const freshData = freshDoc.data() as Session;
        
        // 1. Update claimedBy array for all items
        const updatedItems = freshData.items.map((item) => {
          const isSelected = selectedItemIds.includes(item.id);
          let claimedBy = [...item.claimedBy];

          if (isSelected && !claimedBy.includes(participantId)) {
            claimedBy.push(participantId);
          } else if (!isSelected && claimedBy.includes(participantId)) {
            claimedBy = claimedBy.filter((id) => id !== participantId);
          }

          return { ...item, claimedBy };
        });

        // 2. Compute participants values
        // For each participant, recalculate their subtotal based on updated claimedBy shares
        const subtotalItems = updatedItems.reduce((acc, el) => acc + (el.price * el.quantity), 0);

        const updatedParticipants = freshData.participants.map((person) => {
          let subtotal = 0;
          const claimedItems: string[] = [];

          updatedItems.forEach((item) => {
            if (item.claimedBy.includes(person.id)) {
              claimedItems.push(item.id);
              const shareCount = item.claimedBy.length;
              if (shareCount > 0) {
                subtotal += (item.price * item.quantity) / shareCount;
              }
            }
          });

          const sub = Math.round(subtotal);
          const taxPortion = Math.round((sub / (subtotalItems || 1)) * freshData.taxAmount);
          const servicePortion = Math.round((sub / (subtotalItems || 1)) * freshData.serviceCharge);
          const total = sub + taxPortion + servicePortion;

          // Set status to claimed if items exists
          const paymentStatus = person.id === participantId 
            ? (claimedItems.length > 0 ? "claimed" as const : "unclaimed" as const)
            : person.paymentStatus;

          return {
            ...person,
            claimedItems,
            subtotal: sub,
            taxPortion,
            servicePortion,
            total,
            paymentStatus
          };
        });

        // Write atomic updates
        transaction.update(docRef, {
          items: updatedItems,
          participants: updatedParticipants
        });
      });

      onSuccess("Pilihan item patungan Anda berhasil tersimpan!");
      onClaimCompleted();
    } catch (err: any) {
      console.error("Atomic transaction split failure:", err);
      onError("Terjadi kesalahan koneksi atau perubahan simultan oleh rekan lain. Silakan coba mengklaim ulang.");
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-5 px-4 pb-28 animate-fade-in">
      {/* Mobile Greetings */}
      <div>
        <h2 className="text-xl font-extrabold text-[#212121]">Halo, {participantName}!</h2>
        <p className="text-xs text-[#757575] mt-1">Pilih barang, jasa, atau item yang kamu pesan dari struk di bawah.</p>
      </div>

      {/* Grid view of Items */}
      <div className="flex flex-col gap-3">
        {session.items.map((item) => {
          const isSelected = selectedItemIds.includes(item.id);
          const otherClaimants = item.claimedBy.filter((cid) => cid !== participantId);
          const isClaimedByOthers = otherClaimants.length > 0;

          // Name resolution for claimants
          const claimantsNames = otherClaimants
            .map((cid) => session.participants.find((p) => p.id === cid)?.name || "Rekan")
            .join(", ");

          // Styling definitions
          let itemCardStyle = "bg-white border-[#E0E0E0] shadow-xs";
          if (isSelected) {
            itemCardStyle = "bg-[#00C853]/5 border-[#00C853] shadow-md";
          } else if (isClaimedByOthers) {
            itemCardStyle = "bg-[#FFF3E0] border-[#FF6D00] shadow-xs";
          }

          return (
            <div
              key={item.id}
              onClick={() => handleToggleItem(item)}
              className={`p-4 rounded-2xl border-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98] select-none flex justify-between items-center gap-4 ${itemCardStyle}`}
            >
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[#212121] truncate">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-[#757575] font-semibold">
                    {formatIDR(item.price)} x {item.quantity}
                  </span>
                  {isClaimedByOthers && (
                    <span className="text-[10px] text-[#FF6D00] font-extrabold bg-[#FFF3E0] px-1.5 py-0.5 rounded border border-[#FF6D00]/10 shrink-0">
                      Diklaim {claimantsNames}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Emblem toggler */}
              <div className="shrink-0">
                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-[#00C853] flex items-center justify-center text-white shadow-sm">
                    <Check size={14} className="stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-[#E0E0E0] bg-white group-hover:border-[#00C853] transition-colors"></div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Summary Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-[#E0E0E0] p-4.5 z-40 shadow-lg pb-6 rounded-t-3xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="text-[10px] text-[#757575] uppercase tracking-wider font-extrabold block">Estimasi Subtotal Anda</span>
            <span className="text-xs text-[#757575] italic leading-tight">*Belum termasuk pajak & service</span>
          </div>
          <span className="text-xl font-extrabold text-[#00C853]">{formatIDR(runningSubtotal)}</span>
        </div>
        <button
          onClick={handleSubmitClaims}
          id="btn-finished-claiming"
          className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 rounded-xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
        >
          <span>Selesai Klaim Item</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Confirmation modal for items already claimed by others */}
      {conflictModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xs bg-white rounded-3xl p-6.5 text-center flex flex-col gap-5 shadow-2xl">
            <div className="w-12 h-12 bg-[#FFF3E0] text-[#FF6D00] rounded-full flex items-center justify-center mx-auto shadow-sm">
              <Users size={20} className="stroke-[2.5]" />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <h4 className="font-extrabold text-[#212121] text-base">Klaim Bersama?</h4>
              <p className="text-xs text-[#757575] leading-relaxed">
                Rekan lain sudah mengklaim <span className="font-bold text-[#FF6D00]">"{conflictModalItem.name}"</span>. 
                Apakah Anda ikut menggunakan/mengklaim item ini? Tagihan akan dibagi rata di antara para pengklaim.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConflictModalItem(null)}
                className="flex-1 border border-[#E0E0E0] hover:bg-slate-50 text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer text-[#757575]"
              >
                Batal
              </button>
              <button
                onClick={confirmConflictClaim}
                className="flex-1 bg-[#FF6D00] hover:bg-[#E65100] text-white text-xs font-bold py-2.5 rounded-xl transition-colors cursor-pointer shadow-md"
              >
                Tetap Klaim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
