const API_BASE = window.GULFCV_RUNTIME?.apiBase || "http://localhost:3000/api";
const PAGE = document.body?.dataset.page || "landing";
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const mobileSideNav = document.getElementById("mobileSideNav");
const mobileSideBackdrop = document.getElementById("mobileSideBackdrop");
const mobileSideClose = document.getElementById("mobileSideClose");
const mobileNavActions = document.getElementById("mobileNavActions");

let currentAgency = null;
let activeAuthMode = "signin";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(text, ok = false) {
  const el = document.getElementById("authMessage");
  if (!el) return;
  el.style.color = ok ? "#11623a" : "#7d1f26";
  el.textContent = text;
}

function setTab(signupMode) {
  const loginTab = document.getElementById("showLogin");
  const signupTab = document.getElementById("showSignup");
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  if (!loginTab || !signupTab || !loginForm || !signupForm) return;

  loginTab.classList.toggle("active", !signupMode);
  signupTab.classList.toggle("active", signupMode);
  loginForm.classList.toggle("hidden", signupMode);
  signupForm.classList.toggle("hidden", !signupMode);
}

function normalizePlanFromQuery() {
  const value = new URLSearchParams(window.location.search).get("plan");
  const allowed = new Set(["free", "starter", "growth", "enterprise"]);
  return allowed.has(value) ? value : null;
}

function setModeInQuery(mode, keepToken = false) {
  if (PAGE !== "auth") return;
  const params = new URLSearchParams(window.location.search);
  params.set("mode", mode);
  if (keepToken) {
    const tokenInput = document.getElementById("resetToken");
    const token = sanitizeToken(tokenInput?.value || params.get("token"));
    if (token) {
      params.set("token", token);
    }
  } else {
    params.delete("token");
  }
  const next = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", next);
}

function showAuthMode(mode) {
  if (PAGE !== "auth") return;
  const authForms = document.getElementById("authForms");
  const forgotPanel = document.getElementById("forgotPanel");
  const resetPanel = document.getElementById("resetPanel");
  if (!authForms || !forgotPanel || !resetPanel) return;

  activeAuthMode = mode;
  authForms.classList.toggle("hidden", mode === "forgot" || mode === "reset");
  forgotPanel.classList.toggle("hidden", mode !== "forgot");
  resetPanel.classList.toggle("hidden", mode !== "reset");

  if (mode === "signup") {
    setTab(true);
  } else if (mode === "signin") {
    setTab(false);
  }
}

function setAuthView(agency) {
  const signedInPanel = document.getElementById("signedInPanel");
  const authForms = document.getElementById("authForms");
  const forgotPanel = document.getElementById("forgotPanel");
  const resetPanel = document.getElementById("resetPanel");
  const agencyName = document.getElementById("signedInAgencyName");

  if (!signedInPanel || !authForms || !agencyName || !forgotPanel || !resetPanel) return;

  if (agency) {
    agencyName.textContent = agency.agencyName || "Agency Account";
    signedInPanel.classList.remove("hidden");
    authForms.classList.add("hidden");
    forgotPanel.classList.add("hidden");
    resetPanel.classList.add("hidden");
  } else {
    signedInPanel.classList.add("hidden");
    showAuthMode(activeAuthMode);
  }
}

function applyAuthQueryState() {
  if (PAGE !== "auth") return;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const plan = normalizePlanFromQuery();
  const token = sanitizeToken(params.get("token"));

  if (mode === "signup") {
    showAuthMode("signup");
  } else if (mode === "forgot") {
    showAuthMode("forgot");
  } else if (mode === "reset") {
    showAuthMode("reset");
  } else {
    showAuthMode("signin");
  }

  const planSelect = document.getElementById("signupPlan");
  if (planSelect && plan) {
    planSelect.value = plan;
  }

  const resetTokenInput = document.getElementById("resetToken");
  if (resetTokenInput && token) {
    resetTokenInput.value = token;
  }

  setMessage("");
}

function sanitizeToken(value) {
  return String(value || "").trim().slice(0, 300);
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

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Ignore logout API errors and clear UI state.
  }
  currentAgency = null;
  renderNav(null);
  setAuthView(null);
  applyAuthQueryState();
  setMessage("Signed out successfully.", true);
  setMobileMenuOpen(false);
}

function setMobileMenuOpen(isOpen) {
  if (!mobileSideNav || !mobileMenuToggle) return;
  mobileSideNav.classList.toggle("is-open", isOpen);
  mobileSideNav.setAttribute("aria-hidden", isOpen ? "false" : "true");
  mobileMenuToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function bindMobileMenuEvents() {
  if (!mobileSideNav || !mobileMenuToggle || !mobileSideBackdrop || !mobileSideClose) return;
  mobileMenuToggle.addEventListener("click", () => {
    const next = !mobileSideNav.classList.contains("is-open");
    setMobileMenuOpen(next);
  });
  mobileSideBackdrop.addEventListener("click", () => setMobileMenuOpen(false));
  mobileSideClose.addEventListener("click", () => setMobileMenuOpen(false));
  mobileSideNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMobileMenuOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMobileMenuOpen(false);
    }
  });
}

