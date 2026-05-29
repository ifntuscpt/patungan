import { useState, useEffect } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { Camera, Users, BarChart3, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AppLogo } from "./AppLogo";

interface LoginViewProps {
  onSuccess: (user: any) => void;
  onError: (msg: string) => void;
}

const SLIDES = [
  {
    id: 0,
    title: "OCR Struk Pintar",
    description: "Foto struk belanja kamu dan biarkan AI kami mendeteksi item & harga secara otomatis.",
    icon: <Camera size={36} className="text-[#006e2a] stroke-[2.5]" />,
    bg: "bg-[#E8F5E9]",
  },
  {
    id: 1,
    title: "Klaim Mandiri",
    description: "Bagikan link sesi ke grup, teman cukup pilih menu mereka tanpa perlu daftar akun.",
    icon: <Users size={36} className="text-[#9f4200] stroke-[2.5]" />,
    bg: "bg-[#FFF3E0]",
  },
  {
    id: 2,
    title: "Pajak Proporsional",
    description: "Pajak dan biaya servis dihitung secara adil berdasarkan proporsi pesanan masing-masing.",
    icon: <BarChart3 size={36} className="text-[#2196F3] stroke-[2.5]" />,
    bg: "bg-[#E3F2FD]",
  }
];

export function LoginView({ onSuccess, onError }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  // Auto-advance slides every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onSuccess(result.user);
    } catch (err: any) {
      console.error("Login failure: ", err);
      onError("Gagal masuk menggunakan Google OAuth. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center px-4 py-6 font-sans">
      {/* Container Device Wrapper Mockup */}
      <div className="w-full max-w-[420px] bg-gradient-to-b from-white to-[#FAF9F7] rounded-3xl border border-neutral-200/60 shadow-xl flex flex-col justify-between p-6 min-h-[640px] relative overflow-hidden">
        
        {/* App Logo & Wordmark */}
        <header className="flex flex-col items-center pt-2 pb-4">
          <AppLogo size={56} className="mb-3 animate-pulse" />
          <h1 className="text-xl font-extrabold tracking-tight text-neutral-900 leading-none">
            Patungan
          </h1>
        </header>

        {/* Dynamic Sliding Section */}
        <section className="flex-1 flex flex-col justify-center items-center relative py-4">
          <div className="w-full relative min-h-[210px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="flex flex-col items-center text-center w-full px-2"
              >
                {/* Modern Icon Home Circle Container */}
                <div className={`w-20 h-20 ${SLIDES[currentSlide].bg} rounded-full flex items-center justify-center mb-5.5 shadow-sm`}>
                  {SLIDES[currentSlide].icon}
                </div>
                
                {/* Sliding Content Heading */}
                <h2 className="text-lg font-extrabold text-neutral-900 mb-3 px-3">
                  {SLIDES[currentSlide].title}
                </h2>
                
                {/* Sliding Content Paragraph Body */}
                <p className="text-xs text-neutral-500 font-medium leading-relaxed max-w-[280px] mx-auto">
                  {SLIDES[currentSlide].description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Indicator Dot Paginations */}
          <div className="flex justify-center gap-2 mt-6">
            {SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full cursor-pointer transition-all duration-300 ${
                  idx === currentSlide ? "w-6 bg-[#00C853]" : "w-2 bg-neutral-300"
                }`}
                aria-label={`Lihat info slide ${idx + 1}`}
              />
            ))}
          </div>
        </section>

        {/* Action Button & Tooltip Footer area */}
        <footer className="w-full pt-4 pb-2 space-y-3.5 relative">
          <div className="relative w-full">
            {/* Elegant Tooltip overlay above login button */}
            <AnimatePresence>
              {showTooltip && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-full left-0 right-0 mb-5 bg-neutral-900 text-white p-4 rounded-2xl shadow-xl text-xs leading-relaxed z-50 text-left"
                >
                  <div className="relative">
                    Hanya Host yang perlu login menggunakan Google. Rekan atau tamu (Guest) dapat langsung mengklaim pesanan mereka secara mandiri gratis melalui tautan sesi tanpa harus memiliki akun!
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 border-[10px] border-transparent border-t-neutral-900"></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Google Authentication CTA Host */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              id="btn-google-login"
              className="w-full bg-[#00C853] hover:bg-[#00A846] text-white py-3.5 px-5 rounded-2xl font-bold font-display flex items-center justify-center gap-3 shadow-green active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none cursor-pointer h-14"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-sm">Masuk Sebagai Host (Google)</span>
                </>
              )}
            </button>
          </div>

          {/* Guide Popup Tooltip Toggle Trigger */}
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="w-full flex items-center justify-center gap-1.5 text-neutral-550 hover:text-neutral-800 transition-colors py-1 cursor-pointer"
          >
            <Info size={16} className="text-neutral-400 shrink-0 stroke-[2.5]" />
            <span className="text-xs font-bold leading-normal text-neutral-600">Info untuk Tamu (Guest)</span>
          </button>
        </footer>

      </div>
    </div>
  );
}
