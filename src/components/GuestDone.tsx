import { formatIDR } from "../utils/calculations";
import { CheckCircle2, Clock, ShieldCheck, Sparkles, PlusCircle, ArrowRight, ChevronRight } from "lucide-react";

interface GuestDoneProps {
  sessionName: string;
  participantName: string;
  totalPaid: number;
  paymentStatus: string;
  onRefreshStatus: () => void;
  onBackToClaim: () => void;
  onStartOwnSession: () => void;
}

export function GuestDone({
  sessionName,
  participantName,
  totalPaid,
  paymentStatus,
  onRefreshStatus,
  onBackToClaim,
  onStartOwnSession,
}: GuestDoneProps) {
  const isVerified = paymentStatus === "verified";

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-center items-center px-4 py-8 animate-fade-in font-sans">
      <div className="w-full bg-white rounded-3xl p-8 border border-[#E0E0E0] shadow-sm flex flex-col items-center text-center gap-6">
        
        {/* Verification Checkmark Banner */}
        {isVerified ? (
          <div className="w-16 h-16 bg-[#00C853]/10 text-[#00C853] rounded-full flex items-center justify-center animate-pulse">
            <ShieldCheck size={38} className="stroke-[2.5]" />
          </div>
        ) : (
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center animate-pulse">
            <Clock size={38} className="stroke-[2.5]" />
          </div>
        )}

        <div>
          <h2 className="text-2xl font-extrabold text-[#212121]">
            {isVerified ? "Pembayaran Terverifikasi!" : "Bukti Berhasil Dikirim!"}
          </h2>
          <p className="text-xs text-[#757575] max-w-xs mt-1.5 leading-relaxed font-semibold">
            {isVerified ? (
              <span>
                Terima kasih, <span className="font-extrabold text-[#00C853]">{participantName}</span>. Pembayaran Anda telah dikonfirmasi dan diverifikasi langsung oleh Host. Sesi Anda selesai!
              </span>
            ) : (
              <span>
                Terima kasih, <span className="font-extrabold text-[#00C853]">{participantName}</span>. Bukti transfer Anda berhasil diunggah langsung ke platform Patungan Host.
              </span>
            )}
          </p>
        </div>

        {/* Amount diagnostic box */}
        <div className="w-full bg-[#F5F5F5] rounded-2xl p-4.5 border border-[#E0E0E0] text-left flex flex-col gap-1 text-xs">
          <div className="flex justify-between font-semibold">
            <span className="text-[#757575]">Sesi Acara:</span>
            <span className="text-[#212121] truncate max-w-[140px] font-extrabold">{sessionName}</span>
          </div>
          <div className="flex justify-between font-semibold mt-1">
            <span className="text-[#757575]">Nominal Terkirim:</span>
            <span className="text-sm font-extrabold text-[#00C853]">{formatIDR(totalPaid)}</span>
          </div>
        </div>

        {/* Status notification info */}
        {isVerified ? (
          <div className="bg-green-50 border border-[#00C853]/20 rounded-2xl p-4 flex items-start gap-2.5 text-left text-green-800 w-full animate-fade-in">
            <CheckCircle2 size={18} className="shrink-0 text-[#00C853] stroke-[2.5] mt-0.5" />
            <div>
              <p className="text-[11px] font-extrabold text-[#009624]">Status: Diverifikasi &amp; Lunas</p>
              <p className="text-[10px] text-green-700 leading-relaxed mt-1 font-semibold">
                Sesi patungan ini selesai untuk Anda. Anda sudah membayar sepenuhnya dan aman untuk menutup halaman ini.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#E3F2FD] border border-blue-100 rounded-2xl p-4 flex items-start gap-2.5 text-left text-blue-800 w-full">
            <Clock size={18} className="shrink-0 text-blue-500 stroke-[2.5] mt-0.5" />
            <div>
              <p className="text-[11px] font-extrabold text-blue-900">Menunggu Konfirmasi Host</p>
              <p className="text-[10px] text-blue-700 leading-relaxed mt-1 font-semibold">
                Host akan menyetop sesi setelah mencocokkan mutasi rekening bank miliknya. Anda dapat mengecek status lunas Anda di bawah.
              </p>
            </div>
          </div>
        )}

        {/* Check again panel */}
        <div className="w-full flex flex-col gap-2.5 mt-2">
          {!isVerified && (
            <button
              onClick={onRefreshStatus}
              id="btn-re-sync-payment"
              className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer text-sm"
            >
              <span>Periksa Status Sesi</span>
            </button>
          )}

          {!isVerified && (
            <button
              onClick={onBackToClaim}
              id="btn-back-to-claim-re-adjust"
              className="w-full bg-white hover:bg-slate-50 text-[#757575] border border-[#E0E0E0] py-3 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-95"
            >
              Edit Klaim Menu / Menu Kurang
            </button>
          )}
        </div>

        {/* Referral / CTA to become Host section to boost new user acquisition */}
        <div className="w-full bg-linear-to-br from-green-50 to-emerald-50/40 border border-green-200/60 rounded-2.5xl p-5 mt-4 text-left flex flex-col gap-3 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-4 opacity-5 text-green-900 pointer-events-none">
            <Sparkles size={80} />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-green-100 p-1.5 rounded-lg text-green-700">
              <Sparkles size={14} className="stroke-[2.5]" />
            </div>
            <span className="text-[9px] bg-green-500 text-white font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider">
              Baru &amp; Gratis
            </span>
          </div>
          
          <div>
            <h4 className="text-xs font-extrabold text-neutral-900 leading-tight">Mau Split Bill Lebih Praktis?</h4>
            <p className="text-[10px] text-neutral-500 leading-relaxed mt-1 font-semibold">
              Sering pusing hitung struk makanan manual? Gunakan <span className="font-extrabold text-green-600">Patungan</span> untuk foto struk, bagi otomatis, dan urus kasir bareng teman secara instan!
            </p>
          </div>

          <button
            onClick={onStartOwnSession}
            id="btn-cta-start-own-session"
            className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3 px-4 rounded-xl font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <span>Buat Sesi Patungan Saya Sendiri</span>
            <ArrowRight size={13} className="stroke-[2.5]" />
          </button>
        </div>

      </div>
    </div>
  );
}
