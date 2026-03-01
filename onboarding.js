const API_BASE = window.GULFCV_RUNTIME?.apiBase || `/api`;

const onboardingTitle = document.getElementById("onboardingTitle");
const onboardingLead = document.getElementById("onboardingLead");
const onboardingMessage = document.getElementById("onboardingMessage");
const welcomeStep = document.getElementById("welcomeStep");
const checklistStep = document.getElementById("checklistStep");
const welcomeContinueBtn = document.getElementById("welcomeContinueBtn");
const checklistContinueBtn = document.getElementById("checklistContinueBtn");
const checkBranding = document.getElementById("checkBranding");
const checkTemplates = document.getElementById("checkTemplates");
const checkWorkflow = document.getElementById("checkWorkflow");
const stepChipWelcome = document.getElementById("stepChipWelcome");
const stepChipProfile = document.getElementById("stepChipProfile");
const stepChipChecklist = document.getElementById("stepChipChecklist");
const openProfileBtn = document.getElementById("openProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

let currentAgency = null;
let selectedStep = "welcome";

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
  onboardingMessage.style.color = ok ? "#11623a" : "#7d1f26";
  onboardingMessage.textContent = text;
}

function normalizeStep(value) {
  return window.GULFCV_ONBOARDING?.normalizeStep(value) || "completed";
}

function getChecklistFromAgency(agency) {
  const source = agency?.onboarding?.checklist || {};
  return {
    branding: Boolean(source.branding),
    templateSetup: Boolean(source.templateSetup),
    workflowTraining: Boolean(source.workflowTraining)
  };
}

function isChecklistComplete(checklist) {
  return Boolean(checklist.branding && checklist.templateSetup && checklist.workflowTraining);
}

function renderStepChips(step, profileComplete) {
  [stepChipWelcome, stepChipProfile, stepChipChecklist].forEach((chip) => {
    chip.classList.remove("is-active", "is-done");
  });

  if (step === "welcome") {
    stepChipWelcome.classList.add("is-active");
    return;
  }

  stepChipWelcome.classList.add("is-done");
  if (!profileComplete || step === "profile") {
    stepChipProfile.classList.add("is-active");
    return;
  }

  stepChipProfile.classList.add("is-done");
  stepChipChecklist.classList.add("is-active");
}

function renderWelcome(agency) {
  const agencyName = agency?.agencyName || "your agency";
  onboardingTitle.textContent = `Welcome, ${agencyName}`;
  onboardingLead.textContent =
    "Explore what GulfCV Pro handles for your recruiters, then continue to profile setup before builder access.";
  welcomeStep.classList.remove("hidden");
  checklistStep.classList.add("hidden");
}

function renderChecklist(agency) {
  onboardingTitle.textContent = "Final Launch Checklist";
  onboardingLead.textContent =
    "Complete these setup confirmations to unlock the CV Builder for your team.";
  welcomeStep.classList.add("hidden");
  checklistStep.classList.remove("hidden");

  const checklist = getChecklistFromAgency(agency);
  checkBranding.checked = checklist.branding;
  checkTemplates.checked = checklist.templateSetup;
  checkWorkflow.checked = checklist.workflowTraining;
  checklistContinueBtn.disabled = !isChecklistComplete(checklist);
}

async function saveChecklist() {
  const checklist = {
    branding: Boolean(checkBranding.checked),
    templateSetup: Boolean(checkTemplates.checked),
    workflowTraining: Boolean(checkWorkflow.checked)
  };

  checklistContinueBtn.disabled = !isChecklistComplete(checklist);

  try {
    const { agency } = await api("/onboarding", {
      method: "PUT",
      body: JSON.stringify({ checklist })
    });
    currentAgency = agency;
  } catch (error) {
    setMessage(error.message || "Could not save checklist.");
  }
}

async function continueFromWelcome() {
  try {
    const { agency } = await api("/onboarding", {
      method: "PUT",
      body: JSON.stringify({ step: "profile" })
    });
    currentAgency = agency;
    window.location.href = "/profile?onboarding=1";
  } catch (error) {
    setMessage(error.message || "Could not continue to profile.");
  }
}

async function finishChecklist() {
  const checklist = {
    branding: Boolean(checkBranding.checked),
    templateSetup: Boolean(checkTemplates.checked),
    workflowTraining: Boolean(checkWorkflow.checked)
  };
  if (!isChecklistComplete(checklist)) {
    setMessage("Please check all setup confirmations first.");
    return;
  }
  try {
    const { agency } = await api("/onboarding", {
      method: "PUT",
      body: JSON.stringify({ checklist, step: "completed", markCompleted: true })
    });
    currentAgency = agency;
    setMessage("Setup completed. Opening CV Builder...", true);
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 320);
  } catch (error) {
    setMessage(error.message || "Could not complete onboarding.");
  }
}

async function logout() {
  try {
    await api("/auth/logout", { method: "POST" });
  } catch {
    // Ignore and continue redirect.
  }
  window.location.href = "/landing";
}

function render(agency) {
  const onboarding = agency?.onboarding || {};
  const profileComplete = Boolean(onboarding.profileComplete);
  const stepFromQuery = normalizeStep(new URLSearchParams(window.location.search).get("step"));
  const serverStep = normalizeStep(onboarding.step || "welcome");
  selectedStep = stepFromQuery === "completed" ? serverStep : stepFromQuery;
  if (selectedStep === "completed") {
    selectedStep = "checklist";
  }
  if (serverStep === "welcome") {
    selectedStep = "welcome";
  } else if (serverStep === "profile") {
    window.location.href = "/profile?onboarding=1";
    return;
  } else if (serverStep === "checklist") {
    selectedStep = "checklist";
  } else {
    window.location.href = "/dashboard";
    return;
  }

  renderStepChips(selectedStep, profileComplete);
  if (selectedStep === "welcome") {
    renderWelcome(agency);
    return;
  }
  renderChecklist(agency);
}

async function init() {
  try {
    const { agency } = await api("/auth/me");
    currentAgency = agency;
    const redirect = window.GULFCV_ONBOARDING?.getRedirectForCurrentPage(
      agency,
      window.location.pathname,
      window.location.search
    ) || "";
    if (redirect && !redirect.startsWith("/onboarding")) {
      window.location.href = redirect;
      return;
    }
    render(currentAgency);
  } catch {
    window.location.href = "/auth?mode=signin";
  }
}

welcomeContinueBtn?.addEventListener("click", () => {
  void continueFromWelcome();
});

[checkBranding, checkTemplates, checkWorkflow].forEach((input) => {
  input?.addEventListener("change", () => {
    void saveChecklist();
  });
});

checklistContinueBtn?.addEventListener("click", () => {
  void finishChecklist();
});

openProfileBtn?.addEventListener("click", () => {
  window.location.href = "/profile?onboarding=1";
});

logoutBtn?.addEventListener("click", () => {
  void logout();
});

void init();
