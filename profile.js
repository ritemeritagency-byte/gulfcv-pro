const API_BASE = window.GULFCV_RUNTIME?.apiBase || `/api`;
const pageParams = new URLSearchParams(window.location.search);
const isOnboardingProfileMode = pageParams.get("onboarding") === "1";

let agencyCache = null;
let agencyLogoData = "";
let fraLogoData = "";

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
  const el = document.getElementById("profileMessage");
  el.style.color = ok ? "#11623a" : "#7d1f26";
  el.textContent = text;
}

function getPostLoginPath(agency) {
  return window.GULFCV_ONBOARDING?.getNextPathForAgency(agency) || "/dashboard";
}

function makeLogoPlaceholder(label) {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='260' height='96'><rect width='100%' height='100%' fill='#eaf1ff'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='16' fill='#5c6f93' font-family='Arial'>${label}</text></svg>`
    )
  );
}

function setLogoPreview(id, src, fallbackLabel) {
  const image = document.getElementById(id);
  if (!image) {
    return;
  }
  image.src = src || makeLogoPlaceholder(fallbackLabel);
}

function readAndResizeImage(file, maxW = 700, maxH = 220, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Only image files are allowed."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Could not load image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function fill(agency) {
  const profile = agency.profile || {};
  const used = Number(agency.cvsCreated || 0);
  const limit = Number(agency.cvLimit || 0);
  const remaining = Math.max(limit - used, 0);
  const usagePct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const statusText = String(agency.subscriptionStatus || "unknown")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
  const setupStep = String(agency?.onboarding?.step || "completed")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());

  document.getElementById("profileInfo").textContent =
    `Plan: ${agency.planName} | Usage: ${used}/${limit} | Status: ${statusText} | Setup: ${setupStep}`;
  document.getElementById("metricPlan").textContent = agency.planName || "-";
  document.getElementById("metricUsage").textContent = `${used} / ${limit}`;
  document.getElementById("metricRemaining").textContent = String(remaining);
  document.getElementById("usagePct").textContent = `${usagePct}%`;

  const usageBar = document.getElementById("usageBar");
  usageBar.style.width = `${usagePct}%`;

  const statusEl = document.getElementById("metricStatus");
  statusEl.textContent = statusText;
  statusEl.className = "status-pill";
  if (agency.subscriptionStatus === "active") {
    statusEl.classList.add("status-active");
  } else if (agency.subscriptionStatus === "pending_approval" || agency.subscriptionStatus === "pending_payment") {
    statusEl.classList.add("status-pending");
  } else {
    statusEl.classList.add("status-warning");
  }

  document.getElementById("agencyName").value = agency.agencyName || "";
  document.getElementById("agencyNameAr").value = profile.agencyNameAr || "";
  document.getElementById("agencyTagline").value = profile.agencyTagline || "";
  document.getElementById("agencyPhone").value = profile.agencyPhone || "";
  document.getElementById("agencyEmail").value = profile.agencyEmail || "";
  document.getElementById("agencyWebsite").value = profile.agencyWebsite || "";
  document.getElementById("agencyAddress").value = profile.agencyAddress || "";
  document.getElementById("agencySocial1").value = profile.agencySocial1 || "";
  document.getElementById("agencySocial2").value = profile.agencySocial2 || "";
  agencyLogoData = profile.agencyLogo || "";
  fraLogoData = profile.fraLogo || "";
  setLogoPreview("agencyLogoThumb", agencyLogoData, "PH Logo");
  setLogoPreview("fraLogoThumb", fraLogoData, "FRA Logo");

  const goDashboard = document.getElementById("goDashboard");
  if (goDashboard) {
    const nextPath = getPostLoginPath(agency);
    const pendingSetup = !String(nextPath).startsWith("/dashboard");
    goDashboard.textContent = pendingSetup ? "Continue Setup" : "Open CV Builder";
  }
}

async function loadProfile() {
  try {
    const { agency } = await api("/auth/me");
    const nextPath = getPostLoginPath(agency);
    if (String(nextPath).startsWith("/subscription")) {
      window.location.href = nextPath;
      return;
    }
    if (agency?.onboarding?.step === "welcome") {
      window.location.href = "/onboarding?step=welcome";
      return;
    }
    agencyCache = agency;
    fill(agency);
  } catch (error) {
    if (/session|unauthorized|missing/i.test(error.message || "")) {
      window.location.href = "/auth?mode=signin";
      return;
    }
    window.location.href = "/landing";
  }
}

document.getElementById("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!agencyCache) {
    return;
  }
  const payload = {
    agencyName: document.getElementById("agencyName").value.trim(),
    agencyNameAr: document.getElementById("agencyNameAr").value.trim(),
    agencyTagline: document.getElementById("agencyTagline").value.trim(),
    agencyPhone: document.getElementById("agencyPhone").value.trim(),
    agencyEmail: document.getElementById("agencyEmail").value.trim(),
    agencyWebsite: document.getElementById("agencyWebsite").value.trim(),
    agencyAddress: document.getElementById("agencyAddress").value.trim(),
    agencySocial1: document.getElementById("agencySocial1").value.trim(),
    agencySocial2: document.getElementById("agencySocial2").value.trim(),
    agencyLogo: agencyLogoData,
    fraLogo: fraLogoData
  };

  try {
    const { agency } = await api("/agency/profile", {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    agencyCache = agency;
    fill(agency);
    const nextPath = getPostLoginPath(agency);
    if (isOnboardingProfileMode && !String(nextPath).startsWith("/profile")) {
      setMessage("Profile saved. Continuing setup...", true);
      setTimeout(() => {
        window.location.href = nextPath;
      }, 320);
      return;
    }
    setMessage("Profile saved.", true);
  } catch (error) {
    setMessage(error.message || "Could not save profile.");
  }
});

document.getElementById("goDashboard").addEventListener("click", () => {
  window.location.href = getPostLoginPath(agencyCache);
});

document.getElementById("agencyLogoFile")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    agencyLogoData = await readAndResizeImage(file);
    setLogoPreview("agencyLogoThumb", agencyLogoData, "PH Logo");
    setMessage("Left logo ready. Click Save Profile.", true);
  } catch (error) {
    setMessage(error.message || "Could not load left logo.");
  }
});

document.getElementById("fraLogoFile")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  try {
    fraLogoData = await readAndResizeImage(file);
    setLogoPreview("fraLogoThumb", fraLogoData, "FRA Logo");
    setMessage("Right logo ready. Click Save Profile.", true);
  } catch (error) {
    setMessage(error.message || "Could not load right logo.");
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Ignore and continue redirect.
  }
  window.location.href = "/landing";
});

loadProfile();
