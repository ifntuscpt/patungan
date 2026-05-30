import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Session, Participant } from "../types";
import { formatIDR } from "../utils/calculations";
import { Trophy, Dices, ArrowRight, Sparkles, Coins } from "lucide-react";

interface LuckyDrawSpinnerProps {
  session: Session;
  participantId: string;
  onFinished: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

// Convert polar angle coordinates to Cartesian for SVG drawing
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

// Generate SVG coordinate arc commands
const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return [
    "M", x, y,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ");
};

// Exquisite premium palette for slices
const getPresetColor = (idx: number) => {
  const colors = [
    "#00C853", // Vibrant Emerald
    "#006227", // Rich Forest Green
    "#00E676", // Bright Mint
    "#2E7D32", // Deep Clover
    "#004D40", // Luxurious Teal
    "#1B5E20", // Platinum Emerald
    "#E8F5E9", // Pastel Sage
  ];
  return colors[idx % colors.length];
};

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

  const candidateParticipants = session.participants;

  useEffect(() => {
    if (session.luckyDrawWinnerId) {
      const existingWinner = session.participants.find((p) => p.id === session.luckyDrawWinnerId);
      if (existingWinner) {
        setWinner(existingWinner);
        triggerSpinAnimation(existingWinner);
      }
    } else {
      selectAndSaveWinner();
    }
  }, [session.luckyDrawWinnerId]);

