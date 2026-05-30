import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { Session } from "./types";
import { calculateSessionFinance } from "./utils/calculations";
import { ToastMessage } from "./components/Toast";
import { LogOut } from "lucide-react";

// Modular Views
import { LoginView } from "./components/LoginView";
import { DashboardView } from "./components/DashboardView";
import { CreateSessionWizard } from "./components/CreateSessionWizard";
import { ShareSessionScreen } from "./components/ShareSessionScreen";
import { MonitorDashboard } from "./components/MonitorDashboard";
import { GuestNameSelection } from "./components/GuestNameSelection";
import { GuestItemClaim } from "./components/GuestItemClaim";
import { GuestSummary } from "./components/GuestSummary";
import { LuckyDrawSpinner } from "./components/LuckyDrawSpinner";
import { GuestPayment } from "./components/GuestPayment";
import { GuestDone } from "./components/GuestDone";
import { ToastList } from "./components/Toast";

// Robust Native Client Router
interface RouteState {
  route: string;
  params: {
    sessionId?: string;
  };
}

const parseCurrentRoute = (pathName: string): RouteState => {
  const parts = pathName.split("/").filter(Boolean); // e.g., ["s", "session_123", "claim"]

  if (parts.length === 0) {
    return { route: "beranda", params: {} };
  }

  if (parts[0] === "login") {
    return { route: "login", params: {} };
  }

  if (parts[0] === "new") {
    return { route: "new", params: {} };
  }

  if (parts[0] === "session") {
    const id = parts[1];
    const action = parts[2]; // "share" or "monitor"
    return { route: `host-${action || "monitor"}`, params: { sessionId: id } };
  }

  if (parts[0] === "s") {
    const id = parts[1];
    const action = parts[2]; // undefined, "claim", "summary", "lucky-draw", "payment", "done"
    return { route: `guest-${action || "select"}`, params: { sessionId: id } };
  }

  return { route: "beranda", params: {} };
};

