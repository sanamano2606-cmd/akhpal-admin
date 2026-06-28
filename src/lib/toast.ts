// Lightweight toast notifications with no provider/context required, so it can be
// called from anywhere (event handlers, catch blocks) without wrapping the app.
// It just appends a styled element to <body> and removes it after a few seconds.

type ToastType = "success" | "error" | "info";

const COLORS: Record<ToastType, string> = {
  success: "#16a34a",
  error: "#dc2626",
  info: "#334155",
};

export function toast(message: string, type: ToastType = "info") {
  if (typeof document === "undefined") return; // SSR guard

  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;";
    document.body.appendChild(container);
  }

  const el = document.createElement("div");
  el.style.cssText =
    `background:${COLORS[type]};color:#fff;padding:12px 16px;border-radius:8px;` +
    "box-shadow:0 4px 14px rgba(0,0,0,.18);font-size:14px;max-width:360px;" +
    "opacity:0;transform:translateX(20px);transition:opacity .2s,transform .2s;pointer-events:auto;";
  el.textContent = message;
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(0)";
  });

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 220);
  }, 3500);
}
