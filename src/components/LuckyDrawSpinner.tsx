import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Session, Participant } from "../types";
import { formatIDR } from "../utils/calculations";
import { Sparkles, Trophy, Shuffle, ArrowRight, Dices } from "lucide-react";

interface LuckyDrawSpinnerProps {
  session: Session;
  participantId: string;
  onFinished: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function LuckyDrawSpinner({
  session,
  participantId,
  onFinished,
  onError,
  onSuccess,
}: LuckyDrawSpinnerProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [winner, setWinner] = useState<Participant | null>(null);
  const [showResult, setShowResult] = useState(false);

  // Eligible participants for the lucky draw
  const candidateParticipants = session.participants;

  useEffect(() => {
    // If winner is already selected by someone else in Firestore
    if (session.luckyDrawWinnerId) {
      const existingWinner = session.participants.find((p) => p.id === session.luckyDrawWinnerId);
      if (existingWinner) {
        setWinner(existingWinner);
        // Start auto-animation matching other users' results
        triggerSpinAnimation(existingWinner);
      }
    } else {
      // If no winner set yet, this client will elect the winner!
      selectAndSaveWinner();
    }
  }, [session.luckyDrawWinnerId]);

  const selectAndSaveWinner = async () => {
    if (spinning) return;
    
    // Choose a random participant ID
    const randomIndex = Math.floor(Math.random() * candidateParticipants.length);
    const chosenWinner = candidateParticipants[randomIndex];
    
    try {
      const docRef = doc(db, "sessions", session.id);
      
      // Update in Firestore immediately so other clients match this exact winner
      await updateDoc(docRef, {
        luckyDrawWinnerId: chosenWinner.id
      });

      setWinner(chosenWinner);
      triggerSpinAnimation(chosenWinner);
    } catch (err: any) {
      console.error("Select winner failure:", err);
      onError("Gagal memulai koin keberuntungan. Silakan muat kembali halaman.");
    }
  };

  const triggerSpinAnimation = (targetWinner: Participant) => {
    setSpinning(true);
    setShowResult(false);

    // Calculate rotation: Spin at least 5 full circles (1800 deg) plus slice offset
    const winnerIndex = candidateParticipants.findIndex((p) => p.id === targetWinner.id);
    const sliceAngle = 360 / candidateParticipants.length;
    
    // Position pointer to center of target slice.
    // Pointer is usually at top (90 deg or 0 deg), let's target 0 degrees as top
    const targetOffset = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2);
    const finalRot = 1800 + targetOffset;

    setRotationDegrees(finalRot);

    // Stop spin after 3 seconds
    setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
      onSuccess(`Lucky Draw selesai! Terpilih: ${targetWinner.name}`);
    }, 3000);
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-6 px-4 py-8 animate-fade-in">
      <div className="w-full bg-white rounded-3xl p-6 border border-[#E0E0E0] shadow-sm flex flex-col items-center text-center gap-6">
        
        {/* Header */}
        <div>
          <span className="text-[10px] bg-[#FF6D00]/10 text-[#FF6D00] px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 select-none border border-[#FF6D00]/25">
            <Dices size={12} className="stroke-[2.5]" />
            <span>Undian Pembulatan</span>
          </span>
          <h2 className="text-xl font-extrabold text-[#212121] mt-2.5">Siapa Yang Beruntung?</h2>
          <p className="text-[11px] text-[#757575] max-w-xs mt-1">
            Uang sisa pembulatan kasir senilai <span className="font-bold text-[#FF6D00]">{formatIDR(session.roundingAmount)}</span> sedang diundi!
          </p>
        </div>

        {/* CSS TURNTABLE SPINNER WHEEL */}
        <div className="relative w-64 h-64 flex items-center justify-center my-4">
          
          {/* Spinner Pin Pointer */}
          <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-[#FF6D00] z-20 drop-shadow-md"></div>
          
          {/* Wheel Frame outline container */}
          <div className="absolute inset-0 rounded-full border-4 border-[#212121] bg-[#F5F5F5] overflow-hidden shadow-md z-0"></div>

          {/* Wheel Internal Canvas Slices (Pure CSS) */}
          <div
            className="w-full h-full rounded-full relative z-10 overflow-hidden"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              transition: spinning ? "transform 3s cubic-bezier(0.15, 0.85, 0.35, 1)" : "none",
            }}
          >
            {candidateParticipants.map((p, idx) => {
              const count = candidateParticipants.length;
              const angleVal = 360 / count;
              const rotateDeg = idx * angleVal;
              let sliceColor = idx % 2 === 0 ? "#00C853" : "#009624";
              if (idx === count - 1 && idx % 2 === 0) {
                // Prevent final slice mixing conflict patterns
                sliceColor = "#FF6D00";
              }

              return (
                <div
                  key={p.id}
                  className="absolute top-0 right-0 w-32 h-32 origin-bottom-left"
                  style={{
                    backgroundColor: sliceColor,
                    transform: `rotate(${rotateDeg}deg) skewY(${90 - angleVal}deg)`,
                    bottom: "50%",
                    left: "50%"
                  }}
                >
                  {/* Name Label position */}
                  <div
                    className="absolute font-extrabold text-[10px] text-white tracking-tight select-none w-24 text-right pr-4"
                    style={{
                      transform: `skewY(-${90 - angleVal}deg) rotate(${angleAnglePos(angleVal)}deg) translate(28px, -4px)`,
                    }}
                  >
                    {p.name.substring(0, 7)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Spinner center core peg */}
          <div className="absolute w-10 h-10 rounded-full bg-white border-4 border-[#212121] z-10 flex items-center justify-center shadow-lg font-bold text-xs">
            🎰
          </div>
        </div>

        {/* Spin action or Result panel */}
        {showResult && winner && (
          <div className="w-full bg-[#FFF3E0] border border-[#FFE0B2] p-4 rounded-2xl flex flex-col gap-2 items-center animate-bounce mt-1">
            <Trophy size={28} className="text-[#FF6D00]" />
            <div>
              <p className="text-xs font-bold text-[#E65100]">Selamat, Kamu Beruntung!</p>
              <p className="text-sm font-extrabold text-[#212121] mt-0.5">{winner.name}</p>
              <p className="text-[11px] text-[#EF6C00] mt-1.5 leading-snug">
                Berdasarkan kesepakatan putar koin, Anda ditunjuk untuk menambahkan nominal sisa pembulatan kasir senilai <span className="font-extrabold">{formatIDR(session.roundingAmount)}</span> ke tagihan Anda.
              </p>
            </div>
          </div>
        )}

        {/* Next call */}
        <button
          onClick={onFinished}
          disabled={spinning}
          id="btn-spin-payment-continue"
          className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 rounded-xl font-bold text-s flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer disabled:opacity-50"
        >
          <span>{spinning ? "Koin Sedang Berputar..." : "Lanjut ke Transfer"}</span>
          <ArrowRight size={16} />
        </button>

      </div>
    </div>
  );
}

// Math generator helper for slices formatting inside lucky spinner
function angleAnglePos(sliceAngle: number): number {
  return sliceAngle / 2;
}
