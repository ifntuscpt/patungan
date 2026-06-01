<div align="center">

<br/>

<!-- LOGO -->
<svg width="72" height="72" viewBox="0 0 88 88" xmlns="http://www.w3.org/2000/svg">
  <rect width="88" height="88" rx="22" fill="url(#g)"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="88" y2="88" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#00D95F"/>
      <stop offset="100%" stop-color="#006227"/>
    </linearGradient>
  </defs>
  <path d="M22 8 L66 8 A14 14 0 0 1 80 22 L80 34 A14 14 0 0 1 66 48 L54 48 A14 14 0 0 0 40 62 L40 66 A14 14 0 0 1 26 80 L22 80 A14 14 0 0 1 8 66 L8 22 A14 14 0 0 1 22 8 Z" fill="white"/>
</svg>

# Patungan

**"Foto struk, share link, beres."**

AI-powered split bill web app — snap a receipt, let Gemini read it, share the link, everyone pays their share.

[![Made with Gemini](https://img.shields.io/badge/Gemini_2.0_Flash-4285F4?style=flat&logo=google&logoColor=white)](https://ai.google.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Cloud Run](https://img.shields.io/badge/Cloud_Run-4285F4?style=flat&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![JuaraVibeCoding](https://img.shields.io/badge/%23JuaraVibeCoding-2026-00C853?style=flat)](https://developers.google.com/)

</div>

---

## ✨ Tentang Patungan

Patungan menyelesaikan satu masalah nyata: **siapa bayar apa setelah makan bareng?**

Selama ini prosesnya ribet — foto struk, hitung manual, transfer satu-satu, tagih yang belum bayar. Patungan memotong semua langkah itu. Foto struk, AI yang baca & hitung, satu link untuk semua orang.

### Cara Kerja

```
📸 Foto struk  →  🤖 Gemini ekstrak items  →  🔗 Share link  →  ✅ Semua pilih bagiannya
```

1. **Snap** — foto struk atau upload gambar
2. **AI reads** — Gemini 2.0 Flash membaca dan mengekstrak semua item + harga otomatis
3. **Split** — setiap orang pilih item mereka sendiri lewat link
4. **Done** — total per orang dihitung otomatis, tanpa drama

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| AI / OCR | Gemini 2.0 Flash (multimodal) |
| Frontend | Vanilla JS + HTML/CSS |
| Backend | Node.js |
| Database & Auth | Firebase Firestore + Firebase Auth |
| Hosting | Google Cloud Run |
| Dev Environment | Google AI Studio |

---

## 🚀 Run Locally

**Prerequisites:** Node.js, npm

### 1. Clone & install

```bash
git clone https://github.com/your-username/patungan.git
cd patungan
npm install
```

### 2. Set up environment

Buat file `.env.local` di root project:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> Dapatkan Gemini API key gratis di [Google AI Studio](https://aistudio.google.com/apikey)

### 3. Run

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 📁 Struktur Project

```
patungan/
├── public/
│   ├── index.html        # Main app
│   └── assets/           # Icons, images
├── src/
│   ├── gemini.js         # Gemini AI integration
│   ├── firebase.js       # Firestore & Auth config
│   └── app.js            # Core app logic
├── .env.local            # Environment variables (not committed)
├── package.json
└── README.md
```

---

## 🌐 Live Demo

Coba langsung di AI Studio:
👉 [https://ai.studio/apps/fc324bf0-4cf1-462d-b0e4-9f696fcbbcd3](https://ai.studio/apps/fc324bf0-4cf1-462d-b0e4-9f696fcbbcd3)

---

## 📝 License

MIT — feel free to fork, contribute, or build on top of this.

---

<div align="center">

Built with ☕ + Gemini for **#JuaraVibeCoding 2026**

</div>
