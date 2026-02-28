const API_BASE = window.GULFCV_RUNTIME?.apiBase || "http://localhost:3000/api";

const historyList = document.getElementById("historyList");
const historyStatus = document.getElementById("historyStatus");
const historySearch = document.getElementById("historySearch");
const historyRefreshBtn = document.getElementById("historyRefreshBtn");
const historyPrevBtn = document.getElementById("historyPrevBtn");
const historyNextBtn = document.getElementById("historyNextBtn");
const historyPageInfo = document.getElementById("historyPageInfo");
const historyLogoutBtn = document.getElementById("historyLogoutBtn");

const PAGE_SIZE = 20;
let currentPage = 1;
let totalRecords = 0;
let currentRecords = [];

function sanitizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRecordDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function applySearch(records) {
  const query = sanitizeText(historySearch?.value || "").toLowerCase();
  if (!query) {
    return records;
  }
  return records.filter((record) => {
    const candidate = sanitizeText(record.candidateName).toLowerCase();
    const reference = sanitizeText(record.referenceNo).toLowerCase();
    return candidate.includes(query) || reference.includes(query);
  });
}

function renderHistory(records) {
  const visible = applySearch(records);
  if (!visible.length) {
    historyList.innerHTML = "<p>No records found for this page/filter.</p>";
    return;
  }
  historyList.innerHTML = visible
    .map((record) => {
      const candidate = escapeHtml(record.candidateName || "-");
      const reference = escapeHtml(record.referenceNo || "-");
      const source = escapeHtml(record.source || "manual");
      const createdAt = escapeHtml(formatRecordDate(record.createdAt));
      const recordId = encodeURIComponent(record.id || "");
      return `<article class="history-row"><div><h3>${candidate}</h3><p class="history-meta">Ref: ${reference} | ${source} | ${createdAt}</p></div><a href="/dashboard?recordId=${recordId}&view=preview" target="_blank" rel="noopener">Open Preview</a></article>`;
    })
    .join("");
}

async function loadPage(page = 1) {
  const safePage = Math.max(1, Math.trunc(page));
  const offset = (safePage - 1) * PAGE_SIZE;
  historyStatus.textContent = "Loading history...";
  try {
    const { records, total, limit } = await api(`/cv-records?limit=${PAGE_SIZE}&offset=${offset}`);
    currentPage = safePage;
    totalRecords = Number(total || 0);
    currentRecords = Array.isArray(records) ? records : [];
    renderHistory(currentRecords);
    const pageSize = Number(limit || PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
    historyPageInfo.textContent = `Page ${currentPage} of ${totalPages} | ${totalRecords} total`;
    historyPrevBtn.disabled = currentPage <= 1;
    historyNextBtn.disabled = currentPage >= totalPages;
    historyStatus.textContent = totalRecords ? "Select a record to preview the exact saved CV." : "No CV records yet.";
  } catch (error) {
    if (/session|unauthorized|missing/i.test(error.message || "")) {
      window.location.href = "/auth?mode=signin";
      return;
    }
    historyStatus.textContent = error.message || "Failed to load history.";
    historyList.innerHTML = "";
  }
}

historySearch?.addEventListener("input", () => {
  renderHistory(currentRecords);
});

historyRefreshBtn?.addEventListener("click", () => {
  void loadPage(currentPage);
});

historyPrevBtn?.addEventListener("click", () => {
  void loadPage(currentPage - 1);
});

historyNextBtn?.addEventListener("click", () => {
  void loadPage(currentPage + 1);
});

historyLogoutBtn?.addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Ignore and continue redirect.
  }
  window.location.href = "/landing";
});

async function init() {
  try {
    await api("/auth/me");
    await loadPage(1);
  } catch {
    window.location.href = "/auth?mode=signin";
  }
}

void init();
