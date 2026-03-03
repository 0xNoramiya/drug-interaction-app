(function () {
  const STORAGE_KEY = "medicheck_language";
  const DEFAULT_LANG = "en";

  const EN_TO_ID = {
    // Auth + account
    "Sign In": "Masuk",
    "Sign in": "Masuk",
    "Create Account": "Buat Akun",
    "Create Free Account": "Buat Akun Gratis",
    "Create Your Account": "Buat Akun Anda",
    "Get Started": "Mulai",
    "Welcome Back": "Selamat Datang Kembali",
    "Register to start checking medication interactions": "Daftar untuk mulai memeriksa interaksi obat",
    "Sign in to access your medication dashboard": "Masuk untuk mengakses dashboard obat Anda",
    "Username": "Nama Pengguna",
    "Email Address": "Alamat Email",
    "Email or Username": "Email atau Nama Pengguna",
    "email or username": "email atau nama pengguna",
    "Password": "Kata Sandi",
    "Enter your username": "Masukkan nama pengguna Anda",
    "Enter your password": "Masukkan kata sandi Anda",
    "Create a password (min 8 chars)": "Buat kata sandi (min 8 karakter)",
    "Authentication failed.": "Autentikasi gagal.",

    // Landing page
    "Trusted by 50,000+ users worldwide": "Dipercaya oleh 50.000+ pengguna di seluruh dunia",
    "Stay Safe with": "Tetap Aman dengan",
    "Check medication interactions instantly. Protect yourself and your loved ones with our AI-powered drug safety platform.": "Periksa interaksi obat secara instan. Lindungi diri Anda dan orang terdekat dengan platform keamanan obat berbasis AI kami.",
    "Start Checking Free": "Mulai Cek Gratis",
    "View Demo": "Lihat Demo",
    "Free basic checks": "Cek dasar gratis",
    "No credit card required": "Tanpa kartu kredit",
    "Drug Interaction Checker": "Pemeriksa Interaksi Obat",
    "Active Users": "Pengguna Aktif",
    "Checks Performed": "Pemeriksaan Dilakukan",
    "Drug Database": "Database Obat",
    "Uptime": "Waktu Aktif",
    "Powerful Features for Your Safety": "Fitur Andalan untuk Keamanan Anda",
    "Everything you need to manage your medications safely and effectively.": "Semua yang Anda butuhkan untuk mengelola obat dengan aman dan efektif.",
    "Smart Interaction Detection": "Deteksi Interaksi Cerdas",
    "Our advanced AI analyzes drug combinations to detect potential interactions before they become problems.": "AI canggih kami menganalisis kombinasi obat untuk mendeteksi potensi interaksi sebelum menjadi masalah.",
    "Learn more": "Pelajari lebih lanjut",
    "Instant Drug Scanning": "Pemindaian Obat Instan",
    "Simply scan your prescription bottles with your camera. Our OCR technology identifies medications instantly.": "Cukup pindai botol resep Anda dengan kamera. Teknologi OCR kami mengenali obat secara instan.",
    "Bank-Level Security": "Keamanan Setara Bank",
    "Your health data is encrypted and protected with the same security standards used by leading banks.": "Data kesehatan Anda dienkripsi dan dilindungi dengan standar keamanan yang sama seperti bank terkemuka.",
    "How It Works": "Cara Kerja",
    "Check drug interactions in three simple steps": "Cek interaksi obat dalam tiga langkah sederhana",
    "Add Your Medications": "Tambahkan Obat Anda",
    "Enter drug names or scan prescription bottles with your camera.": "Masukkan nama obat atau pindai botol resep dengan kamera Anda.",
    "AI Analysis": "Analisis AI",
    "Our system checks against a comprehensive drug interaction database.": "Sistem kami memeriksa dengan database interaksi obat yang komprehensif.",
    "Get Results": "Dapatkan Hasil",
    "Receive instant alerts about potential interactions and safety advice.": "Dapatkan peringatan instan tentang potensi interaksi dan saran keamanan.",
    "Start Protecting Your Health Today": "Mulai Lindungi Kesehatan Anda Hari Ini",
    "Join thousands of users who trust MediCheck for their medication safety. Free basic checks, premium features available.": "Bergabunglah dengan ribuan pengguna yang mempercayai MediCheck untuk keamanan obat mereka. Cek dasar gratis, fitur premium tersedia.",
    "AI-powered drug interaction checking for safer medication management.": "Pemeriksaan interaksi obat berbasis AI untuk pengelolaan obat yang lebih aman.",
    "Product": "Produk",
    "Features": "Fitur",
    "Pricing": "Harga",
    "Company": "Perusahaan",
    "About": "Tentang",
    "Blog": "Blog",
    "Contact": "Kontak",
    "Legal": "Legal",
    "Privacy": "Privasi",
    "Terms": "Syarat",
    "Disclaimer": "Disclaimer",
    "© 2024 MediCheck. All rights reserved. This tool is for informational purposes only.": "© 2024 MediCheck. Seluruh hak cipta dilindungi. Alat ini hanya untuk tujuan informasi.",
    "© 2026 MediCheck. All rights reserved.": "© 2026 MediCheck. Seluruh hak cipta dilindungi.",

    // User dashboard + checks
    "Scan your drugs with OCR": "Pindai obat Anda dengan OCR",
    "Get risk-focused AI guidance": "Dapatkan panduan AI berfokus risiko",
    "Safe medication management": "Manajemen obat yang aman",
    "Submitting...": "Mengirim...",
    "Request Premium": "Ajukan Premium",
    "Manual Check": "Pemeriksaan Manual",
    "Scan Drugs": "Pindai Obat",
    "Check Interactions": "Cek Interaksi",
    "Add Drug": "Tambah Obat",
    "Enter drug name": "Masukkan nama obat",
    "Add at least 2 drugs before checking.": "Tambahkan minimal 2 obat sebelum memeriksa.",
    "Added medications:": "Obat yang ditambahkan:",
    "Add medications to check for interactions": "Tambahkan obat untuk cek interaksi",
    "Clear All": "Hapus Semua",
    "Checking...": "Memeriksa...",
    "Scan Your Drugs": "Pindai Obat Anda",
    "PNG, JPEG, or WEBP files only": "Hanya file PNG, JPEG, atau WEBP",
    "Select Images": "Pilih Gambar",
    "Scanning...": "Memindai...",
    "Selected files": "File terpilih",
    "Interaction Results": "Hasil Interaksi",
    "Detected drugs:": "Obat terdeteksi:",
    "No Interactions Found": "Tidak Ada Interaksi Ditemukan",
    "No known interactions were returned for this set.": "Tidak ada interaksi yang diketahui untuk kombinasi ini.",
    "AI Advice": "Saran AI",
    "Loading session...": "Memuat sesi...",
    "Logout": "Keluar",
    "Premium Member": "Anggota Premium",
    "Free Member": "Anggota Gratis",
    "Checks Today": "Cek Hari Ini",
    "Unlimited": "Tanpa Batas",
    "Credits Left": "Sisa Kredit",
    "Unlimited checks and OCR scans enabled.": "Cek dan OCR tanpa batas aktif.",
    "Drop image files only (PNG, JPEG, WEBP).": "Seret file gambar saja (PNG, JPEG, WEBP).",
    "No credits remaining today for manual checks.": "Kredit hari ini untuk cek manual sudah habis.",
    "Failed to check interactions.": "Gagal mengecek interaksi.",
    "Failed to scan images.": "Gagal memindai gambar.",
    "Failed to submit premium request.": "Gagal mengirim permintaan premium.",
    "Optional note for admin (max 500 chars):": "Catatan opsional untuk admin (maks 500 karakter):",

    // Admin
    "Admin Dashboard": "Dashboard Admin",
    "Admin Panel": "Panel Admin",
    "User Management": "Manajemen Pengguna",
    "All Users": "Semua Pengguna",
    "Users": "Pengguna",
    "Search users...": "Cari pengguna...",
    "Premium Requests": "Permintaan Premium",
    "Total Users": "Total Pengguna",
    "Premium Users": "Pengguna Premium",
    "Active Today": "Aktif Hari Ini",
    "Admin": "Admin",
    "Free": "Gratis",
    "User": "Pengguna",
    "Activate": "Aktifkan",
    "Deactivate": "Nonaktifkan",
    "No users found": "Tidak ada pengguna",
    "Try adjusting your search or filter criteria.": "Coba ubah pencarian atau filter.",
    "Actions": "Aksi",
  };

  const ID_TO_EN = Object.fromEntries(Object.entries(EN_TO_ID).map(([en, id]) => [id, en]));
  const PRESERVE_TEXT = new Set(["MediCheck", "Smart Drug", "Interactions", "Smart Drug Interactions"]);

  const DYNAMIC_RULES = [
    {
      enRegex: /^Welcome back,\s*(.+)$/,
      idRegex: /^Selamat datang kembali,\s*(.+)$/,
      toId: (match) => `Selamat datang kembali, ${match[1]}`,
      toEn: (match) => `Welcome back, ${match[1]}`,
    },
    {
      enRegex: /^Upload up to\s+(\d+)\s+images$/,
      idRegex: /^Unggah hingga\s+(\d+)\s+gambar$/,
      toId: (match) => `Unggah hingga ${match[1]} gambar`,
      toEn: (match) => `Upload up to ${match[1]} images`,
    },
    {
      enRegex: /^Only\s+(\d+)\s+images are allowed per scan\.$/,
      idRegex: /^Hanya\s+(\d+)\s+gambar yang diizinkan per pemindaian\.$/,
      toId: (match) => `Hanya ${match[1]} gambar yang diizinkan per pemindaian.`,
      toEn: (match) => `Only ${match[1]} images are allowed per scan.`,
    },
    {
      enRegex: /^Select up to\s+(\d+)\s+images before scanning\.$/,
      idRegex: /^Pilih hingga\s+(\d+)\s+gambar sebelum memindai\.$/,
      toId: (match) => `Pilih hingga ${match[1]} gambar sebelum memindai.`,
      toEn: (match) => `Select up to ${match[1]} images before scanning.`,
    },
    {
      enRegex: /^OCR scan requires\s+(\d+)\s+credits\.$/,
      idRegex: /^OCR scan membutuhkan\s+(\d+)\s+kredit\.$/,
      toId: (match) => `OCR scan membutuhkan ${match[1]} kredit.`,
      toEn: (match) => `OCR scan requires ${match[1]} credits.`,
    },
    {
      enRegex: /^Manual check:\s*(\d+)\s*credit\s*•\s*OCR scan:\s*(\d+)\s*credits$/,
      idRegex: /^Cek manual:\s*(\d+)\s*kredit\s*•\s*OCR scan:\s*(\d+)\s*kredit$/,
      toId: (match) => `Cek manual: ${match[1]} kredit • OCR scan: ${match[2]} kredit`,
      toEn: (match) => `Manual check: ${match[1]} credit • OCR scan: ${match[2]} credits`,
    },
    {
      enRegex: /^Not matched in database:\s*(.*)$/,
      idRegex: /^Tidak ditemukan di database:\s*(.*)$/,
      toId: (match) => `Tidak ditemukan di database: ${match[1]}`,
      toEn: (match) => `Not matched in database: ${match[1]}`,
    },
    {
      enRegex: /^Risk:\s*(.*)$/,
      idRegex: /^Risiko:\s*(.*)$/,
      toId: (match) => {
        const label = String(match[1] || "").trim().toUpperCase();
        const mapped = {
          LOW: "RENDAH",
          MODERATE: "SEDANG",
          HIGH: "TINGGI",
          UNKNOWN: "TIDAK DIKETAHUI",
        };
        return `Risiko: ${mapped[label] || match[1]}`;
      },
      toEn: (match) => {
        const label = String(match[1] || "").trim().toUpperCase();
        const mapped = {
          RENDAH: "LOW",
          SEDANG: "MODERATE",
          TINGGI: "HIGH",
          "TIDAK DIKETAHUI": "UNKNOWN",
        };
        return `Risk: ${mapped[label] || match[1]}`;
      },
    },
  ];

  function normalizeLanguage(value) {
    if (!value) return DEFAULT_LANG;
    const token = String(value).toLowerCase().replace("_", "-");
    if (token.startsWith("id") || token.startsWith("in")) return "id";
    return "en";
  }

  function getLanguage() {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
  }

  function setLanguage(lang) {
    const normalized = normalizeLanguage(lang);
    localStorage.setItem(STORAGE_KEY, normalized);
    document.documentElement.lang = normalized;
    refreshToggleState(normalized);
    applyTranslations();
  }

  function translateExact(text, lang) {
    if (lang === "id") {
      return EN_TO_ID[text] || text;
    }
    return ID_TO_EN[text] || text;
  }

  function translateDynamic(text, lang) {
    for (const rule of DYNAMIC_RULES) {
      if (lang === "id") {
        const match = text.match(rule.enRegex);
        if (match) return rule.toId(match);
      } else {
        const match = text.match(rule.idRegex);
        if (match) return rule.toEn(match);
      }
    }
    return text;
  }

  function translateTextValue(value, lang) {
    if (!value || typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (PRESERVE_TEXT.has(trimmed)) return value;

    let mapped = translateExact(trimmed, lang);
    if (mapped === trimmed) {
      mapped = translateDynamic(trimmed, lang);
    }
    if (mapped === trimmed) return value;

    const start = value.indexOf(trimmed);
    if (start === -1) return mapped;
    return `${value.slice(0, start)}${mapped}${value.slice(start + trimmed.length)}`;
  }

  function translateNodeText(node, lang) {
    const next = translateTextValue(node.nodeValue, lang);
    if (next !== node.nodeValue) {
      node.nodeValue = next;
    }
  }

  function translateElementAttributes(el, lang) {
    const attrs = ["placeholder", "title", "aria-label", "value"];
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      const next = translateTextValue(current, lang);
      if (next !== current) {
        el.setAttribute(attr, next);
      }
    }
  }

  let applying = false;

  function applyTranslations() {
    if (applying) return;
    applying = true;
    try {
      const lang = getLanguage();
      document.documentElement.lang = lang;

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }
      for (const node of textNodes) {
        if (!node || !node.parentElement) continue;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(node.parentElement.tagName)) continue;
        translateNodeText(node, lang);
      }

      const elements = document.body.querySelectorAll("*");
      for (const el of elements) {
        translateElementAttributes(el, lang);
      }
    } finally {
      applying = false;
    }
  }

  function refreshToggleState(lang) {
    const root = document.getElementById("lang-toggle");
    if (!root) return;
    const buttons = root.querySelectorAll("button[data-lang]");
    for (const button of buttons) {
      const active = button.getAttribute("data-lang") === lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.style.background = active ? "#0f766e" : "transparent";
      button.style.color = active ? "#ffffff" : "#0f766e";
    }
  }

  function createToggle() {
    if (document.getElementById("lang-toggle")) return;
    if (!document.body) return;
    const root = document.createElement("div");
    root.id = "lang-toggle";
    // Inline fallback so the switch remains visible even if i18n.css is stale/missing.
    Object.assign(root.style, {
      position: "fixed",
      right: "14px",
      bottom: "14px",
      zIndex: "99999",
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px",
      border: "1px solid #c9e6e2",
      borderRadius: "12px",
      background: "#ffffff",
      boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
    });

    const enButton = document.createElement("button");
    enButton.type = "button";
    enButton.textContent = "EN";
    enButton.setAttribute("data-lang", "en");
    enButton.setAttribute("aria-label", "Switch to English");
    Object.assign(enButton.style, {
      border: "1px solid transparent",
      borderRadius: "8px",
      background: "transparent",
      color: "#0f766e",
      fontSize: "12px",
      fontWeight: "700",
      lineHeight: "1",
      padding: "8px 10px",
      cursor: "pointer",
    });

    const idButton = document.createElement("button");
    idButton.type = "button";
    idButton.textContent = "ID";
    idButton.setAttribute("data-lang", "id");
    idButton.setAttribute("aria-label", "Ganti ke Bahasa Indonesia");
    Object.assign(idButton.style, {
      border: "1px solid transparent",
      borderRadius: "8px",
      background: "transparent",
      color: "#0f766e",
      fontSize: "12px",
      fontWeight: "700",
      lineHeight: "1",
      padding: "8px 10px",
      cursor: "pointer",
    });

    enButton.addEventListener("click", function () {
      setLanguage("en");
    });

    idButton.addEventListener("click", function () {
      setLanguage("id");
    });

    root.appendChild(enButton);
    root.appendChild(idButton);
    document.body.appendChild(root);
    refreshToggleState(getLanguage());
  }

  function ensureToggle() {
    if (!document.getElementById("lang-toggle")) {
      createToggle();
    }
  }

  function patchFetch() {
    if (window.__medicheckFetchPatched) return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
      const lang = getLanguage();
      const currentInit = init ? { ...init } : {};
      const headers = new Headers(currentInit.headers || (input instanceof Request ? input.headers : undefined));

      let isSameOrigin = true;
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const targetUrl = new URL(rawUrl, window.location.href);
        isSameOrigin = targetUrl.origin === window.location.origin;
      } catch (_) {
        isSameOrigin = true;
      }

      if (isSameOrigin && !headers.has("X-Language")) {
        headers.set("X-Language", lang);
      }
      currentInit.headers = headers;

      if (input instanceof Request) {
        const patchedRequest = new Request(input, { headers });
        return originalFetch(patchedRequest, currentInit);
      }
      return originalFetch(input, currentInit);
    };

    window.__medicheckFetchPatched = true;
  }

  function start() {
    patchFetch();
    ensureToggle();
    applyTranslations();

    const observer = new MutationObserver(function () {
      ensureToggle();
      if (!applying) {
        applyTranslations();
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "value"],
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