function renderNav(agency) {
  const navs = [document.getElementById("navActions"), mobileNavActions].filter(Boolean);
  if (navs.length === 0) return;

  if (!agency) {
    const html = `
      <a class="nav-btn primary" href="/auth?mode=signup">Get Started</a>
      <a class="nav-btn ghost" href="/auth?mode=signin">Sign In</a>
    `;
    navs.forEach((nav) => {
      nav.innerHTML = html;
    });
    return;
  }

  const safeAgencyName = escapeHtml(agency.agencyName || "Agency");
  const html = `
    <span class="nav-chip">${safeAgencyName}</span>
    <a class="nav-btn" href="/profile">Profile</a>
    <a class="nav-btn primary" href="/dashboard">Dashboard</a>
    <button type="button" class="nav-btn ghost js-logout-btn">Sign Out</button>
  `;
  navs.forEach((nav) => {
    nav.innerHTML = html;
  });

  document.querySelectorAll(".js-logout-btn").forEach((logoutBtn) => {
    logoutBtn.addEventListener("click", () => {
      void logout();
    });
  });
}

async function refreshAuthState() {
  try {
    const { agency } = await api("/auth/me");
    currentAgency = agency;
    renderNav(agency);
    setAuthView(agency);
  } catch {
    currentAgency = null;
    renderNav(null);
    setAuthView(null);
  }
}

document.getElementById("showLogin")?.addEventListener("click", () => {
  showAuthMode("signin");
  setModeInQuery("signin");
  setMessage("");
});

document.getElementById("showSignup")?.addEventListener("click", () => {
  showAuthMode("signup");
  setModeInQuery("signup");
  setMessage("");
});

document.getElementById("showForgotPassword")?.addEventListener("click", () => {
  showAuthMode("forgot");
  setModeInQuery("forgot");
  setMessage("");
});

document.getElementById("forgotBackToSignin")?.addEventListener("click", () => {
  showAuthMode("signin");
  setModeInQuery("signin");
  setMessage("");
});

document.getElementById("resetBackToSignin")?.addEventListener("click", () => {
  showAuthMode("signin");
  setModeInQuery("signin");
  setMessage("");
});

document.getElementById("panelLogoutBtn")?.addEventListener("click", () => {
  void logout();
});

document.querySelectorAll(".plan-btn").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentAgency) {
      window.location.href = "/dashboard";
      return;
    }
    const plan = button.dataset.plan || "free";
    window.location.href = `/auth?mode=signup&plan=${encodeURIComponent(plan)}`;
  });
});

document.getElementById("signupForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const agencyName = document.getElementById("signupAgencyName").value.trim();
  const email = document.getElementById("signupEmail").value.trim().toLowerCase();
  const password = document.getElementById("signupPassword").value;
  const plan = document.getElementById("signupPlan").value;

  try {
    const { agency } = await api("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ agencyName, email, password, plan })
    });
    currentAgency = agency;
    renderNav(agency);
    setAuthView(agency);
    setMessage("Account created. Redirecting to dashboard...", true);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 500);
  } catch (error) {
    const msg = (error.message || "").toLowerCase().includes("fetch")
      ? "Cannot reach API. Check backend URL and server status."
      : error.message || "Could not create account.";
    setMessage(msg);
  }
});

document.getElementById("loginForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;

  try {
    const { agency } = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    currentAgency = agency;
    renderNav(agency);
    setAuthView(agency);
    window.location.href = "/dashboard";
  } catch (error) {
    const msg = (error.message || "").toLowerCase().includes("fetch")
      ? "Cannot reach API. Check backend URL and server status."
      : error.message || "Invalid email or password.";
    setMessage(msg);
  }
});

document.getElementById("forgotForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("forgotEmail").value.trim().toLowerCase();

  try {
    const data = await api("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    if (data?.debugResetToken) {
      const tokenInput = document.getElementById("resetToken");
      if (tokenInput) {
        tokenInput.value = sanitizeToken(data.debugResetToken);
      }
      showAuthMode("reset");
      setModeInQuery("reset", true);
      setMessage("Reset token generated in log mode. Set your new password below.", true);
      return;
    }
    setMessage(data.message || "If your account exists, a reset link has been sent.", true);
  } catch (error) {
    setMessage(error.message || "Could not send reset link.");
  }
});

document.getElementById("resetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = sanitizeToken(document.getElementById("resetToken").value);
  const password = document.getElementById("resetPassword").value;
  const passwordConfirm = document.getElementById("resetPasswordConfirm").value;

  if (password !== passwordConfirm) {
    setMessage("Passwords do not match.");
    return;
  }

  try {
    const data = await api("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password })
    });
    setMessage(data.message || "Password updated. You can sign in now.", true);
    showAuthMode("signin");
    setModeInQuery("signin");
    const resetPassword = document.getElementById("resetPassword");
    const resetPasswordConfirm = document.getElementById("resetPasswordConfirm");
    if (resetPassword) resetPassword.value = "";
    if (resetPasswordConfirm) resetPasswordConfirm.value = "";
  } catch (error) {
    setMessage(error.message || "Could not reset password.");
  }
});

applyAuthQueryState();
bindMobileMenuEvents();
void refreshAuthState();
