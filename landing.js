(function initTemplatePreview() {
  const PAGE = document.body?.dataset.page || "";
  if (PAGE !== "landing") {
    return;
  }

  const modal = document.getElementById("templateModal");
  const modalImage = document.getElementById("templateModalImage");
  const modalTitle = document.getElementById("templateModalTitle");
  const closeBtn = document.getElementById("templateModalClose");
  const backdrop = document.getElementById("templateModalBackdrop");
  const openButtons = document.querySelectorAll(".template-open");

  if (!modal || !modalImage || !modalTitle || !closeBtn || !backdrop || openButtons.length === 0) {
    return;
  }

  let lastFocusedElement = null;

  function openModal(src, name) {
    if (!src) return;
    lastFocusedElement = document.activeElement;
    modalImage.src = src;
    modalImage.alt = `${name} full preview`;
    modalTitle.textContent = name;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  }

  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    modalImage.src = "";
    document.body.style.overflow = "";
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  openButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const src = button.dataset.templateSrc || "";
      const name = button.dataset.templateName || "Template Preview";
      openModal(src, name);
    });
  });

  closeBtn.addEventListener("click", closeModal);
  backdrop.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
})();
