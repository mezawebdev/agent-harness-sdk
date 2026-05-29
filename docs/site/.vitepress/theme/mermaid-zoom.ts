// Click-to-zoom for Mermaid diagrams. The diagram renders compact inline (so
// it fits the prose column); clicking it opens a full-size, crisp vector copy
// in a modal overlay. Styles live in custom.css (#mermaid-zoom-overlay).
//
// Uses event delegation so it survives Mermaid re-rendering its SVG (e.g. on
// dark/light theme toggle) without needing to re-bind per diagram.

let initialized = false;

export function setupMermaidZoom(): void {
  if (typeof document === "undefined" || initialized) return;
  initialized = true;

  const overlay = document.createElement("div");
  overlay.id = "mermaid-zoom-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML =
    '<div class="mz-backdrop"></div>' +
    '<div class="mz-stage"></div>' +
    '<button class="mz-close" aria-label="Close enlarged diagram">×</button>';
  document.body.appendChild(overlay);

  const stage = overlay.querySelector(".mz-stage") as HTMLElement;
  const close = () => {
    overlay.classList.remove("is-open");
    stage.innerHTML = "";
  };

  overlay.querySelector(".mz-backdrop")?.addEventListener("click", close);
  overlay.querySelector(".mz-close")?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });

  // Open when any inline Mermaid figure is clicked.
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement | null;
    const figure = target?.closest(".vp-doc .mermaid");
    if (!figure || figure.closest("#mermaid-zoom-overlay")) return;

    const svg = figure.querySelector("svg");
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGElement;
    // Drop the fixed pixel size so the clone scales to fill the modal stage;
    // the viewBox keeps it crisp at any size.
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.style.maxWidth = "100%";
    clone.style.maxHeight = "100%";

    stage.innerHTML = "";
    stage.appendChild(clone);
    overlay.classList.add("is-open");
  });
}
