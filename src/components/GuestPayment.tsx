import React, { useState, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { Session, Participant } from "../types";
import { formatIDR } from "../utils/calculations";
import { Upload, FileText, Landmark, Copy, ClipboardCheck, ArrowRight, ArrowLeft } from "lucide-react";

interface GuestPaymentProps {
  session: Session;
  participantId: string;
  onPaymentSubmitted: () => void;
  onBackToSummary: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function GuestPayment({
  session,
  participantId,
  onPaymentSubmitted,
  onBackToSummary,
  onError,
  onSuccess,
}: GuestPaymentProps) {
  const [copiedNominal, setCopiedNominal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [proofBase64, setProofBase64] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentParticipant = session.participants.find((p) => p.id === participantId);

  if (!currentParticipant) {
    return (
      <div className="p-8 text-center text-xs text-[#E53935] font-bold">
        Memulai ulang sesi gagal. Data Anda tidak ditemukan.
      </div>
    );
  }

  const finalAmountToPay = currentParticipant.total;

  const handleCopyNominal = async () => {
    try {
      await navigator.clipboard.writeText(finalAmountToPay.toString());
      setCopiedNominal(true);
      onSuccess("Nominal persis berhasil disalin ke papan klip.");
      setTimeout(() => setCopiedNominal(false), 3000);
    } catch (err) {
      onError("Gagal menyalin nominal.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      onError("Ukuran gambar melebihi batas maksimal 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProofBase64(reader.result as string);
      onSuccess("Bukti transfer berhasil dipilih. Tinjau foto di bawah.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!proofBase64) {
      onError("Pilih atau ambil foto screenshot bukti transfer Anda terlebih dahulu.");
      return;
    }

    setUploading(true);
    try {
      let finalUrl = "";

      // 1. Try uploading to Firebase Storage under path: proofs/{sessionId}/{participantId}/{timestamp}
      try {
        const timestamp = Date.now();
        const storagePath = `proofs/${session.id}/${participantId}/${timestamp}`;
        const storageRef = ref(storage, storagePath);

        // Upload the selected screenshot
        const uploadResult = await uploadString(storageRef, proofBase64, "data_url");
        finalUrl = await getDownloadURL(uploadResult.ref);
      } catch (storageError) {
        console.warn("Storage upload failed or rate-limited. Falling back to inline base64...", storageError);
        // Reserving fallback for Spark free nodes: saving standard base64 inline directly in doc
        finalUrl = proofBase64;
      }

      // 2. Transcribe status in Firestore doc
      const docRef = doc(db, "sessions", session.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const freshData = docSnap.data() as Session;
        
        const updatedParticipants = freshData.participants.map((person) => {
          if (person.id === participantId) {
            return {
              ...person,
              paymentStatus: "pending_verification" as const,
              proofImageUrl: finalUrl,
            };
          }
          return person;
        });

        // Update participant in document
        await updateDoc(docRef, {
          participants: updatedParticipants,
        });

        onSuccess("Bukti transfer Anda berhasil diunggah. Menunggu persetujuan Host.");
        onPaymentSubmitted();
      }
    } catch (err: any) {
      console.error("Payment proof upload submission failure:", err);
      onError("Gagal mengirimkan bukti transfer Anda. Silakan coba kembali.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 px-4 pb-12 animate-fade-in">
      
      {/* Title & Final exact cost */}
      <div className="bg-[#00C853]/5 border border-[#00C853]/15 rounded-3xl p-6 text-center flex flex-col gap-1.5 shadow-xs">
        <span className="text-[10px] text-[#757575] uppercase tracking-wider font-extrabold">Final Nominal Transfer</span>
        <h3 className="text-3xl font-extrabold text-[#00C853] tracking-tight">{formatIDR(finalAmountToPay)}</h3>
        
        {/* Copy nominal clicker */}
        <button
          onClick={handleCopyNominal}
          id="btn-copy-nominal"
          className={`mx-auto mt-2.5 px-4 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs
            ${copiedNominal ? "bg-[#00C853] text-white border-transparent" : "bg-white text-[#757575] border-[#E0E0E0] hover:bg-slate-50"}`}
        >
          {copiedNominal ? <ClipboardCheck size={13} /> : <Copy size={13} />}
          <span>{copiedNominal ? "Tersalin!" : "Coppy Nominal Pas"}</span>
        </button>
      </div>

      {/* Host coordinates coords */}
      <div className="bg-white rounded-3xl p-6 border border-[#E0E0E0] shadow-sm flex flex-col gap-4">
        <h3 className="font-extrabold text-[#212121] text-sm flex items-center gap-2 border-b border-[#F5F5F5] pb-2">
          <Landmark size={18} className="text-[#00C853]" />
          <span>Informasi Transfer Tujuan</span>
        </h3>

        {((session.paymentInfo.bankName && session.paymentInfo.bankName.trim() !== "") || 
          (session.paymentInfo.accountNumber && session.paymentInfo.accountNumber.trim() !== "")) ? (
          <div className="flex flex-col gap-2 bg-[#F5F5F5] p-4 rounded-2xl border border-[#E0E0E0] text-xs font-semibold text-[#757575]">
            {session.paymentInfo.bankName && (
              <div className="flex justify-between items-center">
                <span>Bank / Dompet:</span>
                <span className="text-[#212121] font-bold">{session.paymentInfo.bankName}</span>
              </div>
            )}
            {session.paymentInfo.accountNumber && (
              <div className="flex justify-between items-center mt-1">
                <span>No. Rekening:</span>
                <span className="text-[#212121] font-extrabold text-sm">{session.paymentInfo.accountNumber}</span>
              </div>
            )}
            {session.paymentInfo.accountName && (
              <div className="flex justify-between items-center mt-1">
                <span>Atas Nama:</span>
                <span className="text-[#212121] font-bold">{session.paymentInfo.accountName}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#E8F5E9] text-green-800 border border-transparent p-4 rounded-2xl text-xs font-semibold text-center leading-relaxed">
            Metode pembayaran cashless QRIS tersemat. Silakan scan atau simpan barcode di bawah ini untuk membayar.
          </div>
        )}

        {/* Optional QRIS static drawing */}
        {session.paymentInfo.qrisImageUrl && (
          <div className="flex flex-col items-center gap-2 border-t border-[#F5F5F5] pt-4 mt-1">
            <p className="text-[10px] text-[#757575] uppercase tracking-wider font-extrabold">Scan QRIS Host</p>
            <div className="w-52 h-52 p-2 bg-white rounded-2xl border border-[#E0E0E0] flex items-center justify-center overflow-hidden">
              <img
                src={session.paymentInfo.qrisImageUrl}
                alt="QRIS Host Code"
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-[9px] text-[#757575] text-center italic mt-1 font-medium">
              Arahkan kamera e-wallet / mobile banking Anda ke kode QRIS di atas.
            </p>
          </div>
        )}
      </div>

      {/* Proof screenshot capture */}
      <div className="bg-white rounded-3xl p-6 border border-[#E0E0E0] shadow-sm flex flex-col gap-4">
        <h3 className="font-extrabold text-[#212121] text-sm">Konfirmasi Pembayaran Anda</h3>
        <p className="text-xs text-[#757575] leading-normal">
          Silakan unggah tangkapan layar (screenshot) bukti transfer sukses sebagai referensi Host untuk memverifikasi lunas.
        </p>

        {/* Input layout */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#E0E0E0] hover:border-[#00C853] rounded-2xl p-6 flex flex-col items-center justify-center gap-2 bg-slate-50 transition-all cursor-pointer"
          >
            <Upload size={22} className="text-[#757575]" />
            <span className="text-xs font-bold text-[#212121]">Unggah Bukti Transfer</span>
            <span className="text-[9px] text-[#757575] font-medium">Format JPG/PNG, ukuran maks 5MB</span>
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Screenshot live preview inside viewport */}
          {proofBase64 && (
            <div className="border border-[#E0E0E0]/60 p-1.5 bg-[#1a1a1a] rounded-2xl text-center flex items-center justify-center max-h-[220px] overflow-hidden">
              <img
                src={proofBase64}
                alt="Upload preview"
                className="max-h-full max-w-full object-contain rounded-xl"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBackToSummary}
          disabled={uploading}
          className="flex-1 border border-[#E0E0E0] hover:bg-slate-50 text-xs font-extrabold py-3.5 rounded-xl text-center transition-colors cursor-pointer text-[#757575] flex items-center justify-center gap-1 bg-white"
        >
          <ArrowLeft size={14} />
          <span>Kembali</span>
        </button>

        <button
          onClick={handleSubmitProof}
          disabled={uploading || !proofBase64}
          id="btn-upload-proof-payment"
          className="flex-1 bg-[#00C853] hover:bg-[#009624] text-white text-xs font-extrabold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <span>Kirim Bukti Bayar</span>
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>

    </div>
  );
}
