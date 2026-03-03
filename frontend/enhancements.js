(function () {
  const THEME_KEY = "medicheck_theme";
  const LANG_KEY = "medicheck_language";
  const THEME_CHOICES = ["system", "light", "dark"];

  const TEXT = {
    en: {
      theme_label: "Theme",
      theme_system: "System",
      theme_light: "Light",
      theme_dark: "Dark",
      open_profile: "Profile",
      back_dashboard: "Back to Dashboard",
      profile_title: "My Profile",
      profile_desc: "Account information and plan status.",
      username: "Username",
      plan: "Plan",
      member_since: "Member Since",
      checks_today: "Checks Today",
      credits_left: "Credits Left",
      user_id: "User ID",
      premium_member: "Premium Member",
      free_member: "Free Member",
      unlimited: "Unlimited",
      profile_loading: "Loading profile...",
      profile_load_failed: "Failed to load profile.",
      reload: "Reload",
      history_title: "Recent Checks",
      history_desc: "Last 10 checks. Generate, copy, or download a summary to share with your physician.",
      loading: "Loading...",
      no_history: "No check history yet.",
      check_type: "Type",
      checked_at: "Checked",
      interactions: "Interactions",
      drugs: "Drugs",
      generate_summary: "Generate AI Summary",
      copy_summary: "Copy Summary",
      download_pdf: "Download PDF",
      pdf_failed: "Failed to download PDF.",
      copied: "Summary copied.",
      copy_failed: "Failed to copy summary.",
      summary_failed: "Failed to generate summary.",
      physician_summary: "Physician Summary",
      recommendations: "Recommendations",
      key_points: "Key Points",
      risk: "Risk",
      manual: "Manual",
      ocr: "Scan",
    },
    id: {
      theme_label: "Tema",
      theme_system: "Sistem",
      theme_light: "Terang",
      theme_dark: "Gelap",
      open_profile: "Profil",
      back_dashboard: "Kembali ke Dashboard",
      profile_title: "Profil Saya",
      profile_desc: "Informasi akun dan status paket.",
      username: "Nama Pengguna",
      plan: "Paket",
      member_since: "Bergabung Sejak",
      checks_today: "Cek Hari Ini",
      credits_left: "Sisa Kredit",
      user_id: "ID Pengguna",
      premium_member: "Anggota Premium",
      free_member: "Anggota Gratis",
      unlimited: "Tanpa Batas",
      profile_loading: "Memuat profil...",
      profile_load_failed: "Gagal memuat profil.",
      reload: "Muat Ulang",
      history_title: "Riwayat Pemeriksaan",
      history_desc: "10 pemeriksaan terakhir. Buat, salin, atau unduh ringkasan untuk dibagikan ke dokter.",
      loading: "Memuat...",
      no_history: "Belum ada riwayat pemeriksaan.",
      check_type: "Tipe",
      checked_at: "Waktu",
      interactions: "Interaksi",
      drugs: "Obat",
      generate_summary: "Buat Ringkasan AI",
      copy_summary: "Salin Ringkasan",
      download_pdf: "Unduh PDF",
      pdf_failed: "Gagal mengunduh PDF.",
      copied: "Ringkasan disalin.",
      copy_failed: "Gagal menyalin ringkasan.",
      summary_failed: "Gagal membuat ringkasan.",
      physician_summary: "Ringkasan Dokter",
      recommendations: "Rekomendasi",
      key_points: "Poin Penting",
      risk: "Risiko",
      manual: "Manual",
      ocr: "Scan",
    },
  };

  const historyState = {
    entries: [],
    profile: null,
    loading: false,
    profileLoading: false,
    historyLoaded: false,
    profileLoaded: false,
    lastMessage: "",
  };

  let widgetRefreshTimer = null;

  function getLanguage() {
    const raw = String(localStorage.getItem(LANG_KEY) || "en").toLowerCase();
    return raw.startsWith("id") || raw.startsWith("in") ? "id" : "en";
  }

  function t(key) {
    const lang = getLanguage();
    const dict = TEXT[lang] || TEXT.en;
    return dict[key] || TEXT.en[key] || key;
  }

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getThemeChoice() {
    const raw = String(localStorage.getItem(THEME_KEY) || "system").toLowerCase();
    return THEME_CHOICES.includes(raw) ? raw : "system";
  }

  function resolveTheme(choice) {
    if (choice === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return choice;
  }

  function applyTheme(choice) {
    const normalized = THEME_CHOICES.includes(choice) ? choice : "system";
    const resolved = resolveTheme(normalized);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.setAttribute("data-theme-choice", normalized);
    localStorage.setItem(THEME_KEY, normalized);
  }

  async function persistThemeToServer(choice) {
    try {
      const response = await fetch("/auth/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_preference: choice }),
      });
      return response.ok;
    } catch (_) {
      // Ignore when unauthenticated or network unavailable.
      return false;
    }
  }

  function updateThemeChoiceButtons(choice) {
    const root = document.getElementById("history-widget");
    if (!root) return;
    root.querySelectorAll("button[data-theme-choice]").forEach(function (button) {
      const current = String(button.getAttribute("data-theme-choice") || "").toLowerCase();
      button.classList.toggle("is-active", current === choice);
    });
  }

  function setThemePreference(choice) {
    const normalized = THEME_CHOICES.includes(choice) ? choice : "system";
    applyTheme(normalized);
    if (historyState.profile && historyState.profile.user) {
      historyState.profile.user.theme_preference = normalized;
    }
    updateThemeChoiceButtons(normalized);
    persistThemeToServer(normalized).catch(function () {
      // Keep optimistic UI even if persistence fails.
    });
  }

  function isDashboardRoute() {
    const path = String(window.location.pathname || "").replace(/\/+$/, "");
    const hash = String(window.location.hash || "").toLowerCase();
    if (hash.startsWith("#/")) {
      return /^#\/dashboard(?:[/?]|$)/.test(hash);
    }
    return path.endsWith("/dashboard");
  }

  function isProfileView() {
    if (!isDashboardRoute()) return false;
    const hash = String(window.location.hash || "").toLowerCase();
    if (hash.startsWith("#/")) {
      return /(?:\?|&)view=profile(?:&|$)/.test(hash);
    }
    return hash === "#profile" || hash.startsWith("#profile/") || hash.includes("/profile");
  }

  function usingHashRouter() {
    const hash = String(window.location.hash || "");
    return hash.startsWith("#/");
  }

  function dashboardHref() {
    if (usingHashRouter()) {
      return "#/dashboard";
    }

    const path = String(window.location.pathname || "").replace(/\/+$/, "");
    const base = path.endsWith("/dashboard") ? path : "/dashboard";
    return `${base}${window.location.search || ""}`;
  }

  function profileHref() {
    if (usingHashRouter()) {
      return "#/dashboard?view=profile";
    }
    return `${dashboardHref()}#profile`;
  }

  function findDashboardHost() {
    return (
      document.querySelector("main .max-w-5xl") ||
      document.querySelector("main [class*='max-w-']") ||
      document.querySelector("main")
    );
  }

  function findDashboardHeaderActions() {
    const groups = Array.from(document.querySelectorAll("header .flex.items-center.gap-4"));
    for (const group of groups) {
      const buttons = Array.from(group.querySelectorAll("button"));
      if (!buttons.length) continue;
      if (buttons.some((btn) => /logout|keluar/i.test(String(btn.textContent || "").trim()))) {
        return group;
      }
    }
    return groups[0] || null;
  }

  function ensureProfileButton() {
    const existing = document.getElementById("open-profile-btn");
    if (!isDashboardRoute()) {
      if (existing) existing.remove();
      return;
    }

    const host = findDashboardHeaderActions();
    if (!host) return;

    let button = existing;
    if (button && button.parentElement !== host) {
      button.remove();
      button = null;
    }

    if (!button) {
      button = document.createElement("a");
      button.id = "open-profile-btn";
      button.href = profileHref();
      button.className = "inline-flex items-center justify-center rounded-xl border border-teal-200 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-50";
      host.insertBefore(button, host.lastElementChild || null);
    }

    button.href = profileHref();
    button.textContent = t("open_profile");
    button.style.display = isProfileView() ? "none" : "inline-flex";
  }

  function setDashboardSectionsHidden(hidden) {
    const host = findDashboardHost();
    if (!host) return;
    Array.from(host.children).forEach(function (node) {
      if (!(node instanceof HTMLElement)) return;
      if (node.id === "history-widget") return;
      if (hidden) {
        if (node.getAttribute("data-profile-hidden") !== "1") {
          node.setAttribute("data-profile-hidden", "1");
          node.style.display = "none";
        }
      } else if (node.getAttribute("data-profile-hidden") === "1") {
        node.removeAttribute("data-profile-hidden");
        node.style.display = "";
      }
    });
  }

  function formatTime(ts) {
    try {
      return new Date(Number(ts) * 1000).toLocaleString();
    } catch (_) {
      return "-";
    }
  }

  function formatDate(ts) {
    try {
      return new Date(Number(ts) * 1000).toLocaleDateString();
    } catch (_) {
      return "-";
    }
  }

  async function fetchJson(url, init) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text().catch(function () {
        return "";
      });
      const error = new Error(text || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function loadHistory(force) {
    if (!isDashboardRoute() || historyState.loading) return;
    if (historyState.historyLoaded && !force) return;
    historyState.loading = true;
    renderHistoryWidget();
    try {
      historyState.entries = await fetchJson("/history?limit=10");
    } catch (_) {
      historyState.entries = [];
    } finally {
      historyState.loading = false;
      historyState.historyLoaded = true;
      renderHistoryWidget();
    }
  }

  async function loadProfile(force) {
    if (!isDashboardRoute() || historyState.profileLoading) return;
    if (historyState.profileLoaded && !force) return;
    historyState.profileLoading = true;
    renderHistoryWidget();
    try {
      historyState.profile = await fetchJson("/auth/me");
      const serverTheme = String(historyState.profile?.user?.theme_preference || "").toLowerCase();
      if (THEME_CHOICES.includes(serverTheme) && serverTheme !== getThemeChoice()) {
        applyTheme(serverTheme);
      }
    } catch (_) {
      historyState.profile = null;
    } finally {
      historyState.profileLoading = false;
      historyState.profileLoaded = true;
      renderHistoryWidget();
    }
  }

  function summaryToText(entry, summary) {
    const lines = [];
    lines.push(summary.title || t("physician_summary"));
    lines.push(`${t("checked_at")}: ${formatTime(entry.created_at)}`);
    lines.push(`${t("check_type")}: ${entry.check_type === "ocr" ? t("ocr") : t("manual")}`);
    lines.push(`${t("risk")}: ${String(summary.risk_level || "unknown").toUpperCase()}`);
    lines.push("");
    lines.push(summary.summary || "");
    lines.push("");
    lines.push(`${t("key_points")}:`);
    (summary.key_points || []).forEach(function (item) {
      lines.push(`- ${item}`);
    });
    lines.push("");
    lines.push(`${t("recommendations")}:`);
    (summary.recommendations || []).forEach(function (item) {
      lines.push(`- ${item}`);
    });
    if (summary.disclaimer) {
      lines.push("");
      lines.push(summary.disclaimer);
    }
    return lines.join("\n");
  }

  async function ensureSummary(entryId, force) {
    return fetchJson(`/history/${entryId}/summary${force ? "?force=true" : ""}`, {
      method: "POST",
    });
  }

  async function copySummary(entry) {
    try {
      const summary = entry.physician_summary || (await ensureSummary(entry.id, false));
      const text = summaryToText(entry, summary);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "readonly");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.focus();
        area.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(area);
        if (!copied) {
          throw new Error("Copy command failed");
        }
      }
      historyState.lastMessage = t("copied");
      if (!entry.physician_summary) {
        entry.physician_summary = summary;
      }
      renderHistoryWidget();
    } catch (_) {
      historyState.lastMessage = t("copy_failed");
      renderHistoryWidget();
    }
  }

  async function openSummaryPdf(entryId) {
    const url = `/history/${entryId}/summary.pdf`;
    try {
      const response = await fetch(url, { method: "GET", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const pdfBlob = await response.blob();
      const objectUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `medicheck-summary-${entryId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 5000);
    } catch (_) {
      historyState.lastMessage = t("pdf_failed");
      renderHistoryWidget();
    }
  }

  async function regenerateSummary(entry) {
    try {
      const summary = await ensureSummary(entry.id, true);
      entry.physician_summary = summary;
      historyState.lastMessage = "";
      renderHistoryWidget();
    } catch (_) {
      historyState.lastMessage = t("summary_failed");
      renderHistoryWidget();
    }
  }

  function renderProfileCardBody() {
    if (historyState.profileLoading) {
      return `<p class="hx-meta">${esc(t("profile_loading"))}</p>`;
    }
    if (!historyState.profile || !historyState.profile.user || !historyState.profile.quota) {
      return `
        <p class="hx-meta">${esc(t("profile_load_failed"))}</p>
        <div class="hx-actions" style="margin-top: 10px;">
          <button class="hx-btn" id="hx-reload-profile" type="button">${esc(t("reload"))}</button>
        </div>
      `;
    }

    const user = historyState.profile.user;
    const quota = historyState.profile.quota;
    const planLabel = user.is_premium ? t("premium_member") : t("free_member");
    const credits = user.is_premium ? t("unlimited") : String(quota.remaining_today ?? 0);
    const currentTheme = THEME_CHOICES.includes(String(user.theme_preference || "").toLowerCase())
      ? String(user.theme_preference || "").toLowerCase()
      : getThemeChoice();

    return `
      <div class="hx-profile-grid">
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("username"))}</span>
          <strong>${esc(user.email)}</strong>
        </div>
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("plan"))}</span>
          <strong class="hx-plan-badge">${esc(planLabel)}</strong>
        </div>
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("member_since"))}</span>
          <strong>${esc(formatDate(user.created_at))}</strong>
        </div>
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("checks_today"))}</span>
          <strong>${esc(String(quota.used_today ?? 0))}</strong>
        </div>
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("credits_left"))}</span>
          <strong>${esc(credits)}</strong>
        </div>
        <div class="hx-profile-item">
          <span class="hx-profile-label">${esc(t("user_id"))}</span>
          <strong>${esc(String(user.id))}</strong>
        </div>
        <div class="hx-profile-item hx-profile-item-theme">
          <span class="hx-profile-label">${esc(t("theme_label"))}</span>
          <div class="hx-theme-options">
            <button class="hx-btn hx-theme-btn ${currentTheme === "system" ? "is-active" : ""}" data-theme-choice="system" type="button">${esc(t("theme_system"))}</button>
            <button class="hx-btn hx-theme-btn ${currentTheme === "light" ? "is-active" : ""}" data-theme-choice="light" type="button">${esc(t("theme_light"))}</button>
            <button class="hx-btn hx-theme-btn ${currentTheme === "dark" ? "is-active" : ""}" data-theme-choice="dark" type="button">${esc(t("theme_dark"))}</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderHistoryRows() {
    if (historyState.loading) {
      return `<p class="hx-meta">${esc(t("loading"))}</p>`;
    }
    if (!historyState.entries.length) {
      return `<p class="hx-meta">${esc(t("no_history"))}</p>`;
    }

    return historyState.entries
      .map(function (entry) {
        const risk = String(
          (entry.physician_summary && entry.physician_summary.risk_level) ||
            (entry.advice && entry.advice.risk_level) ||
            "unknown"
        ).toUpperCase();
        const summary = entry.physician_summary;
        const meds = (entry.extracted_drugs && entry.extracted_drugs.length
          ? entry.extracted_drugs
          : entry.input_drugs || []
        ).join(", ");

        const summaryHtml = summary
          ? `
            <div class="hx-summary">
              <strong>${esc(summary.title || t("physician_summary"))}</strong>
              <div class="hx-meta">${esc(t("risk"))}: ${esc(risk)}</div>
              <p>${esc(summary.summary || "")}</p>
            </div>
          `
          : "";

        return `
          <div class="hx-row" data-entry-id="${entry.id}">
            <div class="hx-meta">#${entry.id} • ${esc(t("check_type"))}: ${esc(entry.check_type === "ocr" ? t("ocr") : t("manual"))} • ${esc(t("checked_at"))}: ${esc(formatTime(entry.created_at))}</div>
            <div class="hx-meta">${esc(t("interactions"))}: ${Number((entry.interactions || []).length)} • ${esc(t("risk"))}: ${esc(risk)}</div>
            <div class="hx-meta">${esc(t("drugs"))}: ${esc(meds)}</div>
            <div class="hx-actions">
              <button class="hx-btn" data-action="regen" data-entry-id="${entry.id}">${esc(t("generate_summary"))}</button>
              <button class="hx-btn" data-action="copy" data-entry-id="${entry.id}">${esc(t("copy_summary"))}</button>
              <button class="hx-btn" data-action="pdf" data-entry-id="${entry.id}">${esc(t("download_pdf"))}</button>
            </div>
            ${summaryHtml}
          </div>
        `;
      })
      .join("");
  }

  function renderHistoryWidget() {
    const root = document.getElementById("history-widget");
    if (!root || !isProfileView()) return;

    root.innerHTML = `
      <div class="hx-page-head">
        <a id="hx-back-dashboard" class="hx-btn hx-back-btn" href="${esc(dashboardHref())}">${esc(t("back_dashboard"))}</a>
      </div>
      <div class="hx-card">
        <h4>${esc(t("profile_title"))}</h4>
        <p class="hx-meta">${esc(t("profile_desc"))}</p>
        <div style="margin-top: 10px;">${renderProfileCardBody()}</div>
      </div>
      <div class="hx-card" style="margin-top: 12px;">
        <h4>${esc(t("history_title"))}</h4>
        <p class="hx-meta">${esc(t("history_desc"))}</p>
        ${historyState.lastMessage ? `<p class="hx-meta" style="margin-top:8px;">${esc(historyState.lastMessage)}</p>` : ""}
        <div style="margin-top: 10px;">${renderHistoryRows()}</div>
      </div>
    `;

  }

  function bindHistoryWidgetClickHandlers() {
    if (window.__medicheckProfileClicksBound) return;
    const getEventTargetElement = function (event) {
      const raw = event.target;
      if (raw instanceof Element) return raw;
      if (raw && raw.parentElement instanceof Element) return raw.parentElement;
      return null;
    };
    const handleClick = function (event) {
      const target = getEventTargetElement(event);
      if (!target) return;

      const reloadBtn = target.closest("#hx-reload-profile");
      if (reloadBtn) {
        event.preventDefault();
        loadProfile(true);
        return;
      }

      const themeBtn = target.closest("button[data-theme-choice]");
      if (themeBtn) {
        event.preventDefault();
        const choice = String(themeBtn.getAttribute("data-theme-choice") || "system").toLowerCase();
        setThemePreference(choice);
        return;
      }

      const actionBtn = target.closest("button[data-action]");
      if (!actionBtn) return;
      event.preventDefault();
      const entryId = Number(actionBtn.getAttribute("data-entry-id"));
      const action = actionBtn.getAttribute("data-action");
      const entry = historyState.entries.find(function (item) {
        return Number(item.id) === entryId;
      });
      if (!entry) return;

      if (action === "regen") {
        regenerateSummary(entry);
        return;
      }
      if (action === "copy") {
        copySummary(entry);
        return;
      }
      if (action === "pdf") {
        openSummaryPdf(entryId);
      }
    };
    const handlePointerDown = function (event) {
      const target = getEventTargetElement(event);
      if (!target) return;
      const themeBtn = target.closest("button[data-theme-choice]");
      if (!themeBtn) return;
      event.preventDefault();
      event.stopPropagation();
      const choice = String(themeBtn.getAttribute("data-theme-choice") || "system").toLowerCase();
      setThemePreference(choice);
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.__medicheckProfileClicksBound = true;
  }

  function ensureHistoryWidget() {
    if (!document.body) return;

    ensureProfileButton();

    const existing = document.getElementById("history-widget");
    if (!isDashboardRoute()) {
      setDashboardSectionsHidden(false);
      if (existing) existing.remove();
      return;
    }

    if (!isProfileView()) {
      setDashboardSectionsHidden(false);
      if (existing) existing.remove();
      return;
    }

    const host = findDashboardHost();
    if (!host) return;

    setDashboardSectionsHidden(true);

    let section = existing;
    if (section && section.parentElement !== host) {
      section.remove();
      section = null;
    }

    if (!section) {
      section = document.createElement("section");
      section.id = "history-widget";
      host.prepend(section);
    }

    renderHistoryWidget();
    loadProfile(false);
    loadHistory(false);
  }

  function patchFetchForHistoryRefresh() {
    if (window.__medicheckHistoryFetchPatched) return;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async function (input, init) {
      const response = await originalFetch(input, init);
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const targetUrl = new URL(rawUrl, window.location.href);
        const isSameOrigin = targetUrl.origin === window.location.origin;
        if (isSameOrigin && response.ok && (targetUrl.pathname === "/check" || targetUrl.pathname === "/check/ocr")) {
          historyState.historyLoaded = false;
          historyState.profileLoaded = false;
          window.setTimeout(function () {
            loadHistory(true);
            loadProfile(true);
          }, 350);
        }
      } catch (_) {
        // Ignore parse errors.
      }
      return response;
    };

    window.__medicheckHistoryFetchPatched = true;
  }

  function scheduleWidgetRefresh() {
    if (widgetRefreshTimer) {
      clearTimeout(widgetRefreshTimer);
    }
    widgetRefreshTimer = setTimeout(function () {
      ensureHistoryWidget();
    }, 80);
  }

  function isManagedNode(node) {
    if (!node) return false;
    const element =
      node instanceof Element
        ? node
        : node.parentElement instanceof Element
          ? node.parentElement
          : null;
    if (!element) return false;
    return Boolean(
      element.closest("#history-widget") ||
        element.closest("#open-profile-btn") ||
        element.closest("#lang-toggle")
    );
  }

  function shouldRefreshFromMutations(mutations) {
    for (const mutation of mutations) {
      if (!isManagedNode(mutation.target)) {
        return true;
      }
      for (const node of Array.from(mutation.addedNodes || [])) {
        if (!isManagedNode(node)) return true;
      }
      for (const node of Array.from(mutation.removedNodes || [])) {
        if (!isManagedNode(node)) return true;
      }
    }
    return false;
  }

  function start() {
    applyTheme(getThemeChoice());
    bindHistoryWidgetClickHandlers();
    patchFetchForHistoryRefresh();
    ensureHistoryWidget();

    if (window.matchMedia) {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const listener = function () {
        if (getThemeChoice() === "system") {
          applyTheme("system");
        }
      };
      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", listener);
      } else if (typeof media.addListener === "function") {
        media.addListener(listener);
      }
    }

    const observer = new MutationObserver(function (mutations) {
      if (shouldRefreshFromMutations(mutations)) {
        scheduleWidgetRefresh();
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: false,
      characterData: false,
    });

    window.addEventListener("popstate", scheduleWidgetRefresh);
    window.addEventListener("hashchange", scheduleWidgetRefresh);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
