import { formatIDR } from "../utils/calculations";
import { CheckCircle2, ChevronRight, Landmark, HelpCircle, ArrowRight } from "lucide-react";

interface GuestDoneProps {
  sessionName: string;
  participantName: string;
  totalPaid: number;
  onRefreshStatus: () => void;
  onBackToClaim: () => void;
}

export function GuestDone({
  sessionName,
  participantName,
  totalPaid,
  onRefreshStatus,
  onBackToClaim,
}: GuestDoneProps) {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-center items-center px-4 py-8 animate-fade-in">
      <div className="w-full bg-white rounded-3xl p-8 border border-[#E0E0E0] shadow-sm flex flex-col items-center text-center gap-6">
        
        {/* Verification Checkmark Banner */}
        <div className="w-16 h-16 bg-[#00C853]/10 text-[#00C853] rounded-full flex items-center justify-center animate-bounce">
          <CheckCircle2 size={38} className="stroke-[2.5]" />
        </div>

        <div>
          <h2 className="text-2xl font-extrabold text-[#212121]">Bukti Berhasil Dikirim!</h2>
          <p className="text-xs text-[#757575] max-w-xs mt-1.5 leading-relaxed">
            Terima kasih, <span className="font-bold text-[#00C853]">{participantName}</span>. Bukti transfer Anda berhasil diunggah langsung ke platform Patungan Host.
          </p>
        </div>

        {/* Amount diagnostic box */}
        <div className="w-full bg-[#F5F5F5] rounded-2xl p-4.5 border border-[#E0E0E0] text-left flex flex-col gap-1 text-xs">
          <div className="flex justify-between font-semibold">
            <span className="text-[#757575]">Sesi Acara:</span>
            <span className="text-[#212121] truncate max-w-[140px] font-bold">{sessionName}</span>
          </div>
          <div className="flex justify-between font-semibold mt-1">
            <span className="text-[#757575]">Nominal Terkirim:</span>
            <span className="text-sm font-extrabold text-[#00C853]">{formatIDR(totalPaid)}</span>
          </div>
        </div>

        {/* Status notification info */}
        <div className="bg-[#E3F2FD] border border-blue-100 rounded-2xl p-4 flex items-start gap-2.5 text-left text-blue-800">
          <span className="text-lg leading-none mt-0.5">⌛</span>
          <div>
            <p className="text-[11px] font-bold">Menunggu Konfirmasi Host</p>
            <p className="text-[10px] text-blue-700 leading-relaxed mt-1">
              Host akan menyetop sesi setelah mencocokkan mutasi rekening bank miliknya. Anda dapat mengecek status lunas Anda di bawah.
            </p>
          </div>
        </div>

        {/* Check again panel */}
        <div className="w-full flex flex-col gap-2.5 mt-2">
          <button
            onClick={onRefreshStatus}
            id="btn-re-sync-payment"
            className="w-full bg-[#00C853] hover:bg-[#009624] text-white py-3.5 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer text-sm"
          >
            <span>Periksa Status Sesi</span>
          </button>

          <button
            onClick={onBackToClaim}
            id="btn-back-to-claim-re-adjust"
            className="w-full bg-white hover:bg-slate-50 text-[#757575] border border-[#E0E0E0] py-3 rounded-xl font-bold text-xs"
          >
            Edit Klaim Menu / Menu Kurang
          </button>
        </div>

      </div>
    </div>
  );
}
