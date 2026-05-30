import React, { useState, useRef } from "react";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, OperationType, handleFirestoreError, auth } from "../firebase";
import { ReceiptItem, Participant, PaymentInfo, Session } from "../types";
import { formatIDR, calculateSessionFinance } from "../utils/calculations";
import { Camera, Plus, Trash2, ArrowRight, ArrowLeft, Check, Copy, Share2, Upload, Receipt, UserMinus, AlertCircle, Users, BarChart3, CreditCard, Lock, QrCode, Image, ClipboardList } from "lucide-react";

interface CreateSessionWizardProps {
  onSessionCreated: (sessionId: string) => void;
  onBackToDashboard: () => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function CreateSessionWizard({ onSessionCreated, onBackToDashboard, onError, onSuccess }: CreateSessionWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingOCR, setLoadingOCR] = useState(false);

  // Form states matching data model
  const [sessionName, setSessionName] = useState("Patungan " + new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'short' }));
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  // Pre-populate Host as the first participant on mount
  React.useEffect(() => {
    const user = auth.currentUser;
    if (user && participants.length === 0) {
      const emailName = user.email ? user.email.split("@")[0] : "";
      const hostName = user.displayName || (emailName ? emailName.charAt(0).toUpperCase() + emailName.slice(1) : "Host");
      setParticipants([
        {
          id: "host_" + generateUUID(),
          name: hostName,
          claimedItems: [],
          subtotal: 0,
          taxPortion: 0,
          servicePortion: 0,
          total: 0,
          hasRoundingBurden: false,
          paymentStatus: "unclaimed",
          proofImageUrl: null
        }
      ]);
    }
  }, []);

  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);

  // Temporary payment state
  const [bankName, setBankName] = useState(() => {
    try {
      return localStorage.getItem("prev_bankName") || "";
    } catch (_) {
      return "";
    }
  });
  const [accountNumber, setAccountNumber] = useState(() => {
    try {
      return localStorage.getItem("prev_accountNumber") || "";
    } catch (_) {
      return "";
    }
  });
  const [accountName, setAccountName] = useState(() => {
    try {
      return localStorage.getItem("prev_accountName") || "";
    } catch (_) {
      return "";
    }
  });
  const [qrisImage, setQrisImage] = useState<string | null>(() => {
    try {
      return localStorage.getItem("prev_qrisImage") || null;
    } catch (_) {
      return null;
    }
  });

  // New item temp input
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");

  // New participant temp input
  const [newParticipantName, setNewParticipantName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const receiptCameraRef = useRef<HTMLInputElement>(null);
  const receiptGalleryRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        onError("Gambar QRIS terlalu besar. Batas maksimal ukuran adalah 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrisImage(reader.result as string);
        onSuccess("QRIS berhasil diunggah.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper: generate unique IDs for local additions
  const generateUUID = () => Math.random().toString(36).substring(2, 9);

  // --- Step 1: Receipt OCR Operations ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      onError("Gambar struk terlalu besar. Batas maksimal ukuran adalah 15MB.");
      return;
    }

    setLoadingOCR(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        await triggerOCRAPI(base64String, file.type);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      onError("Gagal membaca dokumen gambar.");
      setLoadingOCR(false);
    }
  };

  const triggerOCRAPI = async (base64Data: string, mimeType: string) => {
    try {
      const resp = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data, mimeType })
      });

      if (!resp.ok) {
        throw new Error("Pengecekan server-side gagal. Pastikan struk utuh dan jelas.");
      }

      const result = await resp.json();

      // Extracted states mapping
      if (result.items && Array.isArray(result.items)) {
        const mappedItems: ReceiptItem[] = result.items.map((i: any) => ({
          id: generateUUID(),
          name: i.name || "Menu Tanpa Nama",
          price: parseInt(i.price) || 0,
          quantity: parseInt(i.quantity) || 1,
          claimedBy: []
        }));
        setItems(mappedItems);
        
        // Count subtotal items
        const subtotal = mappedItems.reduce((acc, el) => acc + (el.price * el.quantity), 0);
        setTaxAmount(result.taxAmount || 0);
        setServiceCharge(result.serviceCharge || 0);
        setGrandTotal(result.grandTotal || (subtotal + (result.taxAmount || 0) + (result.serviceCharge || 0)));
        onSuccess("Struk belanja Anda berhasil diekstrak oleh Gemini AI.");
      }
    } catch (e: any) {
      console.error(e);
      onError("OCR Gagal: Gemini AI kesulitan mendeteksi struk. Silakan isi daftar item secara manual di bawah.");
    } finally {
      setLoadingOCR(false);
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemPrice || !newItemQuantity) {
      onError("Nama item, harga per unit, dan kuantiti diperlukan.");
      return;
    }
    const priceInt = parseInt(newItemPrice.replace(/\D/g, ""), 10);
    const quantityInt = parseInt(newItemQuantity);
    if (isNaN(priceInt) || isNaN(quantityInt) || priceInt < 0 || quantityInt < 1) {
      onError("Masukkan nominal harga atau kuantiti yang valid.");
      return;
    }

    const item: ReceiptItem = {
      id: generateUUID(),
      name: newItemName.trim(),
      price: priceInt,
      quantity: quantityInt,
      claimedBy: []
    };

    const newItems = [...items, item];
    setItems(newItems);
    
    // Auto-calculate grand total based on new items sum unless set custom
    const subtotal = newItems.reduce((acc, el) => acc + (el.price * el.quantity), 0);
    setGrandTotal(subtotal + taxAmount + serviceCharge);

    setNewItemName("");
    setNewItemPrice("");
    setNewItemQuantity("1");
    onSuccess("Menu ditambahkan.");
  };

  const handleRemoveItem = (id: string) => {
    const updated = items.filter(it => it.id !== id);
    setItems(updated);
    const subtotal = updated.reduce((acc, el) => acc + (el.price * el.quantity), 0);
    setGrandTotal(subtotal + taxAmount + serviceCharge);
  };

  const handleEditItemField = (id: string, field: "name" | "price" | "quantity", value: string) => {
    const updated = items.map(it => {
      if (it.id === id) {
        if (field === "name") return { ...it, name: value };
        const numVal = parseInt(value) || 0;
        return { ...it, [field]: numVal };
      }
      return it;
    });
    setItems(updated);
    const subtotal = updated.reduce((acc, el) => acc + (el.price * el.quantity), 0);
    setGrandTotal(subtotal + taxAmount + serviceCharge);
  };

  // --- Step 2: Manage Participants ---
  const handleAddParticipant = () => {
    const nameTrim = newParticipantName.trim();
    if (!nameTrim) return;

    if (participants.some(p => p.name.toLowerCase() === nameTrim.toLowerCase())) {
      onError("Nama peserta ini sudah ada.");
      return;
    }

    const user: Participant = {
      id: generateUUID(),
      name: nameTrim,
      claimedItems: [],
      subtotal: 0,
      taxPortion: 0,
      servicePortion: 0,
      total: 0,
      hasRoundingBurden: false,
      paymentStatus: "unclaimed",
      proofImageUrl: null
    };

    setParticipants([...participants, user]);
    setNewParticipantName("");
    onSuccess(`Peserta "${nameTrim}" terdaftar.`);
  };

  const handleRemoveParticipant = (id: string) => {
    if (id.startsWith("host_")) {
      onError("Pembuat sesi (Host) tidak dapat dihapus.");
      return;
    }
    setParticipants(participants.filter(p => p.id !== id));
  };

  // --- Step 3: Bank Details ---
  const handleQrisUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrisImage(reader.result as string);
      onSuccess("QRIS berhasil diunggah.");
    };
    reader.readAsDataURL(file);
  };

  // --- Step 4: Review and Save via Firestore ---
  const createSessionLink = async () => {
    const user = auth.currentUser;
    if (!user) {
      onError("Anda harus login untuk membuat sesi.");
      return;
    }

    if (items.length === 0) {
      onError("Daftar item belanja/patungan kosong. Harap tambahkan minimal 1 item.");
      setStep(1);
      return;
    }

    if (participants.length < 2) {
      onError("Patungan membutuhkan minimal 2 peserta.");
      setStep(2);
      return;
    }

    const hasBankDetails = bankName.trim() !== "" && accountNumber.trim() !== "";
    const hasQris = qrisImage !== null;
    if (!hasBankDetails && !hasQris) {
      onError("Lengkapi detail transfer bank / OVO / GoPay ATAU unggah QRIS pada Langkah 3.");
      setStep(3);
      return;
    }

    setLoading(true);

    try {
      const sessionId = "session_" + Date.now();
      const sessionsCol = collection(db, "sessions");
      const subtotalItems = items.reduce((acc, el) => acc + (el.price * el.quantity), 0);

      // Get a default account name if none provided and bank details exist
      let finalAccountName = accountName.trim();
      if (hasBankDetails && !finalAccountName) {
        finalAccountName = participants[0]?.name || auth.currentUser?.displayName || "Host";
      }

      // Construct empty fields as initial values
      const sessionData: Session = {
        id: sessionId,
        hostId: user.uid,
        hostEmail: user.email || "",
        name: sessionName.trim() || "Sesi Patungan Bersama",
        createdAt: serverTimestamp(),
        status: "claiming",
        items: items,
        participants: participants,
        taxAmount: taxAmount,
        serviceCharge: serviceCharge,
        subtotalItems: subtotalItems,
        grandTotal: grandTotal,
        roundingAmount: 0,
        luckyDrawWinnerId: null,
        paymentInfo: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: finalAccountName,
          qrisImageUrl: qrisImage
        }
      };

      // Set document in Firestore
      await setDoc(doc(sessionsCol, sessionId), sessionData);

      // Save payment info to localStorage for next time
      try {
        localStorage.setItem("prev_bankName", bankName.trim());
        localStorage.setItem("prev_accountNumber", accountNumber.trim());
        localStorage.setItem("prev_accountName", finalAccountName);
        if (qrisImage) {
          localStorage.setItem("prev_qrisImage", qrisImage);
        } else {
          localStorage.removeItem("prev_qrisImage");
        }
      } catch (e) {
        console.warn("localStorage save failed:", e);
      }

      onSuccess("Sesi Patungan Berhasil Dibuat!");
      onSessionCreated(sessionId);
    } catch (err: any) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.CREATE, "sessions");
      } catch (e: any) {
        onError("Gagal menerbitkan sesi ke database Firestore.");
      }
    } finally {
      setLoading(false);
    }
  };

  // UI state subtotal
  const subtotalSumList = items.reduce((acc, el) => acc + (el.price * el.quantity), 0);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-6 px-4">
      {/* ProgressBar Top */}
      <div className="bg-neutral-0 rounded-2xl p-4 border border-neutral-200 shadow-1">
        <div className="flex justify-between items-center text-xs font-semibold mb-2.5">
          <span className="text-green-600 font-extrabold uppercase tracking-wide">Langkah {step} dari 4</span>
          <span className="text-neutral-500 font-bold">
            {step === 1 && "Unggah Struk & Menu"}
            {step === 2 && "Daftar Rekan Patungan"}
            {step === 3 && "Pajak & Informasi Transfer"}
            {step === 4 && "Review & Generate Link"}
          </span>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                s < step
                  ? "bg-green-500"
                  : s === step
                  ? "bg-green-300"
                  : "bg-neutral-100 border border-neutral-200/40"
              }`}
            ></div>
          ))}
        </div>
      </div>

      {/* STEP 1: Receipt Upload & OCR LINE ITEMS */}
      {step === 1 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 shadow-1 flex flex-col gap-4">
            <h3 className="font-extrabold text-sm text-neutral-900 flex items-center gap-2 uppercase tracking-wide">
              <div className="emoji-icon emoji-icon--sm emoji-icon--green">
                <Camera size={16} className="stroke-[2.5]" />
              </div>
              <span>Gunakan AI Gemini OCR</span>
            </h3>

            {/* OCR Snapshot Area */}
            <div
              className={`border-2 border-dashed rounded-2xl p-4.5 flex flex-col items-center justify-center gap-3 transition-all relative ${
                loadingOCR
                  ? "border-green-500 bg-green-50/50 cursor-not-allowed text-center p-6"
                  : "border-neutral-200 bg-neutral-50/60"
              }`}
            >
              {/* Separate Hidden Input Nodes for Precise Device Ingress Control */}
              <input
                type="file"
                ref={receiptCameraRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                capture="environment"
              />
              <input
                type="file"
                ref={receiptGalleryRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {loadingOCR ? (
                <div className="py-4 flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold text-green-600 animate-pulse">
                      Gemini sedang membaca...
                    </p>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      Mengekstrak item dan harga dari struk (3-8 dtk)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  {/* Option 1: Live Camera Capture */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      receiptCameraRef.current?.click();
                    }}
                    className="flex items-center gap-3.5 p-3.5 bg-white border border-neutral-200 hover:border-green-500/50 rounded-2xl cursor-pointer transition-all active:scale-[0.98] hover:shadow-sm animate-scale-in"
                  >
                    <div className="w-10 h-10 rounded-xl bg-green-50/80 text-green-650 flex items-center justify-center shrink-0 border border-green-100">
                      <Camera size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-extrabold text-neutral-850">Ambil Foto Struk (Kamera)</p>
                      <p className="text-[10px] text-neutral-450 font-medium mt-0.5 leading-snug">
                        Gunakan kamera ponsel untuk mengambil foto struk secara langsung
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Choose File / Gallery */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      receiptGalleryRef.current?.click();
                    }}
                    className="flex items-center gap-3.5 p-3.5 bg-white border border-neutral-200 hover:border-green-500/50 rounded-2xl cursor-pointer transition-all active:scale-[0.98] hover:shadow-sm animate-scale-in"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50/80 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <Image size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-extrabold text-neutral-850">Pilih dari Galeri / File</p>
                      <p className="text-[10px] text-neutral-450 font-medium mt-0.5 leading-snug">
                        Gunakan foto struk yang sudah Anda ambil atau simpan sebelumnya
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Edit Session name */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wilder">Nama Sesi Acara</label>
              <input
                type="text"
                placeholder="Ramen Sanpachi 25 Mei"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full bg-neutral-0 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-sans"
              />
            </div>
          </div>

          <div className="bg-neutral-0 rounded-3xl p-5 border border-neutral-200/80 shadow-2 flex flex-col gap-4 font-sans">
            <h3 className="font-extrabold text-sm text-neutral-900 tracking-tight border-b border-neutral-100 pb-3 flex items-center gap-2">
              <ClipboardList size={18} className="text-[#00C853] shrink-0 stroke-[2.5]" />
              <span>Daftar Item Patungan</span>
            </h3>
 
            {/* Editable Line Items Table */}
            {items.length === 0 ? (
              <p className="text-xs text-neutral-400 font-semibold text-center py-6">
                Belum ada item. Silakan ambil foto struk di atas atau tambahkan item baru secara manual di bawah.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {/* Table Headers */}
                <div className="grid grid-cols-12 gap-2 px-3 pb-1 text-[9px] font-extrabold text-neutral-400 uppercase tracking-wider select-none">
                  <span className="col-span-5">Nama Barang / Jasa</span>
                  <span className="col-span-2 text-center">Banyak</span>
                  <span className="col-span-4 text-right">Harga</span>
                  <span className="col-span-1"></span>
                </div>

                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 p-2.5 bg-neutral-50/70 hover:bg-neutral-50 border border-neutral-200/60 hover:border-green-500/50 rounded-2xl transition-all items-center">
                    <div className="col-span-5 min-w-0">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEditItemField(item.id, "name", e.target.value)}
                        className="w-full bg-transparent font-extrabold text-xs text-neutral-800 focus:outline-none focus:ring-0 truncate"
                        placeholder="Nama item"
                      />
                    </div>
                    <div className="col-span-2 flex justify-center">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleEditItemField(item.id, "quantity", e.target.value)}
                        className="w-10 bg-white border border-neutral-200 rounded-lg text-xs py-1 text-center font-extrabold focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-neutral-800"
                      />
                    </div>
                    <div className="col-span-4 relative flex items-center">
                      <span className="absolute left-2 text-[9px] font-extrabold text-neutral-400 select-none">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={item.price === 0 ? "" : new Intl.NumberFormat("id-ID").format(item.price)}
                        onChange={(e) => {
                          const digitsVal = e.target.value.replace(/\D/g, "");
                          handleEditItemField(item.id, "price", digitsVal);
                        }}
                        className="w-full pl-6 pr-2 py-1 bg-white border border-neutral-200 rounded-lg text-xs font-mono font-extrabold text-right focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 text-neutral-800"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 size={13} className="stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
 
            {/* Add Custom Item */}
            <div className="border-t border-neutral-100 pt-4 flex flex-col gap-2">
              <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Input Item Manual</p>
              <div className="flex flex-col gap-2 sm:grid sm:grid-cols-12 sm:gap-2">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    placeholder="Nama item (misal: Tiket Bioskop, Kaos, Kopi)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold placeholder:text-neutral-400 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all"
                  />
                </div>
                <div className="grid grid-cols-12 gap-2 sm:col-span-6">
                  <div className="col-span-7">
                    <div className="flex items-center bg-neutral-50 border border-neutral-200 rounded-xl px-3 shadow-2 shadow-neutral-100/50 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/10 transition-all">
                      <span className="text-[10px] text-neutral-400 font-extrabold mr-1.5 shrink-0 select-none">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Harga"
                        value={newItemPrice}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "");
                          if (!digits) {
                            setNewItemPrice("");
                          } else {
                            setNewItemPrice(new Intl.NumberFormat("id-ID").format(parseInt(digits, 10)));
                          }
                        }}
                        className="w-full bg-transparent border-none p-2 text-xs font-bold text-neutral-800 focus:outline-none placeholder:text-neutral-400 font-mono"
                      />
                    </div>
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl py-2.5 text-xs text-neutral-800 focus:outline-none text-center font-extrabold placeholder:text-neutral-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/10 transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full h-full min-h-[38px] bg-green-500 text-white rounded-xl flex items-center justify-center hover:bg-green-600 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm shadow-green-500/15"
                      title="Tambah Item"
                    >
                      <Plus size={16} className="stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
 
          {/* Action buttons */}
          <div className="flex gap-3 mt-1 font-sans">
            <button
              onClick={onBackToDashboard}
              className="flex-1 border border-neutral-200 hover:bg-neutral-50 text-neutral-500 font-extrabold py-3 rounded-xl text-xs transition-colors cursor-pointer text-center select-none active:scale-98"
            >
              Kembali
            </button>
            <button
              onClick={() => {
                if (items.length === 0) {
                  onError("Harap isikan daftar item patungan terlebih dahulu.");
                  return;
                }
                setStep(2);
              }}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white font-extrabold py-3 rounded-xl text-xs tracking-tight transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-green-500/10 active:scale-98 select-none"
            >
              <span>Lanjut</span>
              <ArrowRight size={14} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: ADD PARTICIPANTS CHIPS */}
      {step === 2 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 shadow-1 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="emoji-icon emoji-icon--md emoji-icon--blue">
                <Users size={22} className="stroke-[2.5]" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-extrabold text-base text-neutral-900">Masukkan Rekan Patungan</h3>
                <p className="text-xs text-neutral-500 leading-relaxed font-medium">
                  Anda (Host) sudah terdaftar otomatis di bawah. Silakan tambahkan nama teman-teman Anda demi kalkulasi merata.
                </p>
              </div>
            </div>

            {/* Input list */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Tulis nama rekan (misal: Budi, Sinta, Rio)"
                value={newParticipantName}
                onChange={(e) => setNewParticipantName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddParticipant();
                  }
                }}
                className="flex-1 bg-neutral-0 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-sans"
              />
              <button
                onClick={handleAddParticipant}
                className="btn-primary-gradient text-white text-xs font-extrabold rounded-xl px-5 flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-green"
              >
                Tambah
              </button>
            </div>

            {/* Display Chips */}
            <div className="mt-2 space-y-2">
              <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                Teman Terdaftar ({participants.length})
              </p>
              {participants.length === 0 ? (
                <p className="text-xs text-neutral-400 italic font-medium">Belum ada teman terdaftar.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {participants.map((person) => {
                    const isHost = person.id.startsWith("host_");
                    return (
                      <div
                        key={person.id}
                        className="bg-neutral-50 text-neutral-900 border border-neutral-200 px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-extrabold shadow-sm select-none"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>{person.name}</span>
                          {isHost && (
                            <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded font-extrabold uppercase scale-90 select-none">
                              Host
                            </span>
                          )}
                        </span>
                        {!isHost ? (
                          <button
                            onClick={() => handleRemoveParticipant(person.id)}
                            className="text-neutral-500 hover:text-red-500 transition-colors cursor-pointer"
                            title="Hapus"
                          >
                            <UserMinus size={13} className="stroke-[2.5]" />
                          </button>
                        ) : (
                          <Lock size={12} className="text-neutral-400 shrink-0 stroke-[2.5]" title="Host tidak bisa dihapus" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-neutral-0 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 font-extrabold py-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-1"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
              <span>Kembali</span>
            </button>
            <button
              onClick={() => {
                if (participants.length < 2) {
                  onError("Rekan patungan minimal adalah 2 orang.");
                  return;
                }
                setStep(3);
              }}
              className="flex-1 btn-primary-gradient text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-green active:scale-95"
            >
              <span>Lanjut</span>
              <ArrowRight size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: TAX & PAYMENT INFO */}
      {step === 3 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Section 1: Financial Extra Fees */}
          <div className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 shadow-1 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="emoji-icon emoji-icon--md emoji-icon--neutral">
                <BarChart3 size={22} className="stroke-[2.5]" />
              </div>
              <h3 className="font-extrabold text-base text-neutral-900 border-none pb-0">Biaya Tambahan di Struk</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Total Pajak (PB1/PPN)</label>
                <div className="flex items-center bg-neutral-0 border border-neutral-200 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/10 rounded-xl px-3 py-2 transition-all">
                  <span className="text-xs text-neutral-400 font-extrabold mr-1 font-mono">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={taxAmount === 0 ? "" : new Intl.NumberFormat("id-ID").format(taxAmount)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                      setTaxAmount(val);
                      setGrandTotal(subtotalSumList + val + serviceCharge);
                    }}
                    placeholder="0"
                    className="bg-transparent w-full font-extrabold focus:outline-none text-sm text-right text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Service Charge</label>
                <div className="flex items-center bg-neutral-0 border border-neutral-200 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/10 rounded-xl px-3 py-2 transition-all">
                  <span className="text-xs text-neutral-400 font-extrabold mr-1 font-mono">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={serviceCharge === 0 ? "" : new Intl.NumberFormat("id-ID").format(serviceCharge)}
                    onChange={(e) => {
                      const val = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                      setServiceCharge(val);
                      setGrandTotal(subtotalSumList + taxAmount + val);
                    }}
                    placeholder="0"
                    className="bg-transparent w-full font-extrabold focus:outline-none text-sm text-right text-neutral-900 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200/60 rounded-xl p-3 flex justify-between items-center text-xs">
              <span className="text-neutral-600 font-bold">Grand Total Terkalkulasi:</span>
              <span className="font-extrabold text-green-600 text-sm font-mono">{formatIDR(grandTotal)}</span>
            </div>
            
            {/* Override grand total */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider leading-relaxed">Sesuaikan Grand Total Kasir (bila ada diskon/pembulatan)</label>
              <div className="flex items-center bg-neutral-0 border border-neutral-200 focus-within:border-green-500 focus-within:ring-4 focus-within:ring-green-500/10 rounded-xl px-4 py-2.5 transition-all">
                <span className="text-xs text-neutral-400 font-extrabold mr-1 font-mono">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={grandTotal === 0 ? "" : new Intl.NumberFormat("id-ID").format(grandTotal)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/\D/g, ""), 10) || 0;
                    setGrandTotal(val);
                  }}
                  className="bg-transparent w-full font-extrabold focus:outline-none text-sm text-right text-neutral-900 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Host Transfer Account Details */}
          <div className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 shadow-1 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="emoji-icon emoji-icon--md emoji-icon--purple">
                <CreditCard size={22} className="stroke-[2.5]" />
              </div>
              <h3 className="font-extrabold text-base text-neutral-900 border-none pb-0">Informasi Rekening Host</h3>
            </div>
            <p className="text-xs text-neutral-500 font-medium leading-relaxed">
              Informasi ini akan ditampilkan langsung kepada rekan Anda agar mereka dapat melakukan pembayaran transfer dengan mudah.
            </p>

            <div className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Nama Bank / Dompet Digital</label>
                <input
                  type="text"
                  placeholder="Misal: BCA, Bank Mandiri, GoPay, OVO"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full bg-neutral-0 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Nomor Rekening</label>
                  <input
                    type="text"
                    placeholder="Misal: 522030123"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full bg-neutral-0 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Atas Nama Pemilik</label>
                  <input
                    type="text"
                    placeholder="Misal: Budi Anto"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="w-full bg-neutral-0 border border-neutral-200 rounded-xl px-4 py-3 text-xs font-bold text-neutral-900 focus:outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all font-sans"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-1.5">
                <label className="block text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Unggah QRIS (Opsional)</label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleQrisUpload}
                  accept="image/*"
                  className="hidden"
                />

                {!qrisImage ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all duration-250 ${
                      isDragging
                        ? "border-green-500 bg-green-50/30 text-green-600 scale-[1.01]"
                        : "border-neutral-200 hover:border-green-500 hover:bg-neutral-50 bg-neutral-0 text-neutral-500"
                    }`}
                  >
                    <div className={`p-3 rounded-2xl transition-all duration-250 ${isDragging ? "bg-green-150 text-green-600 shadow-sm" : "bg-neutral-50 border border-neutral-150 text-neutral-400 group-hover:scale-105"}`}>
                      <Upload size={18} className="stroke-[2.5]" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-extrabold text-neutral-800 leading-snug">
                        Klik untuk pilih / seret gambar QRIS
                      </p>
                      <p className="text-[10px] text-neutral-400 font-bold mt-1">
                        Format JPG, PNG, atau WEBP (Maks. 5MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-neutral-50/50 border border-neutral-200/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm animate-fade-in">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative w-12 h-12 rounded-xl border border-neutral-200/80 bg-neutral-0 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                        <img
                          src={qrisImage}
                          alt="QRIS Preview"
                          className="w-full h-full object-cover transition-transform duration-250 hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-neutral-850 truncate">QRIS Berhasil Diunggah</p>
                        <p className="text-[10px] text-green-600 font-extrabold flex items-center gap-1.5 mt-1 leading-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                          QRIS Siap Digunakan
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-neutral-0 border border-neutral-200 hover:border-neutral-300 text-neutral-600 text-[10px] font-extrabold px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 shadow-sm"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQrisImage(null);
                          onSuccess("Kliping QRIS dihapus.");
                        }}
                        className="bg-red-50/40 border border-red-200 hover:border-red-300 text-red-600 text-[10px] font-extrabold px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 shadow-sm"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-neutral-0 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 font-extrabold py-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-1"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
              <span>Kembali</span>
            </button>
            <button
              onClick={() => {
                const hasBankDetails = bankName.trim() !== "" && accountNumber.trim() !== "";
                const hasQris = qrisImage !== null;
                if (!hasBankDetails && !hasQris) {
                  onError("Lengkapi detail transfer bank / OVO / GoPay ATAU unggah QRIS.");
                  return;
                }
                setStep(4);
              }}
              className="flex-1 btn-primary-gradient text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-green"
            >
              <span>Review Sesi</span>
              <ArrowRight size={16} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW AND FINAL GENERATE LINK */}
      {step === 4 && (
        <div className="flex flex-col gap-5 animate-fade-in">
          <div className="bg-neutral-0 rounded-2xl p-5 border border-neutral-200 shadow-1 flex flex-col gap-4">
            <div className="border-b border-neutral-100 pb-3 flex items-start gap-3">
              <div className="emoji-icon emoji-icon--md emoji-icon--blue">
                <Receipt size={22} className="stroke-[2.5]" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-450 uppercase tracking-wider font-extrabold leading-none mb-1">Nama Sesi Patungan</p>
                <h3 className="font-extrabold text-base text-neutral-900">{sessionName}</h3>
              </div>
            </div>

            {/* Financial math review */}
            <div className="flex flex-col gap-2.5 bg-neutral-50 rounded-2xl p-4 border border-neutral-200/50">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-neutral-500">Subtotal Item ({items.length} Menu)</span>
                <span className="text-neutral-900 font-mono font-extrabold">{formatIDR(subtotalSumList)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-neutral-500">Portasi Pajak</span>
                <span className="text-neutral-900 font-mono font-extrabold">{formatIDR(taxAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-neutral-500">Service Charge</span>
                <span className="text-neutral-900 font-mono font-extrabold">{formatIDR(serviceCharge)}</span>
              </div>
              <hr className="border-t border-neutral-200 my-1" />
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-neutral-900">Grand Total Acara</span>
                <span className="font-extrabold text-green-600 text-sm font-mono">{formatIDR(grandTotal)}</span>
              </div>
            </div>

            {/* Rekan List Summary */}
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">
                Rekan Patungan Tergabung ({participants.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {participants.map((person) => {
                  const isHost = person.id.startsWith("host_");
                  return (
                    <span
                      key={person.id}
                      className="text-xs bg-neutral-50 text-neutral-900 border border-neutral-200 px-3 py-1.5 rounded-full font-bold shadow-sm cursor-default inline-flex items-center gap-1.5"
                    >
                      <span>{person.name}</span>
                      {isHost && (
                        <span className="text-[8px] bg-green-500 text-white px-1.5 py-0.5 rounded font-extrabold uppercase scale-90 select-none">
                          Host
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Dest Bank review */}
            <div className="rounded-xl border border-neutral-200 p-4 text-xs flex flex-col gap-2.5 bg-neutral-50">
              <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-wider">Metode Pembayaran Host</p>
              {(bankName.trim() || accountNumber.trim()) ? (
                <div className="space-y-1.5">
                  {bankName.trim() && (
                    <div className="flex justify-between font-bold">
                      <span className="text-neutral-500">Bank/E-Wallet:</span>
                      <span className="text-neutral-900">{bankName}</span>
                    </div>
                  )}
                  {accountNumber.trim() && (
                    <div className="flex justify-between font-bold">
                      <span className="text-neutral-500">No. Rekening:</span>
                      <span className="text-neutral-950 font-mono tracking-wide">{accountNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span className="text-neutral-500">Atas Nama:</span>
                    <span className="text-neutral-900">{accountName.trim() || (participants[0]?.name || auth.currentUser?.displayName || "Host")}</span>
                  </div>
                </div>
              ) : null}
              {qrisImage && (
                <div className="flex items-center gap-2 text-green-700 font-extrabold bg-green-50 px-2.5 py-1.5 rounded-md border border-green-200 mt-1">
                  <QrCode size={14} className="stroke-[2.5]" />
                  <span>Code QRIS Tersemat Aktif</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setStep(3)}
              disabled={loading}
              className="flex-1 bg-neutral-0 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 font-extrabold py-3.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-1"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
              <span>Kembali</span>
            </button>
            <button
              onClick={createSessionLink}
              disabled={loading}
              id="btn-create-session-link"
              className="flex-1 btn-primary-gradient text-white font-extrabold py-3.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-green disabled:opacity-50 active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Check size={16} className="stroke-[2.5]" />
                  <span>Buat Link Sesi</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