  const selectAndSaveWinner = async () => {
    if (spinning) return;
    
    const randomIndex = Math.floor(Math.random() * candidateParticipants.length);
    const chosenWinner = candidateParticipants[randomIndex];
    
    try {
      const docRef = doc(db, "sessions", session.id);
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

    const winnerIndex = candidateParticipants.findIndex((p) => p.id === targetWinner.id);
    const sliceAngle = 360 / candidateParticipants.length;
    
    // Position pointer perfectly to target slice center
    const targetOffset = 360 - (winnerIndex * sliceAngle) - (sliceAngle / 2);
    // Dynamic spin multiplier for excitement
    const finalRot = 2160 + targetOffset; 

    setRotationDegrees(finalRot);

    setTimeout(() => {
      setSpinning(false);
      setShowResult(true);
      onSuccess(`Koin pembulatan selesai diundi! Terpilih: ${targetWinner.name}`);
    }, 3000);
  };

  // Determine actual slice thickness for UI mapping
  const sliceAngle = 360 / Math.max(candidateParticipants.length, 1);

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-6 px-4 py-8 animate-fade-in">
      <div className="w-full bg-white rounded-3xl p-6 border border-[#E0E0E0] shadow-sm flex flex-col items-center text-center gap-6">
        
        {/* Header containing details of what is being raffled */}
        <div>
          <span className="text-[10px] bg-[#00C853]/10 text-[#00C853] px-3 py-1.5 rounded-xl font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5 select-none border border-[#00C853]/25">
            <Coins size={12} className="stroke-[2.5]" />
            <span>Undian Pembulatan ({formatIDR(session.roundingAmount)})</span>
          </span>
          <h2 className="text-xl font-extrabold text-[#212121] mt-2.5">Siapa Penanggung Pecahan?</h2>
          <p className="text-[11px] text-[#757575] max-w-xs mt-1 leading-relaxed">
            Tenang, sisa pangan tak ter-klaim sudah dibagi adil. Koin ini hanya menentukan siapa yang menanggung sisa pecahan fraksi sebesar <span className="font-extrabold text-[#00C853]">{formatIDR(session.roundingAmount)}</span>.
          </p>
        </div>

        {/* GOLD/EMERALD PREMIUM TURNTABLE SPINNER */}
        <div className="relative w-64 h-64 flex items-center justify-center my-3">
          
          {/* External Glowing Aura when spinning */}
          {spinning && (
            <div className="absolute inset-[-8px] rounded-full bg-gradient-to-tr from-[#00C853]/20 to-[#FFD54F]/20 blur-xl animate-pulse z-0" />
          )}

          {/* Spinner physical Pin Pointer (Top Indicator) */}
          <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            {/* Triangular Pointer */}
            <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-[#FFC107] drop-shadow-md" />
            {/* Ruby glowing dot in pointer */}
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 absolute top-1 shadow-inner animate-ping" />
          </div>
          
          {/* Wheel Frame outline container with casino bead lights around border */}
          <div className="absolute inset-0 rounded-full border-[6px] border-[#212121] bg-white overflow-hidden shadow-lg z-0">
            {/* Flashing Gold Bead Lights Rim */}
            <div className="absolute inset-0 bg-[#212121] opacity-5 rounded-full" />
            <div className="absolute inset-1.5 border border-[#FFD54F]/30 rounded-full" />
          </div>

          {/* SVG-based robust turntable wheel segments */}
          <div
            className="w-[234px] h-[234px] rounded-full relative z-10 overflow-hidden shadow-inner"
            style={{
              transform: `rotate(${rotationDegrees}deg)`,
              transition: spinning ? "transform 3.0s cubic-bezier(0.1, 0.8, 0.2, 1)" : "none",
            }}
          >
            <svg 
              viewBox="0 0 200 200" 
              className="w-full h-full"
            >
              <defs>
                <linearGradient id="gold-center-emblem" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFF8E1" />
                  <stop offset="50%" stopColor="#FFC107" />
                  <stop offset="100%" stopColor="#FF8F00" />
                </linearGradient>
              </defs>

              {candidateParticipants.length === 1 ? (
                // Single participant takes whole wheel
                <circle cx="100" cy="100" r="95" fill="#00C853" stroke="#ffffff" strokeWidth="2" />
              ) : (
                // Multiple segments
                candidateParticipants.map((p, idx) => {
                  const startAngle = idx * sliceAngle;
                  const endAngle = (idx + 1) * sliceAngle;
                  const d = describeArc(100, 100, 95, startAngle, endAngle);
                  
                  // Text rotation maths
                  const middleAngle = startAngle + sliceAngle / 2;
                  const color = getPresetColor(idx);
                  
                  return (
                    <g key={p.id}>
                      {/* Colorful wedge path */}
                      <path 
                        d={d} 
                        fill={color} 
                        stroke="#ffffff" 
                        strokeWidth="1.5"
                      />
                      
                      {/* Participant name written elegantly tangential to radius */}
                      <g transform={`translate(100, 100) rotate(${middleAngle})`}>
                        <text
                          x="0"
                          y="-62"
                          textAnchor="middle"
                          className="fill-white font-extrabold text-[8px] tracking-tight uppercase"
                          style={{
                            textShadow: "1px 1px 2px rgba(0,0,0,0.4)"
                          }}
                        >
                          {p.name.length > 8 ? p.name.substring(0, 7) + ".." : p.name}
                        </text>
                      </g>
                    </g>
                  );
                })
              )}
            </svg>
          </div>

          {/* Luxurious shimmering golden central center plate */}
          <div className="absolute w-12 h-12 rounded-full border-4 border-[#212121] bg-gradient-to-tr from-[#FFD54F] via-[#FFC107] to-[#FF8F00] z-20 flex items-center justify-center shadow-lg transform active:scale-95 duration-100 cursor-pointer">
            <Coins size={16} className="text-neutral-900 animate-pulse stroke-[2.5]" />
          </div>

          {/* Aesthetic Ring of casino flashing dots */}
          <div className="absolute inset-4 rounded-full border border-white/20 pointer-events-none z-10" />
        </div>

        {/* Spin action results card */}
        {showResult && winner && (
          <div className="w-full bg-[#E8F5E9] border border-[#C8E6C9] p-4 rounded-2xl flex flex-col gap-2 items-center animate-bounce mt-1.5">
            <Trophy size={26} className="text-[#00C853]" />
            <div>
              <p className="text-xs font-bold text-[#2E7D32]">Hasil Undian Pembulatan:</p>
              <p className="text-sm font-extrabold text-[#1B5E20] mt-0.5">{winner.name}</p>
              <p className="text-[11px] text-[#2E7D32] mt-1 leading-snug">
                Terima kasih atas kebaikan Anda! Anda disepakati untuk menanggung sisa pecahan senilai <span className="font-extrabold text-[#1B5E20]">{formatIDR(session.roundingAmount)}</span> ke tagihan Anda.
              </p>
            </div>
          </div>
        )}

        {/* Next step callback */}
        <button
          onClick={onFinished}
          disabled={spinning}
          id="btn-spin-payment-continue"
          className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
        >
          <span>{spinning ? "Koin Sedang Berputar..." : "Lanjut ke Pembayaran"}</span>
          <ArrowRight size={16} />
        </button>

      </div>
    </div>
  );
}
