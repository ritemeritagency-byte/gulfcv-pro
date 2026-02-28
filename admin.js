const API_BASE = window.GULFCV_RUNTIME?.apiBase || "http://localhost:3000/api";

const adminLoginPanel = document.getElementById("adminLoginPanel");
const adminSessionPanel = document.getElementById("adminSessionPanel");
const adminSessionText = document.getElementById("adminSessionText");
const adminEmailInput = document.getElementById("adminEmail");
const adminPasswordInput = document.getElementById("adminPassword");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminLoadBtn = document.getElementById("loadBtn");
const adminList = document.getElementById("adminList");

function setMsg(text, ok = false) {
  const el = document.getElementById("adminMsg");
  el.style.color = ok ? "#11623a" : "#7d1f26";
  el.textContent = text;
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

function setSessionUi(admin) {
  const signedIn = Boolean(admin);
  adminLoginPanel.classList.toggle("hidden", signedIn);
  adminSessionPanel.classList.toggle("hidden", !signedIn);
  if (signedIn) {
    adminSessionText.textContent = `Signed in as ${admin.email} (${admin.role})`;
  } else {
    adminSessionText.textContent = "Signed in.";
    adminList.textContent = "";
  }
}

async function refreshSession() {
  try {
    const { admin } = await api("/admin/auth/me");
    setSessionUi(admin);
  } catch {
    setSessionUi(null);
  }
}

async function loginAdmin() {
  const email = String(adminEmailInput.value || "").trim().toLowerCase();
  const password = String(adminPasswordInput.value || "");
  if (!email || !password) {
    setMsg("Enter admin email and password.");
    return;
  }
  try {
    const { admin } = await api("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    adminPasswordInput.value = "";
    setSessionUi(admin);
    setMsg("Admin session active.", true);
  } catch (error) {
    setMsg(error.message || "Could not sign in.");
  }
}

async function logoutAdmin() {
  try {
    await api("/admin/auth/logout", { method: "POST" });
  } catch {
    // Ignore and clear UI.
  }
  setSessionUi(null);
  setMsg("Signed out.", true);
}

function createAgencyCard(agency) {
  const card = document.createElement("div");
  card.style.border = "1px solid #d5deee";
  card.style.borderRadius = "10px";
  card.style.padding = "10px";
  card.style.margin = "8px 0";

  const title = document.createElement("strong");
  title.textContent = agency.agencyName || "-";
  card.appendChild(title);

  const email = document.createElement("span");
  email.textContent = ` (${agency.email || "-"})`;
  card.appendChild(email);
  card.appendChild(document.createElement("br"));

  const usageLine = document.createElement("span");
  usageLine.textContent =
    `Plan: ${agency.planName || "-"} | Usage: ${agency.cvsCreated || 0}/${agency.cvLimit || 0} | Status: ${agency.subscriptionStatus || "-"}`;
  card.appendChild(usageLine);
  card.appendChild(document.createElement("br"));

  const paymentLine = document.createElement("span");
  paymentLine.textContent = `Payment: ${agency.paymentMethod || "-"} / ${agency.paymentReference || "-"}`;
  card.appendChild(paymentLine);
  card.appendChild(document.createElement("br"));

  const activateBtn = document.createElement("button");
  activateBtn.type = "button";
  activateBtn.dataset.id = agency.id || "";
  activateBtn.disabled = agency.subscriptionStatus === "active";
  activateBtn.textContent = "Activate";
  activateBtn.addEventListener("click", async () => {
    try {
      await api(`/admin/agencies/${encodeURIComponent(activateBtn.dataset.id)}/activate`, {
        method: "POST"
      });
      setMsg("Agency activated.", true);
      await loadAgencies();
    } catch (error) {
      setMsg(error.message || "Could not activate agency.");
    }
  });
  card.appendChild(activateBtn);

  return card;
}

async function loadAgencies() {
  try {
    const { agencies } = await api("/admin/agencies");
    adminList.textContent = "";
    if (!agencies || !agencies.length) {
      adminList.textContent = "No agencies yet.";
      setMsg("Loaded agencies.", true);
      return;
    }
    const frag = document.createDocumentFragment();
    agencies.forEach((agency) => {
      frag.appendChild(createAgencyCard(agency));
    });
    adminList.appendChild(frag);
    setMsg("Loaded agencies.", true);
  } catch (error) {
    setMsg(error.message || "Load failed.");
  }
}

adminLoginBtn?.addEventListener("click", () => {
  void loginAdmin();
});
adminPasswordInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void loginAdmin();
  }
});
adminLoadBtn?.addEventListener("click", () => {
  void loadAgencies();
});
adminLogoutBtn?.addEventListener("click", () => {
  void logoutAdmin();
});

void refreshSession();
