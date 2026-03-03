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
    lastMessage: "",
    loading: false,
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
    refreshThemeToggle();
  }

  async function persistThemeToServer(choice) {
    try {
      await fetch("/auth/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_preference: choice }),
      });
    } catch (_) {
      // Ignore when unauthenticated or network unavailable.
    }
  }

  function nextTheme(choice) {
    const idx = THEME_CHOICES.indexOf(choice);
    return THEME_CHOICES[(idx + 1) % THEME_CHOICES.length];
  }

  function themeLabel(choice) {
    if (choice === "light") return t("theme_light");
    if (choice === "dark") return t("theme_dark");
    return t("theme_system");
  }

  function refreshThemeToggle() {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const choice = getThemeChoice();
    button.textContent = `${t("theme_label")}: ${themeLabel(choice)}`;
  }

  function createThemeToggle() {
    if (document.getElementById("theme-toggle") || !document.body) return;
    const button = document.createElement("button");
    button.id = "theme-toggle";
    button.type = "button";
    button.addEventListener("click", async function () {
      const updated = nextTheme(getThemeChoice());
      applyTheme(updated);
      await persistThemeToServer(updated);
    });
    document.body.appendChild(button);
    refreshThemeToggle();
  }

  function ensureThemeToggle() {
    if (!document.getElementById("theme-toggle")) {
      createThemeToggle();
    }
  }

  function isDashboardRoute() {
    return window.location.pathname === "/dashboard";
  }

  function formatTime(ts) {
    try {
      return new Date(Number(ts) * 1000).toLocaleString();
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

  async function loadHistory() {
    if (!isDashboardRoute()) return;
    historyState.loading = true;
    renderHistoryWidget();
    try {
      historyState.entries = await fetchJson("/history?limit=10");
    } catch (_) {
      historyState.entries = [];
    } finally {
      historyState.loading = false;
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
      await navigator.clipboard.writeText(text);
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

  function openSummaryPdf(entryId) {
    const url = `/history/${entryId}/summary.pdf`;
    window.open(url, "_blank", "noopener,noreferrer");
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
    if (!root) return;

    root.innerHTML = `
      <div class="hx-card">
        <h4>${esc(t("history_title"))}</h4>
        <p class="hx-meta">${esc(t("history_desc"))}</p>
        ${historyState.lastMessage ? `<p class="hx-meta" style="margin-top:8px;">${esc(historyState.lastMessage)}</p>` : ""}
        <div style="margin-top: 10px;">${renderHistoryRows()}</div>
      </div>
    `;

    root.querySelectorAll("button[data-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        const entryId = Number(button.getAttribute("data-entry-id"));
        const action = button.getAttribute("data-action");
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
      });
    });
  }

  function ensureHistoryWidget() {
    if (!document.body) return;
    const existing = document.getElementById("history-widget");
    if (!isDashboardRoute()) {
      if (existing) existing.remove();
      return;
    }

    const host = document.querySelector("main .max-w-5xl");
    if (!host) return;

    if (!existing) {
      const section = document.createElement("section");
      section.id = "history-widget";
      host.appendChild(section);
      loadHistory();
    }
    renderHistoryWidget();
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
          window.setTimeout(function () {
            loadHistory();
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
      ensureThemeToggle();
      ensureHistoryWidget();
    }, 80);
  }

  function start() {
    applyTheme(getThemeChoice());
    ensureThemeToggle();
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

    const observer = new MutationObserver(function () {
      scheduleWidgetRefresh();
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
