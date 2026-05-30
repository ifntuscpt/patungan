import { useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { db, OperationType, handleFirestoreError } from "../firebase";
import { Session, Participant, ReceiptItem } from "../types";
import { formatIDR, calculateSessionFinance, getPublicShareUrl } from "../utils/calculations";
import { ClipboardCheck, Copy, ArrowLeft, RefreshCw, Eye, CheckCircle, Circle, AlertCircle, X, ShieldAlert, Check, Landmark, MessageCircle, QrCode, Share2, Dices } from "lucide-react";

interface MonitorDashboardProps {
  sessionId: string;
  onBackToBeranda: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function MonitorDashboard({ sessionId, onBackToBeranda, onError, onSuccess }: MonitorDashboardProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Modal for proof view
  const [viewProofUrl, setViewProofUrl] = useState<string | null>(null);
  const [viewProofParticipantName, setViewProofParticipantName] = useState<string>("");
  const [viewProofParticipantId, setViewProofParticipantId] = useState<string>("");
  const [copiedWA, setCopiedWA] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  
  // Host Claim/Assignment view states
  const [showHostClaimModal, setShowHostClaimModal] = useState(false);
  const [editingItems, setEditingItems] = useState<ReceiptItem[]>([]);
  const [loadingSaveClaims, setLoadingSaveClaims] = useState(false);

  useEffect(() => {
    const docRef = doc(db, "sessions", sessionId);
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const rawData = snapshot.data();
          
          // Recompute values via the calculation engine
          const { subtotalItems, participants, roundingAmount } = calculateSessionFinance(rawData);
          
          const merged: Session = {
            ...rawData,
            id: snapshot.id,
            subtotalItems,
            participants,
            roundingAmount
          } as Session;

          setSession(merged);
        } else {
          onError("Sesi patungan tidak ditemukan atau telah dihapus.");
          onBackToBeranda();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Dashboard monitor failure:", error);
        try {
          handleFirestoreError(error, OperationType.GET, `sessions/${sessionId}`);
        } catch (e) {
          onError("Koneksi bermasalah saat memantau data sesi.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId, onError, onBackToBeranda]);

  // Actions
  const handleVerifyParticipant = async (participantId: string) => {
    if (!session) return;

    try {
      const updatedParticipants = session.participants.map((p) => {
        if (p.id === participantId) {
          return { ...p, paymentStatus: "verified" as const };
        }
        return p;
      });

      const docRef = doc(db, "sessions", sessionId);
      await updateDoc(docRef, {
        participants: updatedParticipants
      });
      onSuccess("Pembayaran rekan berhasil diverifikasi dan diselesaikan.");
    } catch (err: any) {
      console.error(err);
      onError("Gagal melakukan verifikasi pembayaran.");
    }
  };

  const handleCloseSession = async () => {
    if (!session) return;

    // Check if the host can actually settle the session (everyone verified)
    const allVerified = session.participants.every(p => p.paymentStatus === "verified" || p.total === 0);
    if (!allVerified) {
      const confirmClose = window.confirm("Perhatian! Masih ada rekan yang belum melunasi atau memverifikasi pembayaran. Tetap tutup sesi ini?");
      if (!confirmClose) return;
    }

    try {
      const docRef = doc(db, "sessions", sessionId);
      await updateDoc(docRef, {
        status: "settled" as const
      });
      onSuccess("Sesi Patungan resmi ditutup. Semua tagihan terekam dengan aman.");
    } catch (err: any) {
      console.error(err);
      onError("Gagal menyematkan status Selesai untuk sesi ini.");
    }
  };

  const handleCopyShareLink = async () => {
    if (!hostHasClaimed) {
      const confirmProceed = window.confirm("Peringatan Urgent! Anda belum memilih item pribadi Anda (Host). Jika link disebar sekarang, tamu Anda beresiko salah mengklaim pesanan pribadi Anda. Apakah Anda tetap ingin menyalin link?");
      if (!confirmProceed) {
        openHostClaimModal();
        return;
      }
    }
    const link = getPublicShareUrl(sessionId);
    try {
      await navigator.clipboard.writeText(link);
      onSuccess("Tautan tamu berhasil disalin ke papan klip.");
    } catch (err) {
      onError("Gagal menyalin tautan.");
    }
  };

  const openHostClaimModal = () => {
    if (!session) return;
    setEditingItems(JSON.parse(JSON.stringify(session.items)));
    setShowHostClaimModal(true);
  };

  const handleToggleParticipantInClaim = (itemId: string, pId: string) => {
    setEditingItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === itemId) {
          const isSelected = item.claimedBy.includes(pId);
          const updatedClaimedBy = isSelected
            ? item.claimedBy.filter((id) => id !== pId)
            : [...item.claimedBy, pId];
          return { ...item, claimedBy: updatedClaimedBy };
        }
        return item;
      })
    );
  };

  const handleSaveHostClaims = async () => {
    if (!session) return;
    setLoadingSaveClaims(true);
    try {
      const updatedParticipants = session.participants.map((person) => {
        const claimedItems: string[] = [];
        editingItems.forEach((item) => {
          if (item.claimedBy.includes(person.id)) {
            claimedItems.push(item.id);
          }
        });

        // Set status based on claims
        let paymentStatus = person.paymentStatus;
        if (claimedItems.length > 0 && paymentStatus === "unclaimed") {
          paymentStatus = "claimed" as const;
        } else if (claimedItems.length === 0) {
          paymentStatus = "unclaimed" as const;
        }

        return {
          ...person,
          claimedItems,
          paymentStatus
        };
      });

      const docRef = doc(db, "sessions", sessionId);
      await updateDoc(docRef, {
        items: editingItems,
        participants: updatedParticipants
      });

      onSuccess("Pembagian item berhasil diperbarui!");
      setShowHostClaimModal(false);
    } catch (err: any) {
      console.error("Failed to save host claims:", err);
      onError("Gagal menyimpan pembagian item.");
    } finally {
      setLoadingSaveClaims(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg mx-auto flex flex-col justify-center items-center py-20 px-4">
        <div className="w-10 h-10 border-3 border-[#00C853] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-[#757575] mt-3 tracking-wide">Me-load Sesi Monitor Real-time...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 text-center text-xs text-[#E53935] font-bold">
        Memulai ulang sesi gagal. Sesi tidak ditemukan.
      </div>
    );
  }

  // Analytics
  const totalStruk = session.grandTotal;
  const verifiedGatheredTotal = session.participants
    .filter((p) => p.paymentStatus === "verified")
    .reduce((sum, p) => sum + p.total, 0);

  const hostParticipant = session.participants.find((p) => p.id.startsWith("host_"));
  const hostHasClaimed = hostParticipant ? (hostParticipant.paymentStatus !== "unclaimed") : true;

  // Unclaimed items analyzer
  const unclaimedItems = session.items.filter((item) => item.claimedBy.length === 0);
  const unclaimedItemsCount = unclaimedItems.length;
  const unclaimedItemsValue = unclaimedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Status badges formatter
  const getParticipantBadge = (status: Participant["paymentStatus"], total: number) => {
    if (total === 0) {
      return (
        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
          Free / Belom Klaim
        </span>
      );
    }
    switch (status) {
      case "unclaimed":
        return (
          <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
            Belum Memilih
          </span>
        );
      case "claimed":
        return (
          <span className="text-[10px] bg-blue-50 text-[#1565C0] border border-blue-100 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">
            Sudah Klaim
          </span>
        );
      case "pending_verification":
        return (
          <span className="text-[10px] bg-[#FFF3E0] text-[#EF6C00] border border-[#FFE0B2] px-2 py-0.5 rounded-full font-bold uppercase animate-bounce">
            Menunggu Verifikasi
          </span>
        );
      case "verified":
        return (
          <span className="text-[10px] bg-[#E8F5E9] text-[#2E7D32] px-2 py-0.5 rounded-full font-bold uppercase">
            Lunas
          </span>
        );
      default:
        return null;
    }
  };

  const generateWhatsAppSummary = () => {
    if (!session) return "";
    const sessionUrl = getPublicShareUrl(sessionId);
    
    let text = `*Patungan: ${session.name}*\n`;
    text += `🔗 *Link Sesi:* ${sessionUrl}\n\n`;
    text += `*Total Tagihan Struk:* ${formatIDR(session.grandTotal)}\n`;
    text += `*Terkumpul:* ${formatIDR(verifiedGatheredTotal)}\n\n`;
    
    text += `*RINCIAN GAJI/BILL REKAN PATUNGAN:*\n`;
    text += `---------------------------------------\n`;
    
    session.participants.forEach((p, idx) => {
      let statusStr = "";
      if (p.total === 0) {
        statusStr = "Belum Klaim";
      } else {
        switch (p.paymentStatus) {
          case "verified":
            statusStr = "LUNAS";
            break;
          case "pending_verification":
            statusStr = "MENUNGGU VERIFIKASI";
            break;
          case "claimed":
            statusStr = "BELUM BAYAR";
            break;
          case "unclaimed":
            statusStr = "BELUM KLAIM";
            break;
        }
      }
      
      text += `${idx + 1}. *${p.name}*: ${formatIDR(p.total)} (${statusStr})\n`;
      // List of claimed items
      const claimedItemsArr = session.items.filter(item => p.claimedItems.includes(item.id));
      if (claimedItemsArr.length > 0) {
        claimedItemsArr.forEach((item) => {
          const splitPrice = (item.price * item.quantity) / item.claimedBy.length;
          text += `   - ${item.name} (${formatIDR(splitPrice)})\n`;
        });
      }
      if (p.hasRoundingBurden && session.roundingAmount !== 0) {
        text += `   - Rounding Lucky Draw (${formatIDR(session.roundingAmount)})\n`;
      }
    });
    
    if (unclaimedItemsCount > 0) {
      text += `\n---------------------------------------\n`;
      text += `*BELUM DIKLAIM (Sisa Item):*\n`;
      unclaimedItems.forEach((item) => {
        text += `- ${item.name} (x${item.quantity}): ${formatIDR(item.price * item.quantity)}\n`;
      });
    }
    
    text += `\nSelesaikan klaim item dan kirim pembayaran ke Host:\n`;
    if (session.paymentInfo.bankName && session.paymentInfo.accountNumber) {
      text += `${session.paymentInfo.bankName} - ${session.paymentInfo.accountNumber} A/N ${session.paymentInfo.accountName || "Host"}\n`;
    }
    if (session.paymentInfo.qrisImageUrl) {
      text += `Scan barcode QRIS Host di dalam Aplikasi!\n`;
    }
    text += `\nTerima kasih banyak ya!`;
    
    return text;
  };

  const handleCopyWASummary = async () => {
    const summaryText = generateWhatsAppSummary();
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopiedWA(true);
      onSuccess("Rincian tagihan WhatsApp disalin ke clipboard!");
      setTimeout(() => setCopiedWA(false), 3000);
    } catch (err) {
      onError("Gagal menyalin rincian.");
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 px-4 pb-12 animate-fade-in">
      
      {/* Navigation Top Header */}
      <header className="flex justify-between items-center py-4 border-b border-neutral-200">
        <button
          onClick={onBackToBeranda}
          className="flex items-center gap-1.5 text-xs font-extrabold text-[#757575] hover:text-[#212121] transition-all cursor-pointer select-none active:scale-95 bg-neutral-100 hover:bg-neutral-200/60 px-3 py-2 rounded-xl border border-neutral-200/50 shadow-sm"
        >
          <ArrowLeft size={14} className="stroke-[2.5]" />
          <span>Kembali</span>
        </button>

        <div className="text-right">
          <h1 className="text-sm font-extrabold text-neutral-900 leading-none">Patungan</h1>
          <p className="text-[9px] text-[#757575] font-semibold mt-0.5">Foto struk, share link, beres.</p>
        </div>
      </header>

      {/* MOST URGENT: Host has not claimed alert card */}
      {!hostHasClaimed && (
        <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-5 flex flex-col gap-2.5 shadow-md shadow-red-500/5 font-sans animate-fade-in">
          <div className="flex items-center gap-2 text-red-650">
            <ShieldAlert size={20} className="stroke-[2.5]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider">PERNYATAAN URGENT: Klaim Host Belum Diisi</h3>
          </div>
          <p className="text-[11px] text-red-700 leading-relaxed font-semibold">
            Anda belum mengklaim pesanan pribadi Anda! Sebelum membagikan barcode QR atau menyalin link ini untuk teman Anda, <span className="font-extrabold underline text-red-800">Anda wajib memilih apa saja yang Anda pesan</span> terlebih dahulu agar sisa tagihan tidak otomatis dibebankan ke tamu dan membuat bill mereka kemahalan.
          </p>
          <button
            onClick={openHostClaimModal}
            className="mt-1 self-start bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10.5px] px-4 py-2.5 rounded-xl border border-transparent shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <span>Klaim Milik Pribadi Saya Sekarang</span>
            <span>→</span>
          </button>
        </div>
      )}

      {/* Main Title and Stats */}
      <div className="bg-neutral-0 rounded-3xl p-5.5 border border-neutral-200 shadow-2 flex flex-col gap-4.5 font-sans">
            <div>
              <div className="flex justify-between items-start gap-3">
                <h2 className="text-base font-extrabold text-neutral-900 leading-snug flex-1 truncate tracking-tight">{session.name}</h2>
                {session.status === "settled" && (
                  <span className="text-[8px] bg-green-500 text-white px-2 py-0.5 rounded-md font-extrabold uppercase shrink-0 tracking-wider">
                    Lunas
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-450 font-bold mt-1.5 tracking-wide uppercase">
                Tanggal Sesi: {session.createdAt?.toDate ? session.createdAt.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "Baru saja"}
              </p>
            </div>

            <div className="border-t border-neutral-100 pt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] text-neutral-400 uppercase font-extrabold tracking-wider">Total Kasir Struk</p>
                <p className="text-base font-extrabold text-green-600 font-mono mt-0.5 leading-none">{formatIDR(totalStruk)}</p>
              </div>
              <div className="border-l border-neutral-100 pl-4">
                <p className="text-[9px] text-neutral-400 uppercase font-extrabold tracking-wider">Terkumpul (Verified)</p>
                <p className="text-base font-extrabold text-neutral-900 font-mono mt-0.5 leading-none">{formatIDR(verifiedGatheredTotal)}</p>
              </div>
            </div>

            {/* Progress Bar of Gathered Amount */}
            <div className="space-y-1.5">
              <div className="w-full bg-neutral-100 border border-neutral-200/50 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (verifiedGatheredTotal / (totalStruk || 1)) * 100)}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-right text-neutral-500 font-semibold leading-none">
                Progres Lunas: {Math.round((verifiedGatheredTotal / (totalStruk || 1)) * 100)}%
              </p>
            </div>
          </div>

          {/* Quick Actions Grid for Monitor Sesi (Highly responsive & adaptive) */}
          <div className="flex flex-col gap-2 font-sans">
            <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider px-1">
              Kontrol & Aksi Sesi
            </p>
            {/* Kept grid-cols-2 to prevent narrow button scaling bugs on desktops */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* Action 1: Scan QR */}
              <button
                onClick={() => {
                  if (!hostHasClaimed) {
                    const confirmProceed = window.confirm("Peringatan Urgent! Anda belum memilih item pribadi Anda (Host). Sebelum membagikan barcode QR, harap klaim item pribadi Anda terlebih dahulu agar tamu tidak salah pilih pesanan Anda. Klaim pesanan Anda sekarang?");
                    if (!confirmProceed) {
                      openHostClaimModal();
                      return;
                    }
                  }
                  setShowQRModal(true);
                }}
                className="flex items-center gap-3 p-3 bg-neutral-0 hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left shadow-sm shadow-neutral-100/50"
              >
                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-700 shrink-0 group-hover:scale-105 transition-transform border border-neutral-200/60 shadow-sm">
                  <QrCode size={16} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-neutral-900 leading-tight">Scan QR</span>
                  <span className="text-[9px] text-neutral-500 font-bold leading-none mt-1">Sinar Kamera</span>
                </div>
              </button>

              {/* Action 2: Salin Link */}
              <button
                onClick={handleCopyShareLink}
                className="flex items-center gap-3 p-3 bg-neutral-0 hover:bg-neutral-50 border border-neutral-200 hover:border-neutral-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left shadow-sm shadow-neutral-100/50"
              >
                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-700 shrink-0 group-hover:scale-105 transition-transform border border-neutral-200/60 shadow-sm">
                  <Copy size={16} className="stroke-[2.5]" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-extrabold text-neutral-900 leading-tight">Salin Link</span>
                  <span className="text-[9px] text-neutral-550 font-bold leading-none mt-1">Saling Bagi</span>
                </div>
              </button>

              {/* Action 3: Atur Klaim */}
              {session.status !== "settled" ? (
                <button
                  onClick={openHostClaimModal}
                  className="flex items-center gap-3 p-3 bg-amber-50/20 hover:bg-amber-50/50 border border-amber-200/60 hover:border-amber-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left shadow-2 shadow-amber-500/5"
                >
                  <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 shadow-sm shadow-amber-500/10 group-hover:scale-105 transition-transform">
                    <ClipboardCheck size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-neutral-900 leading-tight">Atur Klaim</span>
                    <span className="text-[9px] text-amber-700 font-bold leading-none mt-1">Ubah Klaim</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200/50 rounded-2xl opacity-50 text-left select-none shadow-sm">
                  <div className="p-2 rounded-xl bg-neutral-200 text-neutral-450 shrink-0 shadow-sm">
                    <ClipboardCheck size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-neutral-450 leading-tight">Atur Klaim</span>
                    <span className="text-[9px] text-neutral-400 font-bold leading-none mt-1">Selesai</span>
                  </div>
                </div>
              )}

              {/* Action 4: Tutup Sesi */}
              {session.status !== "settled" ? (
                <button
                  onClick={handleCloseSession}
                  id="btn-close-session"
                  className="flex items-center gap-3 p-3 bg-green-50/20 hover:bg-green-50/50 border border-green-200/60 hover:border-green-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left shadow-2 shadow-green-500/5"
                >
                  <div className="p-2 rounded-xl bg-green-500 text-white shrink-0 shadow-sm shadow-green-500/10 group-hover:scale-105 transition-transform">
                    <CheckCircle size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-neutral-900 leading-tight">Tutup Sesi</span>
                    <span className="text-[9px] text-green-700 font-bold leading-none mt-1">Verifikasi</span>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50/30 border border-green-200/60 rounded-2xl text-left select-none shadow-sm">
                  <div className="p-2 rounded-xl bg-green-500 text-white shrink-0 shadow-sm shadow-green-500/10">
                    <Check size={16} className="stroke-[2.5]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-extrabold text-green-700 leading-tight">Terbayar</span>
                    <span className="text-[9px] text-green-600 font-bold leading-none mt-1">Sesi Ditutup</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Warning Box: Unclaimed Items alerts */}
          {unclaimedItemsCount > 0 && (
            <div className="bg-amber-50/40 border border-amber-200/60 p-4.5 rounded-3xl flex items-start gap-3.5 shadow-2 shadow-amber-500/5 font-sans">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 stroke-[2.5] mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-extrabold text-amber-800">Item Belum Diklaim</h4>
                <p className="text-[11px] text-amber-700/90 font-semibold leading-relaxed mt-1">
                  Ada {unclaimedItemsCount} item senilai <span className="font-extrabold">{formatIDR(unclaimedItemsValue)}</span> yang belum diklaim teman patungan Anda.
                </p>
                
                {/* List of unclaimed items */}
                <div className="flex flex-col gap-1.5 mt-2.5 bg-neutral-0/50 p-2.5 rounded-2xl border border-amber-200/40 text-[10px] text-amber-800/90 font-mono">
                  {unclaimedItems.map(item => (
                    <div key={item.id} className="flex justify-between font-bold">
                      <span className="truncate max-w-[170px]">{item.name} (x{item.quantity})</span>
                      <span>{formatIDR(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp Exporter Widget */}
          <div className="bg-neutral-0 rounded-3xl p-5 border border-neutral-200 shadow-2 flex flex-col gap-3 font-sans">
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center border border-green-200/50 shadow-sm">
                <MessageCircle size={15} className="stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-xs text-neutral-900 leading-tight">Ekspor Tagihan WhatsApp</h3>
                <p className="text-[10px] text-neutral-450 font-bold">Bagikan rincian tagihan terupdate ke WhatsApp group Anda.</p>
              </div>
            </div>

            <div className="bg-neutral-50/80 border border-neutral-200/70 p-3 rounded-2xl max-h-[120px] overflow-y-auto">
              <pre className="text-[10px] font-mono text-neutral-700 whitespace-pre-wrap leading-relaxed select-all">
                {generateWhatsAppSummary()}
              </pre>
            </div>

            <div className="flex gap-2.5 text-center mt-1">
              <button
                onClick={handleCopyWASummary}
                className={`flex-1 py-2.5 px-3 text-xs font-extrabold rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm select-none active:scale-[0.98]
                  ${copiedWA ? "bg-green-500 hover:bg-green-600 text-white border-transparent" : "bg-neutral-0 text-neutral-600 border-neutral-200 hover:bg-neutral-50"}`}
              >
                {copiedWA ? <ClipboardCheck size={14} className="stroke-[2.5]" /> : <Copy size={14} className="stroke-[2.5]" />}
                <span>{copiedWA ? "Tersalin!" : "Salin Format WA"}</span>
              </button>
              
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(generateWhatsAppSummary())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 px-3 text-xs font-extrabold rounded-xl shadow-sm hover:shadow-green-500/10 flex items-center justify-center gap-1.5 cursor-pointer text-center select-none transition-all active:scale-[0.98]"
              >
                <Share2 size={14} className="stroke-[2.5]" />
                <span>Kirim ke WA Sesi</span>
              </a>
            </div>
          </div>

          {/* Participant list cards */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-extrabold text-[#212121] uppercase tracking-wider px-1">
              Rekan Patungan ({session.participants.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {session.participants.map((person) => {
                const hasPending = person.paymentStatus === "pending_verification";
                const borderStyle = hasPending
                  ? "border-2 border-[#FF6D00] shadow-[#FF6D00]/5"
                  : "border border-[#E0E0E0] shadow-sm";

            return (
              <div
                key={person.id}
                className={`bg-white rounded-2xl p-4 flex flex-col gap-3.5 transition-all ${borderStyle}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#00C853]/10 text-[#00C853] flex items-center justify-center font-extrabold text-sm capitalize shrink-0">
                      {person.name.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-[#212121] truncate flex items-center gap-1.5 flex-wrap">
                        <span>{person.name}</span>
                        {person.id.startsWith("host_") && (
                          <span className="text-[8px] bg-[#00C853] text-white px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0">
                            Host
                          </span>
                        )}
                      </h4>
                      <div className="mt-0.5">{getParticipantBadge(person.paymentStatus, person.total)}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-[#757575] font-semibold">Tagihan</p>
                    <p className="font-extrabold text-xs text-[#212121]">{formatIDR(person.total)}</p>
                  </div>
                </div>

                {/* Sub-item diagnostics */}
                <div className="text-[11px] text-[#757575] bg-slate-50 p-2.5 rounded-xl border border-[#F5F5F5]">
                  <p className="font-bold text-[10px] text-[#212121] uppercase tracking-wider mb-1">Daftar Klaim:</p>
                  {person.claimedItems.length === 0 ? (
                    <span className="italic text-[10px]">Belum mengklaim item apapun.</span>
                  ) : (
                    <div className="max-h-[60px] overflow-y-auto flex flex-col gap-0.5">
                      {session.items
                        .filter(item => person.claimedItems.includes(item.id))
                        .map(item => {
                          const splitPrice = item.price * item.quantity / item.claimedBy.length;
                          return (
                            <div key={item.id} className="flex justify-between text-[10px]">
                              <span className="truncate max-w-[120px]">{item.name}</span>
                              <span className="font-semibold text-[#212121]">{formatIDR(splitPrice)}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                  {person.hasRoundingBurden && (
                    <div className="mt-2 text-[10px] text-[#E65100] font-extrabold bg-[#FFF3E0] px-2 py-1.5 rounded-xl border border-[#FFE0B2] flex items-center gap-1.5">
                      <Dices size={12} className="stroke-[2.5]" />
                      <span>Terkena Rounding Lucky Draw! ({formatIDR(session.roundingAmount)})</span>
                    </div>
                  )}
                </div>

                {/* Proof buttons action area */}
                {(hasPending || person.proofImageUrl || (person.paymentStatus !== "verified" && person.total > 0)) && (
                  <div className="flex justify-between items-center border-t border-[#F5F5F5] pt-3.5 mt-1.5 flex-wrap gap-2">
                    {person.proofImageUrl ? (
                      <button
                        onClick={() => {
                          setViewProofUrl(person.proofImageUrl);
                          setViewProofParticipantName(person.name);
                          setViewProofParticipantId(person.id);
                        }}
                        className="text-[10px] font-bold text-[#1565C0] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={12} />
                        <span>Lihat Bukti Transfer</span>
                      </button>
                    ) : (
                      person.paymentStatus === "pending_verification" && (
                        <span className="text-[10px] text-red-600 font-bold">Bukti Hilang!</span>
                      )
                    )}

                    {/* Individual nudge reminder button */}
                    {person.paymentStatus !== "verified" && person.total > 0 && (
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `Halo *${person.name}*! Yuk segera selesaikan tagihan kamu untuk acara *${session.name}*. Total tagihan kamu senilai *${formatIDR(person.total)}*.\n\nSilakan proses pembayaran di tautan berikut: ${getPublicShareUrl(sessionId)}\n\nTerima kasih banyak ya!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 py-1 px-2 rounded-md font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Himbau via WhatsApp"
                      >
                        <MessageCircle size={11} />
                        <span>Himbau via WA</span>
                      </a>
                    )}

                    {/* Direct Verification for Host */}
                    {person.paymentStatus !== "verified" && person.total > 0 && (
                      <button
                        onClick={() => handleVerifyParticipant(person.id)}
                        className="bg-[#00C853] hover:bg-[#009624] text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer active:scale-95 transition-all ml-auto"
                      >
                        <Check size={11} />
                        <span>Verifikasi Manual</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Image Verification Overlay Modal */}
      {viewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-[#E0E0E0]">
              <div>
                <h4 className="font-extrabold text-[#212121] text-sm">Bukti Bayar {viewProofParticipantName}</h4>
                <p className="text-[10px] text-[#757575]">Klik silang untuk keluar</p>
              </div>
              <button
                onClick={() => {
                  setViewProofUrl(null);
                  setViewProofParticipantName("");
                  setViewProofParticipantId("");
                }}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-[#757575] rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="bg-[#1a1a1a] flex items-center justify-center max-h-[350px] overflow-hidden p-2">
              <img
                src={viewProofUrl}
                alt="Screenshot Proof"
                className="max-h-full max-w-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="p-4 bg-slate-50 flex flex-col gap-3">
              <p className="text-[10px] text-[#757575] leading-relaxed text-center font-semibold">
                Harap cocokan nominal dengan mutasi bank rujukan Anda sebelum mengetuk verifikasi.
              </p>
              
              <div className="flex gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewProofUrl(null);
                    setViewProofParticipantName("");
                    setViewProofParticipantId("");
                  }}
                  className="flex-1 bg-white hover:bg-slate-100 border border-[#E0E0E0] text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer text-[#757575] text-center"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const pId = viewProofParticipantId;
                    setViewProofUrl(null);
                    setViewProofParticipantName("");
                    setViewProofParticipantId("");
                    await handleVerifyParticipant(pId);
                  }}
                  className="flex-1 bg-[#00C853] hover:bg-[#009624] text-white text-[11px] font-extrabold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check size={14} />
                  <span>Verifikasi Lunas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Scan overlay modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-[#E0E0E0]">
              <div>
                <h4 className="font-extrabold text-[#212121] text-sm">Scan QR Code Sesi</h4>
                <p className="text-[10px] text-[#757575]">Bagikan langsung di lokasi</p>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-[#757575] rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="bg-slate-50 flex flex-col items-center justify-center p-8 gap-4">
              <div className="p-3 border border-[#E0E0E0] bg-white rounded-2xl shadow-sm">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getPublicShareUrl(sessionId))}`}
                  alt="Scan QR Code Patungan"
                  className="w-48 h-48"
                  referrerPolicy="no-referrer"
                />
              </div>
              <p className="text-[11px] text-[#757575] leading-relaxed text-center font-medium max-w-[240px]">
                Teman Anda cukup mengarahkan kamera ponsel mereka ke kode QR di atas untuk langsung bergabung ke sesi patungan *{session.name}*.
              </p>
            </div>

            <div className="p-4 bg-slate-50 border-t border-[#E0E0E0] flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getPublicShareUrl(sessionId));
                  onSuccess("Tautan salinan berhasil disalin ke papan klip.");
                }}
                className="flex-1 bg-white hover:bg-slate-100 border border-[#E0E0E0] text-[11px] font-bold py-2.5 rounded-xl transition-all cursor-pointer text-[#212121]"
              >
                Salin Tautan
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="flex-1 bg-[#00C853] hover:bg-[#009624] text-white text-[11px] font-extrabold py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Host claim management modal overlay */}
      {showHostClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-5 border-b border-[#E0E0E0] bg-white sticky top-0 z-10">
              <div>
                <h4 className="font-extrabold text-[#212121] text-sm flex items-center gap-1.5">
                  <ClipboardCheck size={18} className="text-green-600 shrink-0 stroke-[2.5]" />
                  <span>Atur Pembagian Item</span>
                </h4>
                <p className="text-[10px] text-[#757575]">Pilih siapa saja yang ikut menanggung tiap item</p>
              </div>
              <button
                onClick={() => setShowHostClaimModal(false)}
                className="p-2 bg-slate-100 hover:bg-slate-200 text-[#757575] rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-4">
              {editingItems.map((item) => {
                const totalClaimants = item.claimedBy.length;
                const pricePerPerson = totalClaimants > 0 ? (item.price * item.quantity) / totalClaimants : 0;

                return (
                  <div key={item.id} className="bg-white border border-[#E0E0E0] p-4 rounded-2xl shadow-xs flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-extrabold text-xs text-[#212121]">{item.name}</h5>
                        <p className="text-[10px] text-[#757575] font-semibold mt-0.5">
                          {formatIDR(item.price)} x {item.quantity} = {formatIDR(item.price * item.quantity)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#757575] block">Porsi / Orang</span>
                        <span className="font-extrabold text-[11px] text-[#00C853]">
                          {totalClaimants > 0 ? formatIDR(pricePerPerson) : "Belum terbagi"}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-[#F5F5F5] pt-2">
                      <p className="text-[9px] text-[#757575] font-bold uppercase tracking-wider mb-2">Peserta ({totalClaimants}):</p>
                      <div className="flex flex-wrap gap-1.5">
                        {session.participants.map((person) => {
                          const isClaimedByMe = item.claimedBy.includes(person.id);
                          const isHost = person.id.startsWith("host_");
                          const chipStyle = isClaimedByMe
                            ? "bg-[#00C853] text-white border-transparent font-bold shadow-xs scale-98"
                            : "bg-slate-100 hover:bg-slate-200 text-[#424242] border border-transparent";

                          return (
                            <button
                              key={person.id}
                              type="button"
                              onClick={() => handleToggleParticipantInClaim(item.id, person.id)}
                              className={`px-3 py-1.5 rounded-full text-[10px] transition-all cursor-pointer flex items-center gap-1.5 ${chipStyle}`}
                            >
                              {isClaimedByMe && <span className="text-white">✓</span>}
                              <span>{person.name}{isHost ? " (Host)" : ""}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 bg-white border-t border-[#E0E0E0] flex flex-col gap-3 sticky bottom-0 z-10">
              <p className="text-[9px] text-[#757575] leading-normal text-center">
                * Sistem akan langsung membagi rata item yang dipilih bersama ke masing-masing rekan terpilih beserta pajak dan biaya layanan secara proporsional.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowHostClaimModal(false)}
                  disabled={loadingSaveClaims}
                  className="flex-1 bg-white hover:bg-slate-50 border border-[#E0E0E0] text-[11px] font-bold py-3 rounded-xl transition-all cursor-pointer text-[#757575]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveHostClaims}
                  disabled={loadingSaveClaims}
                  className="flex-1 bg-[#00C853] hover:bg-[#009624] text-white text-[11px] font-extrabold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loadingSaveClaims ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
