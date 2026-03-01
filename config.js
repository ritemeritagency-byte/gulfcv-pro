(function initRuntimeConfig() {
  function normalizeApiBase(value) {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    return text.replace(/\/+$/, "");
  }

  function readExplicitApiBase() {
    if (window.__GULFCV_CONFIG__ && typeof window.__GULFCV_CONFIG__.apiBase === "string") {
      return normalizeApiBase(window.__GULFCV_CONFIG__.apiBase);
    }
    const meta = document.querySelector('meta[name="gulfcv-api-base"]');
    if (meta && typeof meta.content === "string") {
      return normalizeApiBase(meta.content);
    }
    return "";
  }

  function detectDefaultApiBase() {
    return normalizeApiBase(`${window.location.origin}/api`);
  }

  const explicitApiBase = readExplicitApiBase();
  const apiBase = explicitApiBase || detectDefaultApiBase();

  window.GULFCV_RUNTIME = Object.freeze({
    apiBase
  });
})();
