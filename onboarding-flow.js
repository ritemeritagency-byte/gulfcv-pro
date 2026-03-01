(function initOnboardingFlow() {
  const STEP_ORDER = ["welcome", "profile", "checklist", "completed"];

  function normalizeStep(value) {
    const clean = String(value || "").trim().toLowerCase();
    return STEP_ORDER.includes(clean) ? clean : "completed";
  }

  function normalizePath(value) {
    const text = String(value || "").trim() || "/";
    return text.endsWith("/") && text !== "/" ? text.slice(0, -1) : text;
  }

  function stepToTargetPath(step) {
    if (step === "welcome") {
      return "/onboarding?step=welcome";
    }
    if (step === "profile") {
      return "/profile?onboarding=1";
    }
    if (step === "checklist") {
      return "/onboarding?step=checklist";
    }
    return "/dashboard";
  }

  function getNextPathForAgency(agency) {
    if (!agency || typeof agency !== "object") {
      return "/auth?mode=signin";
    }
    if (String(agency.subscriptionStatus || "") !== "active") {
      return "/subscription";
    }
    const onboarding = agency.onboarding && typeof agency.onboarding === "object" ? agency.onboarding : {};
    const step = normalizeStep(onboarding.step || "completed");
    const completed = Boolean(onboarding.completed) || step === "completed";
    if (completed) {
      return "/dashboard";
    }
    return stepToTargetPath(step);
  }

  function getRedirectForCurrentPage(agency, pathname, search) {
    const target = getNextPathForAgency(agency);
    const targetPath = normalizePath(String(target).split("?")[0]);
    const currentPath = normalizePath(pathname || window.location.pathname);
    if (targetPath !== currentPath) {
      return target;
    }
    if (currentPath === "/onboarding") {
      const currentStep = normalizeStep(new URLSearchParams(search || window.location.search).get("step"));
      const targetStep = normalizeStep(new URLSearchParams(String(target).split("?")[1] || "").get("step"));
      if (currentStep !== targetStep) {
        return target;
      }
    }
    return "";
  }

  window.GULFCV_ONBOARDING = Object.freeze({
    getNextPathForAgency,
    getRedirectForCurrentPage,
    normalizeStep
  });
})();
