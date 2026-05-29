import { Session, Participant } from "../types";
import { User } from "lucide-react";

interface GuestNameSelectionProps {
  session: Session;
  onNameSelected: (participantId: string) => void;
}

export function GuestNameSelection({ session, onNameSelected }: GuestNameSelectionProps) {
  // Filter participants that haven't finalized or are available.
  // Wait, guests can select any name in case they made a mistake or need to resume their session!
  // So showing all names as choice cards is excellent.
  const handleSelect = (personId: string) => {
    onNameSelected(personId);
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6 px-4 py-8 animate-fade-in font-sans">
      <div className="w-full bg-neutral-0 rounded-3xl p-6.5 border border-neutral-200 shadow-2 flex flex-col gap-6">
        
        {/* Guest welcoming header */}
        <div className="text-center flex flex-col items-center gap-1.5 pb-5 border-b border-neutral-100">
          <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-200/50">
            <User size={20} className="stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-extrabold text-neutral-900 mt-2 tracking-tight">Siapa Anda?</h2>
          <p className="text-xs text-neutral-500 leading-relaxed font-semibold max-w-xs">
            Selamat datang di sesi patungan <span className="font-extrabold text-green-600">"{session.name}"</span>. 
            Silakan pilih nama Anda untuk klaim item patungan.
          </p>
        </div>

        {/* List Grid cards */}
        <div>
          <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider mb-3 px-1">
            Daftar Peserta Patungan
          </p>

          <div className="grid grid-cols-2 gap-3">
            {session.participants.map((person) => {
              const initial = person.name.substring(0, 1).toUpperCase();
              
              const isVerified = person.paymentStatus === "verified";
              const isPending = person.paymentStatus === "pending_verification";
              const isClaimed = person.paymentStatus === "claimed";

              return (
                <div
                  key={person.id}
                  onClick={() => handleSelect(person.id)}
                  className="bg-neutral-50 hover:bg-green-50/10 border border-neutral-200 hover:border-green-500 p-4 rounded-2xl flex flex-col items-center text-center gap-2.5 transition-all active:scale-[0.97] cursor-pointer group shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 font-extrabold flex items-center justify-center text-sm group-hover:scale-105 transition-transform shrink-0 border border-green-200/50">
                    {initial}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs text-neutral-900 truncate max-w-[124px] flex items-center justify-center gap-1">
                      <span>{person.name}</span>
                      {person.id.startsWith("host_") && (
                        <span className="text-[8px] bg-green-500 text-white px-1 py-0.2 rounded font-extrabold uppercase shrink-0 scale-90">
                          Host
                        </span>
                      )}
                    </h3>
                    
                    {/* Status hint of selections */}
                    <div className="mt-1.5">
                      {isVerified && (
                        <span className="text-[9px] bg-green-100 text-green-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          Lunas
                        </span>
                      )}
                      {isPending && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          Verifikasi
                        </span>
                      )}
                      {isClaimed && (
                        <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          Claimed
                        </span>
                      )}
                      {!isVerified && !isPending && !isClaimed && (
                        <span className="text-[9px] bg-neutral-200/60 text-neutral-600 font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                          Belum Klaim
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Small security assurance footer */}
        <p className="text-[10px] text-center text-neutral-450 max-w-[240px] mx-auto leading-relaxed font-semibold italic">
          Bila nama Anda tidak tercantum, silakan hubungi Host untuk didaftarkan ke sesi patungan.
        </p>
      </div>
    </div>
  );
}
