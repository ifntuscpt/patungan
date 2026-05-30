import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Session, Participant } from "../types";
import { formatIDR } from "../utils/calculations";
import { Receipt, AlertTriangle, ArrowRight, Sparkles, AlertCircle, CheckCircle, Shield } from "lucide-react";

interface GuestSummaryProps {
  session: Session;
  participantId: string;
  onNavigateToLuckyDraw: () => void;
  onNavigateToPayment: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onHostAutoVerified: () => void;
}

export function GuestSummary({
  session,
  participantId,
  onNavigateToLuckyDraw,
  onNavigateToPayment,
  onSuccess,
  onError,
  onHostAutoVerified,
}: GuestSummaryProps) {
  const [loading, setLoading] = useState(false);
  const currentParticipant = session.participants.find((p) => p.id === participantId);

  if (!currentParticipant) {
    return (
      <div className="p-8 text-center text-xs text-[#E53935] font-bold">
        Memulai ulang sesi gagal. Data Anda tidak ditemukan.
      </div>
    );
  }

  const isHost = participantId.startsWith("host_");

  // Find claimed items for breakdown
  const claimedItems = session.items.filter((item) => item.claimedBy.includes(participantId));

  // Determine if Lucky Draw is required
  // Rounding is needed if session.roundingAmount !== 0
  const isLuckyDrawRequired = session.roundingAmount !== 0;
  const isWinnerDeclared = session.luckyDrawWinnerId !== null;

  // Find winner name if declared
  const winnerName = isWinnerDeclared
    ? session.participants.find((p) => p.id === session.luckyDrawWinnerId)?.name || "Rekan"
    : "";

  const handleNextClick = () => {
    if (isLuckyDrawRequired && !isWinnerDeclared) {
      onNavigateToLuckyDraw();
    } else {
      onNavigateToPayment();
    }
  };

  const handleHostAutoVerify = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "sessions", session.id);
      
      const updatedParticipants = session.participants.map((person) => {
        if (person.id === participantId) {
          return {
            ...person,
            paymentStatus: "verified" as const, // Direct lunas/verified for the host paying
          };
        }
        return person;
      });

      await updateDoc(docRef, {
        participants: updatedParticipants,
      });

      onSuccess("Klaim Host telah diverifikasi sebagai Lunas.");
      onHostAutoVerified();
    } catch (err: any) {
      console.error("Host auto verification error:", err);
      onError("Gagal memverifikasi klaim Host otomatis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 px-4 pb-12 animate-fade-in">
      {/* Receipts Breakdown Display */}
      <div className="bg-white rounded-3xl p-6.5 border border-[#E0E0E0] shadow-sm flex flex-col gap-5">
        <div className="text-center pb-4 border-b border-[#F5F5F5] flex flex-col items-center gap-1.5">
          <div className="w-11 h-11 rounded-full bg-[#00C853]/15 text-[#00C853] flex items-center justify-center font-bold">
            <Receipt size={20} />
          </div>
          <h2 className="text-xl font-extrabold text-[#212121] mt-1.5">Rincian Tagihan Anda</h2>
          <p className="text-xs text-[#757575] font-semibold">
            {currentParticipant.name} {isHost && <span className="text-[9px] bg-[#00C853]/10 text-[#00C853] px-1.5 py-0.5 rounded font-extrabold uppercase ml-1">Host</span>}
          </p>
        </div>

        {/* Breakdown Items details */}
        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase font-bold tracking-wider text-[#757575]">Item yang diklaim</p>
          
          {claimedItems.length === 0 ? (
            <p className="text-xs text-center text-[#757575] italic my-3">
              Anda belum memilih pesanan item apapun.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {claimedItems.map((item) => {
                const totalUnitsCount = item.claimedBy.length;
                const splitPrice = item.price * item.quantity / totalUnitsCount;

                return (
                  <div key={item.id} className="flex justify-between items-start text-xs border-b border-[#F5F5F5] pb-2">
                    <div className="min-w-0 pr-2">
                      <p className="font-extrabold text-[#212121] truncate">{item.name}</p>
                      <p className="text-[10px] text-[#757575] font-semibold">
                        {formatIDR(item.price)} x {item.quantity} (Dibagi {totalUnitsCount} org)
                      </p>
                    </div>
                    <span className="font-extrabold text-[#212121] shrink-0 text-right">
                      {formatIDR(splitPrice)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Proportional Tax & Services breakdown */}
        <div className="bg-[#F5F5F5] rounded-2xl p-4 border border-[#E0E0E0] flex flex-col gap-2 text-xs">
          <div className="flex justify-between text-[#757575] font-semibold">
            <span>Subtotal Item</span>
            <span className="text-[#212121] font-bold">{formatIDR(currentParticipant.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#757575] font-semibold">
            <span>Porsi Pajak Proporsional</span>
            <span className="text-[#212121] font-bold">{formatIDR(currentParticipant.taxPortion)}</span>
          </div>
          <div className="flex justify-between text-[#757575] font-semibold">
            <span>Porsi Service Charge</span>
            <span className="text-[#212121] font-bold">{formatIDR(currentParticipant.servicePortion)}</span>
          </div>

          {/* Conditional rounding display */}
          {isWinnerDeclared && currentParticipant.hasRoundingBurden && (
            <div className="flex justify-between text-[#E65100] font-extrabold bg-[#FFF3E0] p-1.5 rounded border border-[#FFE0B2] animate-pulse mt-1">
              <span>🎰 Beban Pembulatan Struk</span>
              <span>+{formatIDR(session.roundingAmount)}</span>
            </div>
          )}

          <hr className="border-t border-[#E0E0E0] my-1" />

          <div className="flex justify-between items-center">
            <span className="font-bold text-[#212121] text-sm">Total Tagihan</span>
            <span className="font-extrabold text-[#00C853] text-lg">
              {formatIDR(currentParticipant.total)}
            </span>
          </div>
        </div>

        {/* Info Box detailing the Lucky Draw requirement */}
        {isLuckyDrawRequired && (
          <div className="bg-[#FFF3E0] border border-[#FFE0B2] rounded-2xl p-4 flex items-start gap-2.5 shadow-xs">
            <span className="text-xl shrink-0 mt-0.5">🎲</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-[#E65100]">Lucky Draw Pembulatan</p>
              {isWinnerDeclared ? (
                <p className="text-[11px] text-[#EF6C00] mt-1 leading-relaxed">
                  Pemenang Lucky Draw telah diundi! <span className="font-extrabold">{winnerName}</span> yang terpilih menanggung nominal sisa pembulatan kasir senilai <span className="font-bold">{formatIDR(session.roundingAmount)}</span>.
                </p>
              ) : (
                <p className="text-[11px] text-[#EF6C00] mt-1 leading-relaxed">
                  Ada sisa pembulatan kasir senilai <span className="font-bold">{formatIDR(session.roundingAmount)}</span>. Yuk mainkan Lucky Draw bergulir untuk menentukan 1 rekan beruntung yang menanggung selisih tersebut!
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Host Option vs Regular Option */}
      {isHost ? (
        <div className="flex flex-col gap-3 mt-2">
          {/* Option A: Direct verification for host who paid the merchant directly */}
          <button
            onClick={handleHostAutoVerify}
            disabled={loading}
            className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle size={16} />
              <span>Konfirmasi Selesai (Langsung Lunas)</span>
            </div>
            <span className="text-[9px] text-[#E8F5E9] font-medium leading-none">Pilih ini jika Anda adalah pembayar utama bill ke merchant/kasir.</span>
          </button>

          {/* Option B: Regular flow if someone else paid the merchant and Host needs to make regular transfer */}
          <button
            onClick={handleNextClick}
            disabled={loading}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Shield size={13} />
            <span>Transfer ke Orang Lain? Lanjut Pembayaran</span>
          </button>
        </div>
      ) : (
        /* Regular Guest button */
        <button
          onClick={handleNextClick}
          id="btn-summary-continue"
          className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer mt-2"
        >
          <span>
            {isLuckyDrawRequired && !isWinnerDeclared
              ? "Mulai Diundi Lucky Draw"
              : "Lanjut ke Pembayaran"}
          </span>
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}

