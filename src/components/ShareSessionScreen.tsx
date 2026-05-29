import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { Session } from "../types";
import { formatIDR } from "../utils/calculations";
import { Copy, Share2, ClipboardCheck, ArrowRight, Sparkles } from "lucide-react";

interface ShareSessionScreenProps {
  sessionId: string;
  onContinueToMonitor: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ShareSessionScreen({
  sessionId,
  onContinueToMonitor,
  onSuccess,
  onError,
}: ShareSessionScreenProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "sessions", sessionId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSession({ ...snapshot.data(), id: snapshot.id } as Session);
        } else {
          onError("Sesi patungan tidak ditemukan.");
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load session details for sharing:", err);
        onError("Gagal menyinkronkan detail sesi.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId, onError]);

  // Develop guest link matching guest view route: /s/:sessionId
  const shareUrl = `${window.location.origin}/s/${sessionId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      onSuccess("Tautan sesi berhasil disalin ke papan klip!");
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error(err);
      onError("Gagal menyalin tautan secara otomatis.");
    }
  };

  const handleNativeShare = async () => {
    if (!session) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Patungan - ${session.name}`,
          text: `Halo teman-teman! Yuk patungan biaya untuk "${session.name}" senilai ${formatIDR(
            session.grandTotal
          )}. Silakan klaim item patungan Anda pada tautan berikut:`,
          url: shareUrl,
        });
        onSuccess("Sesi berhasil dibagikan!");
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Native share failed:", err);
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col justify-center items-center py-20 px-4">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-neutral-500 mt-3 tracking-wide">Me-load detail sesi...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="w-full max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-xs font-bold text-red-500">Sesi tidak ditemukan atau telah dihapus.</p>
        <button
          onClick={onContinueToMonitor}
          className="btn-primary-gradient text-white px-5 py-2.5 rounded-full font-extrabold text-xs shadow-green"
        >
          Masuk ke Dashboard Monitor
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-center items-center px-4 py-8 animate-fade-in font-sans">
      <div className="w-full bg-neutral-0 rounded-3xl p-8 border border-neutral-200 shadow-2 flex flex-col items-center text-center gap-6">
        
        {/* Animated Celebration Icon */}
        <div className="w-18 h-18 bg-green-50 text-green-600 rounded-full flex items-center justify-center animate-pulse relative border border-green-200/50">
          <Sparkles className="text-green-600" size={28} />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-neutral-900 tracking-tight">Tautan Siap Dibagikan!</h2>
          <p className="text-xs text-neutral-500 leading-relaxed font-semibold max-w-xs">
            "Foto struk, share link, beres." Tautan untuk sesi patungan Anda telah diterbitkan dengan aman.
          </p>
        </div>

        {/* Info detail banner */}
        <div className="w-full bg-neutral-50 rounded-2xl p-4.5 border border-neutral-200/50 text-left flex flex-col gap-1.5">
          <p className="text-[10px] text-neutral-450 uppercase tracking-wider font-extrabold">Informasi Sesi</p>
          <p className="text-sm font-extrabold text-neutral-950 truncate leading-none py-0.5">{session.name}</p>
          <div className="flex justify-between items-center mt-1 font-semibold text-xs">
            <span className="text-neutral-500">Total Tagihan Struk:</span>
            <span className="font-extrabold text-green-600 font-mono">{formatIDR(session.grandTotal)}</span>
          </div>
        </div>

        {/* Link interactive display */}
        <div className="w-full flex items-center bg-neutral-50 border border-neutral-200 rounded-xl pl-3 pr-2 py-2">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="bg-transparent text-xs text-neutral-800 outline-none flex-1 truncate font-mono select-all font-bold pr-2"
          />
          <button
            onClick={handleCopyLink}
            id="btn-copy-link"
            className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0 border
              ${copied ? "bg-green-500 text-white border-green-500" : "bg-neutral-0 hover:bg-neutral-50 text-neutral-500 border-neutral-200 shadow-sm"}`}
            title="Salin Tautan"
          >
            {copied ? <ClipboardCheck size={14} className="stroke-[2.5]" /> : <Copy size={14} className="stroke-[2.5]" />}
          </button>
        </div>

        {/* Dynamic Scan QR Code Area */}
        <div className="w-full bg-neutral-50 rounded-2xl p-5 border border-neutral-200/50 flex flex-col items-center gap-3">
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-extrabold">Scan QR Code Sesi</p>
          <div className="p-2.5 border border-neutral-200 bg-neutral-0 rounded-xl shadow-sm transition-transform hover:scale-[1.02]">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`}
              alt="Scan QR Code Patungan"
              className="w-36 h-36"
              referrerPolicy="no-referrer"
            />
          </div>
          <p className="text-[10px] text-neutral-550 font-semibold leading-relaxed max-w-[220px]">
            Tunjukkan layar ponsel Anda agar teman patungan tinggal scan kode di atas untuk langsung klaim!
          </p>
        </div>

        {/* Native and direct shares */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={handleNativeShare}
            id="btn-share-native"
            className="w-full btn-primary-gradient text-white py-3.5 px-4 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-green active:scale-95 cursor-pointer"
          >
            <Share2 size={15} className="stroke-[2.5]" />
            <span>Bagikan Sesi Kasir</span>
          </button>

          <button
            onClick={onContinueToMonitor}
            id="btn-continue-to-monitor"
            className="w-full bg-neutral-0 hover:bg-neutral-50 text-neutral-700 border border-neutral-200 py-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-1"
          >
            <span>Masuk Dashboard Monitor</span>
            <ArrowRight size={14} className="stroke-[2.5]" />
          </button>
        </div>

      </div>
    </div>
  );
}
