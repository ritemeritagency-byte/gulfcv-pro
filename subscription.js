const API_BASE = window.GULFCV_RUNTIME?.apiBase || `/api`;

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

function setMessage(text, ok = false) {
  const el = document.getElementById("paymentMessage");
  el.style.color = ok ? "#11623a" : "#7d1f26";
  el.textContent = text;
}

async function loadAgency() {
  try {
    const { agency } = await api("/auth/me");
    const nextPath = window.GULFCV_ONBOARDING?.getNextPathForAgency(agency) || "/dashboard";
    document.getElementById("subInfo").textContent =
      `Agency: ${agency.agencyName} | Plan: ${agency.planName} | Status: ${agency.subscriptionStatus}`;
    if (!String(nextPath).startsWith("/subscription")) {
      window.location.href = nextPath;
    }
  } catch {
    window.location.href = "/landing";
  }
}

document.getElementById("paymentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const paymentMethod = document.getElementById("paymentMethod").value;
  const paymentReference = document.getElementById("paymentReference").value.trim();
  const paymentNote = document.getElementById("paymentNote").value.trim();

  try {
    await api("/subscription/payment-request", {
      method: "POST",
      body: JSON.stringify({ paymentMethod, paymentReference, paymentNote })
    });
    setMessage("Payment proof submitted. Wait for admin approval.", true);
    loadAgency();
  } catch (error) {
    setMessage(error.message || "Failed to submit payment.");
  }
});

document.getElementById("goLanding").addEventListener("click", () => {
  window.location.href = "/landing";
});

loadAgency();
