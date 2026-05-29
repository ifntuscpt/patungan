import { useState, useEffect } from "react";
import { collection, query, where, orderBy, onSnapshot, getDocs } from "firebase/firestore";
import { db, auth, OperationType, handleFirestoreError } from "../firebase";
import { Session } from "../types";
import { formatIDR } from "../utils/calculations";
import { Plus, Power, Calendar, FileText, ArrowRight, User, X, ReceiptText, BookOpen, Dices, Crown, Camera, Users, Link, CreditCard, Sparkles, Lock } from "lucide-react";
import { AppLogo } from "./AppLogo";

interface DashboardViewProps {
  onSelectSession: (sessionId: string) => void;
  onCreateNew: () => void;
  onLogout: () => void;
  onError: (msg: string) => void;
}

export function DashboardView({ onSelectSession, onCreateNew, onLogout, onError }: DashboardViewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 11) return "Selamat pagi";
    if (hour >= 11 && hour < 15) return "Selamat siang";
    if (hour >= 15 && hour < 18) return "Selamat sore";
    return "Selamat malam";
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const hostId = user.uid;
    const sessionsCol = collection(db, "sessions");
    const q = query(
      sessionsCol,
      where("hostId", "==", hostId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Session[] = [];
        snapshot.forEach((doc) => {
          fetched.push({ ...doc.data(), id: doc.id } as Session);
        });
        setSessions(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load sessions in real-time:", error);
        // Fallback error catcher
        try {
          handleFirestoreError(error, OperationType.LIST, "sessions");
        } catch (e: any) {
          onError("Gagal menyinkronkan daftar sesi. Anda mungkin belum memiliki sesi aktif.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [onError]);

  const formatDate = (rawDate: any) => {
    if (!rawDate) return "Baru dibuat";
    const date = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }) + " WIB";
  };

  const getStatusBadge = (status: Session["status"]) => {
    switch (status) {
      case "setup":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-neutral-100 text-neutral-500 border border-neutral-200 px-2 py-0.5 rounded-full font-bold uppercase select-none font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-400"></span>
            <span>Setup</span>
          </span>
        );
      case "claiming":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold uppercase select-none font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            <span>Claiming</span>
          </span>
        );
      case "payment":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-bold uppercase select-none font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
            <span>Payment</span>
          </span>
        );
      case "settled":
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-bold uppercase select-none font-sans">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            <span>Settled</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getAccentClass = (status: Session["status"]) => {
    switch (status) {
      case "setup":
        return "bg-neutral-300";
      case "claiming":
        return "bg-linear-to-r from-blue-600 to-blue-300";
      case "payment":
        return "bg-linear-to-r from-orange-500 to-orange-300";
      case "settled":
        return "bg-linear-to-r from-green-500 to-green-300";
      default:
        return "bg-neutral-200";
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 px-4 pb-20">
      {/* Header Panel */}
      <header className="flex justify-between items-center py-4 border-b border-neutral-200/85">
        <div className="flex items-center gap-3">
          <AppLogo size={40} className="animate-pulse" />
          <div className="space-y-0.5">
            <h1 className="text-lg font-extrabold tracking-tight text-neutral-900 leading-none">Patungan</h1>
            <p className="text-neutral-500 text-[10px] font-semibold leading-none">Foto struk, share link, beres.</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          id="btn-logout"
          title="Keluar"
          className="flex items-center gap-1.5 px-3 py-2 bg-neutral-0 hover:bg-red-50/40 text-neutral-500 hover:text-red-600 rounded-xl border border-neutral-200 hover:border-red-200/50 transition-all cursor-pointer shadow-1 select-none active:scale-95"
        >
          <Power size={14} className="stroke-[2.5]" />
          <span className="text-xs font-extrabold tracking-tight">Keluar</span>
        </button>
      </header>

      {/* User Information Unit & Quick Actions Grid (Jago style) */}
      <div className="bg-neutral-0 rounded-3xl border border-neutral-200/80 shadow-2 overflow-hidden flex flex-col">
        {/* Profile section with colored background header */}
        <div className="bg-gradient-to-r from-green-800 to-green-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 border border-white/20 text-white flex items-center justify-center font-extrabold shadow-sm select-none">
              {auth.currentUser?.displayName?.substring(0, 1) || auth.currentUser?.email?.substring(0, 1) || "P"}
            </div>
            <div>
              <p className="text-[10px] text-green-100 uppercase tracking-widest font-extrabold leading-none mb-1">{getGreeting()}</p>
              <h2 className="text-sm font-extrabold truncate max-w-[200px] tracking-tight">
                {auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Host Patungan"}
              </h2>
            </div>
          </div>
          <span className="text-[10px] text-green-50 font-extrabold bg-green-900/40 px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm leading-none flex items-center gap-1.5">
            <Crown size={11} className="stroke-[2.5] text-amber-300" />
            <span>Host</span>
          </span>
        </div>

        {/* Quick Actions Grid: always a clean 2x2 grid */}
        <div className="p-4 bg-neutral-0 border-t border-neutral-100 grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            onClick={onCreateNew}
            className="flex items-center gap-3 p-3 bg-green-50/30 hover:bg-green-50/60 border border-green-200/50 hover:border-green-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left"
          >
            <div className="p-2.5 rounded-xl bg-green-500 text-white shrink-0 shadow-sm shadow-green/20 group-hover:scale-105 transition-transform">
              <ReceiptText size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-neutral-900 leading-tight">Buat Sesi</span>
              <span className="text-[9px] text-green-700 font-bold leading-none mt-1">Mulai Baru</span>
            </div>
          </button>
          
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-3 p-3 bg-purple-50/30 hover:bg-purple-50/60 border border-purple-200/50 hover:border-purple-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left"
          >
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0 shadow-sm shadow-purple/20 group-hover:scale-105 transition-transform">
              <BookOpen size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-neutral-900 leading-tight">Cara Pakai</span>
              <span className="text-[9px] text-purple-700 font-bold leading-none mt-1">Panduan Sesi</span>
            </div>
          </button>

          <div
            className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200/60 rounded-2xl opacity-60 text-left select-none"
            title="Lucky Draw di dalam Sesi Aktif"
          >
            <div className="p-2.5 rounded-xl bg-neutral-300 text-neutral-600 shrink-0 shadow-sm">
              <Dices size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-neutral-600 leading-tight">Lucky Draw</span>
              <span className="text-[9px] text-neutral-500 font-bold leading-none mt-1">Sesi Aktif</span>
            </div>
          </div>

          <button
            onClick={() => setShowPremiumModal(true)}
            className="flex items-center gap-3 p-3 bg-amber-50/30 hover:bg-amber-50/60 border border-amber-200/50 hover:border-amber-300 rounded-2xl transition-all cursor-pointer group active:scale-[0.97] text-left"
            title="Lihat Fitur Premium"
          >
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 shadow-sm shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <Crown size={18} className="stroke-[2.5]" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-extrabold text-neutral-900 leading-tight">Premium</span>
              <span className="text-[9px] text-amber-700 font-bold leading-none mt-1 font-sans">Buka Fitur</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Sessions Section */}
      <div className="flex flex-col gap-4">
        <h2 className="text-base font-extrabold text-neutral-900 px-1 flex items-center justify-between tracking-tight">
          <span>Sesi Patungan Anda</span>
          <span className="text-xs font-bold text-neutral-500 bg-neutral-100 border border-neutral-200/60 px-3 py-0.5 rounded-full font-mono">
            {sessions.length} Sesi
          </span>
        </h2>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((v) => (
              <div key={v} className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 animate-pulse flex flex-col gap-3 shadow-1">
                <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                <div className="h-3 bg-neutral-200 rounded w-1/4"></div>
                <div className="h-4 bg-neutral-200 rounded w-3/4 mt-2"></div>
              </div>
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-neutral-0 rounded-3xl p-8 border border-neutral-200 shadow-1 flex flex-col items-center text-center gap-4 py-12">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <FileText size={28} className="stroke-[2]" />
            </div>
            <div>
              <p className="font-extrabold text-neutral-900">Belum Ada Sesi Patungan</p>
              <p className="text-xs text-neutral-500 max-w-xs mt-1 font-medium leading-relaxed">
                Semua sesi patungan Anda akan tercatat di sini. Buat sesi pertama Anda dengan memfoto struk belanja/nota!
              </p>
            </div>
            <button
              onClick={onCreateNew}
              className="mt-2 btn-primary-gradient text-white font-bold text-xs py-2.5 px-6 rounded-full transition-all cursor-pointer"
            >
              Mulai Sesi Baru
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="bg-neutral-0 rounded-2xl border border-neutral-200 hover:border-green-500 hover:shadow-2 shadow-1 select-none transition-all active:scale-[0.98] cursor-pointer flex flex-col relative overflow-hidden group"
              >
                {/* Accent Line Stripe */}
                <div className={`h-1 w-full ${getAccentClass(session.status)}`}></div>
                
                <div className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-extrabold text-[#1A1816] group-hover:text-green-600 transition-colors truncate max-w-[190px]">
                        {session.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-medium mt-1">
                        <Calendar size={12} className="stroke-[2.5]" />
                        <span>{formatDate(session.createdAt)}</span>
                      </div>
                    </div>
                    {getStatusBadge(session.status)}
                  </div>

                  <div className="border-t border-neutral-100/80 pt-3.5 flex justify-between items-center mt-1">
                    <div>
                      <p className="text-[9px] text-neutral-400 uppercase tracking-widest font-extrabold">Total Tagihan</p>
                      <p className="text-base font-extrabold text-green-600 font-mono mt-0.5">{formatIDR(session.grandTotal)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-green-600">
                      <span>Kelola Sesi</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform stroke-[2.5]" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB Floating action button */}
      <button
        onClick={onCreateNew}
        id="btn-fab-new"
        className="fixed bottom-6 right-6 w-14 h-14 btn-primary-gradient text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all z-40 cursor-pointer text-2xl"
        title="Buat Sesi Patungan"
      >
        <Plus size={24} className="stroke-[2.5]" />
      </button>

      {/* Dynamic Splitting Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-neutral-0 rounded-3xl border border-neutral-200 shadow-2 max-w-md w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-neutral-100 flex justify-between items-center bg-neutral-50">
              <div className="flex items-center gap-2.5">
                <BookOpen size={18} className="text-green-600 stroke-[2.5]" />
                <h3 className="font-extrabold text-base text-neutral-900 tracking-tight">Cara Cepat Patungan</h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 hover:bg-neutral-200 rounded-full text-neutral-500 hover:text-neutral-900 transition-colors cursor-pointer"
              >
                <X size={18} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="emoji-icon emoji-icon--sm emoji-icon--green shrink-0">
                  <Camera size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-neutral-900 leading-snug">1. Foto & Scan Struk Anda</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-semibold">
                    Tekan <span className="font-bold text-green-600">"Buat Sesi"</span>, unggah atau potret struk kasir Anda. AI (Gemini) akan memindai barang & harganya otomatis.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="emoji-icon emoji-icon--sm emoji-icon--purple shrink-0">
                  <Users size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-neutral-900 leading-snug">2. Masukkan Teman & Biaya Sampingan</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-semibold">
                    Daftarkan nama rekan-rekan patungan Anda. Masukkan total pajak / biaya layanan tambahan agar sistem membaginya secara adil proporsional.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="emoji-icon emoji-icon--sm emoji-icon--blue shrink-0">
                  <Link size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-neutral-900 leading-snug">3. Sebarkan Tautan Sesi</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-semibold">
                    Bagikan link unik atau scan langsung Kode QR yang diterbitkan agar teman-teman Anda dapat memilih pesanan masing-masing.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="emoji-icon emoji-icon--sm emoji-icon--orange shrink-0">
                  <CreditCard size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-xs text-neutral-900 leading-snug">4. Klaim Mandiri & Konfirmasi</h4>
                  <p className="text-[11px] text-neutral-500 leading-relaxed font-semibold">
                    Setiap teman mengklaim pesanan mereka & mengunggah bukti transfer ke rekening Anda. Patungan sukses tanpa ada selisih kas!
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setShowGuide(false)}
                className="btn-primary-gradient text-white text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer transition-all active:scale-95"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Features Info Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
          <div className="bg-neutral-0 rounded-3xl border border-neutral-200 shadow-2 max-w-sm w-full overflow-hidden flex flex-col animate-scale-in">
            {/* Modal Premium Header */}
            <div className="p-5 border-b border-amber-100 flex justify-between items-center bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <Crown size={18} className="text-amber-600 stroke-[2.5]" />
                <h3 className="font-extrabold text-base text-amber-900 tracking-tight">Fitur Premium Patungan</h3>
              </div>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="p-1.5 hover:bg-amber-100/50 rounded-full text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
              >
                <X size={18} className="stroke-[2.5]" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <p className="text-[11px] text-neutral-500 leading-relaxed font-semibold">
                Dapatkan akses tak terbatas dan kelola patungan bersama grup teman atau rekan kerja secara profesional.
              </p>

              {/* feature 1 */}
              <div className="flex gap-3 items-start">
                <div className="emoji-icon emoji-icon--sm emoji-icon--green shrink-0">
                  <ReceiptText size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-neutral-900">Sesi Tanpa Batas & Dashboard</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
                    Buat sesi patungan tanpa batas dengan dashboard interaktif untuk memantau status kasir, total tagihan, dan pembayaran real-time.
                  </p>
                </div>
              </div>

              {/* feature 2 */}
              <div className="flex gap-3 items-start">
                <div className="emoji-icon emoji-icon--sm emoji-icon--purple shrink-0">
                  <Calendar size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-neutral-900">Patungan Bulanan (Monthly)</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
                    Pilihan patungan rutin bulanan otomatis. Sangat cocok untuk sewa kos, langganan Spotify Family, Netflix, atau makan bersama.
                  </p>
                </div>
              </div>

              {/* feature 3 */}
              <div className="flex gap-3 items-start">
                <div className="emoji-icon emoji-icon--sm emoji-icon--blue shrink-0">
                  <Lock size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-neutral-900">Gmail Connected (Anti-Guest)</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
                    Terhubung langsung dengan rekan yang login via akun Gmail asli. Tanpa perlu input nama manual, hindari klaim palsu secara aman.
                  </p>
                </div>
              </div>

              {/* feature 4 */}
              <div className="flex gap-3 items-start">
                <div className="emoji-icon emoji-icon--sm emoji-icon--orange shrink-0">
                  <Sparkles size={16} className="stroke-[2.5]" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="font-extrabold text-xs text-neutral-900">Fitur Mendatang Lainnya</h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed font-semibold">
                    Pengingat otomatis lewat WhatsApp (Auto Reminder), laporan analitis bulanan (ekspor PDF/Excel), dan konfirmasi tagihan pintar.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-end">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="py-2.5 px-6 rounded-xl text-xs font-extrabold text-[#757575] bg-neutral-100 hover:bg-neutral-200 cursor-pointer transition-all active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
