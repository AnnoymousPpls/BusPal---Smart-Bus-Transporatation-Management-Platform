/* operator/js/ux.js — small UX helpers for the Operator Console.
   Adds a collapse button, keeps the active menu item in view, and sets tooltips.
   Does not change any element IDs, routes or data calls. */
(() => {
  const body = document.body;
  const sidebar = document.getElementById("sidebar");
  const nav = document.getElementById("sideNav");
  const KEY = "buspal-op-sidebar";

  if (!sidebar || !nav) return;

  /* ---- collapse / expand (desktop only; phones keep the slide-in menu) ---- */
  function applyCollapsed(collapsed) {
    body.classList.toggle("side-collapsed", collapsed);
    if (btn) {
      btn.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      btn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    }
  }

  const top = sidebar.querySelector(".side-top");
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sidebar-collapse";
  btn.textContent = "«";
  if (top) top.insertBefore(btn, top.querySelector(".side-close"));

  let saved = false;
  try { saved = localStorage.getItem(KEY) === "1"; } catch (e) { /* storage blocked */ }
  applyCollapsed(saved);

  btn.addEventListener("click", () => {
    const next = !body.classList.contains("side-collapsed");
    applyCollapsed(next);
    try { localStorage.setItem(KEY, next ? "1" : "0"); } catch (e) { /* ignore */ }
  });

  /* Ctrl/⌘ + B toggles it, like most dashboards */
  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b" && window.innerWidth > 860) {
      const tag = (e.target && e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      btn.click();
    }
  });

  /* ---- tooltips so the icon-only menu is still readable ---- */
  function labelItems() {
    sidebar.querySelectorAll(".nav-item").forEach(item => {
      const label = item.querySelector("span:not(.nav-ico)");
      if (label && !item.title) item.title = label.textContent.trim();
    });
  }
  labelItems();

  /* ---- keep the active page visible when the menu scrolls ---- */
  function revealActive() {
    const active = nav.querySelector(".nav-item.active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }
  new MutationObserver(revealActive).observe(nav, {
    subtree: true, attributes: true, attributeFilter: ["class"]
  });
  revealActive();

  /* the signed-in block is drawn by boot.js after load; label any late items too */
  new MutationObserver(labelItems).observe(sidebar, { childList: true, subtree: true });
})();