export default function App() {
  // Global auth state
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Dynamic Routing
  const [currentRoute, setCurrentRoute] = useState<RouteState>(() =>
    parseCurrentRoute(window.location.pathname)
  );

  // Real-time Guest Session syncing
  const [activeGuestSession, setActiveGuestSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: "success" | "error" | "info" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentRoute(parseCurrentRoute(path));
  };

  // 1. Sync authentication updates
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);

      // Redirect out of login if signed in but on login page
      const resolved = parseCurrentRoute(window.location.pathname);
      if (usr && resolved.route === "login") {
        navigateTo("/");
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync history popstate (Back/Forward browser buttons)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(parseCurrentRoute(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 3. Sync Real-time Firestore session document if on a guest flow
  useEffect(() => {
    const isGuestFlow = currentRoute.route.startsWith("guest-");
    const sId = currentRoute.params.sessionId;

    if (isGuestFlow && sId) {
      setSessionLoading(true);
      const docRef = doc(db, "sessions", sId);
      
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const raw = snapshot.data();
            const { subtotalItems, participants, roundingAmount } = calculateSessionFinance(raw);
            
            setActiveGuestSession({
              ...raw,
              id: snapshot.id,
              subtotalItems,
              participants,
              roundingAmount
            } as Session);
          } else {
            addToast("Sesi patungan tidak valid atau sudah kadaluarsa.", "error");
            navigateTo("/");
          }
          setSessionLoading(false);
        },
        (error) => {
          console.error("Firestore guest onSnapshot sync failed:", error);
          try {
            handleFirestoreError(error, OperationType.GET, `sessions/${sId}`);
          } catch (e: any) {
            addToast("Gagal menyambung ke basis data real-time.", "error");
          }
          setSessionLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setActiveGuestSession(null);
    }
  }, [currentRoute.route, currentRoute.params.sessionId]);

  // 4. Safe Guest Redirection & Validation Effect
  useEffect(() => {
    const isGuestFlow = currentRoute.route.startsWith("guest-");
    const sId = currentRoute.params.sessionId;
    
    if (isGuestFlow && sId && activeGuestSession) {
      // Validation 0: If the logged-in Host is accessing their own session's guest link, redirect them to the host monitor dashboard
      if (user && user.uid === activeGuestSession.hostId) {
        addToast("Membuka sebagai Host. Mengarahkan Anda ke Dashboard Kelola Sesi...", "info");
        navigateTo(`/session/${sId}/monitor`);
        return;
      }

      const activeParticipantId = getStoredParticipantId(sId);
      
      // Validation 1: Force select name if no identity is present and trying to perform actions (except name selection)
      if (!activeParticipantId && currentRoute.route !== "guest-select") {
        navigateTo(`/s/${sId}`);
        return;
      }

      // Validation 2: If on payment page, check if payment is already pending or verified, redirect to /done
      if (currentRoute.route === "guest-payment" && activeParticipantId) {
        const me = activeGuestSession.participants.find((p) => p.id === activeParticipantId);
        if (me && (me.paymentStatus === "pending_verification" || me.paymentStatus === "verified")) {
          navigateTo(`/s/${sId}/done`);
          return;
        }
      }
    }
  }, [currentRoute.route, currentRoute.params.sessionId, activeGuestSession, user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast("Berhasil keluar dari akun Host.", "success");
      navigateTo("/login");
    } catch (err) {
      addToast("Gagal keluar akun.", "error");
    }
  };

  // Helper to discover client participantId from localStorage for persistent sessions
  const getStoredParticipantId = (sId: string) => {
    return localStorage.getItem(`patungan_session_${sId}_pId`) || "";
  };

  const storeParticipantId = (sId: string, pId: string) => {
    localStorage.setItem(`patungan_session_${sId}_pId`, pId);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col justify-center items-center font-sans">
        <div className="w-10 h-10 border-3 border-[#00C853] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-[#757575] mt-3 tracking-wide">Menyelaraskan Autentikasi Patungan...</p>
      </div>
    );
  }

  // --- Router View Dispatcher ---
  const renderRoute = () => {
    const { route, params } = currentRoute;

    // A. Guest Flows Parser
    if (route.startsWith("guest-")) {
      const sId = params.sessionId!;
      
      if (sessionLoading && !activeGuestSession) {
        return (
          <div className="min-h-[60vh] flex flex-col justify-center items-center">
            <div className="w-8 h-8 border-3 border-[#00C853] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-[#757575] mt-2 font-bold animate-pulse">Menghubungkan Sesi Patungan...</p>
          </div>
        );
      }

      if (!activeGuestSession) {
        return (
          <div className="py-20 text-center px-4">
            <p className="text-sm font-bold text-red-600">Sesi patungan tidak ditemukan atau telah dihapus.</p>
            <button
              onClick={() => navigateTo("/")}
              className="mt-4 bg-[#00C853] text-white px-5 py-2 rounded-full font-bold text-xs"
            >
              Kembali Ke Beranda
            </button>
          </div>
        );
      }

      // persistent login retrieval
      const activeParticipantId = getStoredParticipantId(sId);

      // 1. Guest landing - Select name
      if (route === "guest-select") {
        // If has persistent identity, directly guide them to claim screen!
        if (activeParticipantId && activeGuestSession.participants.some(p => p.id === activeParticipantId)) {
          // Double check if claimant has chosen previous items, or directly forward
          return (
            <GuestItemClaim
              session={activeGuestSession}
              participantId={activeParticipantId}
              onClaimCompleted={() => navigateTo(`/s/${sId}/summary`)}
              onError={(m) => addToast(m, "error")}
              onSuccess={(m) => addToast(m, "success")}
            />
          );
        }

        return (
          <GuestNameSelection
            session={activeGuestSession}
            onNameSelected={(pId) => {
              storeParticipantId(sId, pId);
              navigateTo(`/s/${sId}/claim`);
            }}
          />
        );
      }

      // Guest operations require checked participant id
      if (!activeParticipantId) {
        // Safe placeholder while Redirection Effect works
        return (
          <div className="min-h-[40vh] flex flex-col justify-center items-center">
            <div className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-[#757575] mt-2">Mengarahkan...</p>
          </div>
        );
      }

      // 2. Guest Claim Screen
      if (route === "guest-claim") {
        return (
          <GuestItemClaim
            session={activeGuestSession}
            participantId={activeParticipantId}
            onClaimCompleted={() => navigateTo(`/s/${sId}/summary`)}
            onError={(m) => addToast(m, "error")}
            onSuccess={(m) => addToast(m, "success")}
          />
        );
      }

      // 3. Guest Bill Summary Screen
      if (route === "guest-summary") {
        return (
          <GuestSummary
            session={activeGuestSession}
            participantId={activeParticipantId}
            onNavigateToLuckyDraw={() => navigateTo(`/s/${sId}/lucky-draw`)}
            onNavigateToPayment={() => navigateTo(`/s/${sId}/payment`)}
            onSuccess={(m) => addToast(m, "success")}
            onError={(m) => addToast(m, "error")}
            onHostAutoVerified={() => navigateTo(`/s/${sId}/done`)}
          />
        );
      }

      // 4. Guest Lucky Draw Spin Simulation
      if (route === "guest-lucky-draw") {
        return (
          <LuckyDrawSpinner
            session={activeGuestSession}
            participantId={activeParticipantId}
            onFinished={() => navigateTo(`/s/${sId}/payment`)}
            onError={(m) => addToast(m, "error")}
            onSuccess={(m) => addToast(m, "success")}
          />
        );
      }

      // 5. Guest Bank Coordinates & Upload proof Screen
      if (route === "guest-payment") {
        const me = activeGuestSession.participants.find(p => p.id === activeParticipantId);
        if (me && (me.paymentStatus === "pending_verification" || me.paymentStatus === "verified")) {
          return (
            <div className="min-h-[40vh] flex flex-col justify-center items-center">
              <div className="w-6 h-6 border-2 border-[#00C853] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-[#757575] mt-2">Memproses Status Pembayaran...</p>
            </div>
          );
        }

        return (
          <GuestPayment
            session={activeGuestSession}
            participantId={activeParticipantId}
            onPaymentSubmitted={() => navigateTo(`/s/${sId}/done`)}
            onBackToSummary={() => navigateTo(`/s/${sId}/summary`)}
            onError={(m) => addToast(m, "error")}
            onSuccess={(m) => addToast(m, "success")}
          />
        );
      }

      // 6. Guest success uploaded Screen
      if (route === "guest-done") {
        const me = activeGuestSession.participants.find(p => p.id === activeParticipantId);
        const paidAmount = me?.total || 0;

        return (
          <GuestDone
            sessionName={activeGuestSession.name}
            participantName={me?.name || "Rekan"}
            totalPaid={paidAmount}
            paymentStatus={me?.paymentStatus || "pending_verification"}
            onRefreshStatus={() => {
              if (me?.paymentStatus === "verified") {
                addToast("Selamat! Pembayaran Anda telah Lunas diverifikasi oleh Host!", "success");
              } else {
                addToast("Host sedang memeriksa mutasi pembayaran Anda. Silakan bersabar.", "info");
              }
            }}
            onBackToClaim={() => {
              navigateTo(`/s/${sId}/claim`);
            }}
            onStartOwnSession={() => {
              navigateTo("/");
            }}
          />
        );
      }
    }

    // B. Host authenticated flows
    if (!user) {
      return (
        <LoginView
          onSuccess={(usr) => {
            setUser(usr);
            addToast(`Selamat datang, ${usr.displayName || "Host"}!`, "success");
            navigateTo("/");
          }}
          onError={(m) => addToast(m, "error")}
        />
      );
    }

    // Host login redirection fallback
    if (route === "login") {
      navigateTo("/");
      return null;
    }

    // 1. Beranda Home Dashboard
    if (route === "beranda") {
      return (
        <DashboardView
          onSelectSession={(sId) => navigateTo(`/session/${sId}/monitor`)}
          onCreateNew={() => navigateTo("/new")}
          onLogout={() => setShowLogoutModal(true)}
          onError={(m) => addToast(m, "error")}
        />
      );
    }

    // 2. Wizard Creator
    if (route === "new") {
      return (
        <CreateSessionWizard
          onSessionCreated={(sId) => navigateTo(`/session/${sId}/share`)}
          onBackToDashboard={() => navigateTo("/")}
          onError={(m) => addToast(m, "error")}
          onSuccess={(m) => addToast(m, "success")}
        />
      );
    }

    // 3. Share Sesi Link
    if (route === "host-share") {
      const sId = params.sessionId!;
      // Simple dynamic loader handled in child view on snapshot
      return (
        <div className="py-10 animate-fade-in text-center">
          <ShareSessionScreen
            sessionId={sId}
            onContinueToMonitor={() => navigateTo(`/session/${sId}/monitor`)}
            onSuccess={(m) => addToast(m, "success")}
            onError={(m) => addToast(m, "error")}
          />
        </div>
      );
    }

    // 4. Real-time monitoring dashboard
    if (route === "host-monitor") {
      const sId = params.sessionId!;
      return (
        <MonitorDashboard
          sessionId={sId}
          onBackToBeranda={() => navigateTo("/")}
          onError={(m) => addToast(m, "error")}
          onSuccess={(m) => addToast(m, "success")}
        />
      );
    }

    return (
      <div className="p-8 text-center text-xs font-bold text-red-600">
        Navigasi terputus. Mengarahkan kembali ke beranda...
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#ECECEC] flex justify-center items-start text-[#212121] selection:bg-[#00C853] selection:text-white font-sans">
      
      {/* Locked aspect ratio mobile-view container */}
      <div className="w-full max-w-[440px] min-h-screen bg-[#F5F5F5] shadow-xl md:border-x md:border-neutral-200/50 flex flex-col relative overflow-hidden">
        
        {/* Dynamic View Injection */}
        <main className="w-full flex-1">
          {renderRoute()}
        </main>

      </div>

      {/* Global Toast notifications overlay */}
      <ToastList toasts={toasts} onDismiss={dismissToast} />

      {/* Modern Pop-up Alert: Confirm Logout */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in animate-duration-150">
          <div className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 text-center border border-neutral-100/80 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4 border border-red-100/50 shadow-sm">
              <LogOut size={22} className="stroke-[2.5]" />
            </div>
            
            <h3 className="text-sm font-extrabold text-neutral-900 tracking-tight leading-snug">
              Konfirmasi Keluar
            </h3>
            
            <p className="text-neutral-500 text-[11px] font-semibold leading-relaxed mt-2 px-1">
              Apakah kamu yakin ingin keluar dari akun Host? Semua sesi patungan Anda tetap tersimpan dengan aman di server.
            </p>
            
            <div className="grid grid-cols-2 gap-2.5 mt-5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-extrabold text-[#757575] bg-neutral-100 hover:bg-neutral-200/80 cursor-pointer shadow-sm select-none transition-all active:scale-95"
              >
                Batal
              </button>
              
              <button
                onClick={async () => {
                  setShowLogoutModal(false);
                  await handleLogout();
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-extrabold text-white bg-red-600 hover:bg-red-700 cursor-pointer shadow-sm hover:shadow-red-500/10 select-none transition-all active:scale-95"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
