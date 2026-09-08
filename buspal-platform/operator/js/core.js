/* ============================================================
   BusPal — Operator Dashboard — Core
   Shared DOM refs, helpers, router, and session/SOS chrome.
   MUST load before every other operator/js/*.js file — those files
   register themselves into ROUTES_MAP (declared here) and use the
   $/$$/toast/openModal/etc. helpers defined here.

   No IIFE wrapper on purpose: classic (non-module) scripts share one
   global scope, so top-level declarations here are directly usable
   by every script tag that loads after this one. Simpler than wiring
   up window.* exports one by one, and keeps every file a plain
   <script src> tag — no build step, matches the rest of the stack.
   ============================================================ */

const content = document.getElementById("content");
const pageTitle = document.getElementById("pageTitle");

const ROUTES_MAP = {}; // populated by each feature file (buses.js, routes.js, ...)
let currentRoute = "overview";

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const fmtLKR = (n) => "LKR " + Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 0 });
const formatEta = (mins) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const emptyHTML = (msg) => `<div class="empty"><div class="ico">◇</div>${msg}</div>`;

  function toast(msg, ms = 2600) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._h);
    toast._h = setTimeout(() => { t.hidden = true; }, ms);
  }

  function openModal(id) {
    const m = document.getElementById(id);
    if (!m.querySelector(".modal-backdrop")) {
      const bd = document.createElement("div");
      bd.className = "modal-backdrop";
      bd.addEventListener("click", () => closeModal(id));
      m.prepend(bd);
    }
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    m.classList.remove("open");
    m.setAttribute("aria-hidden", "true");
  }
  $$(".modal").forEach(m => {
    m.querySelectorAll("[id$='Close']").forEach(btn => btn.addEventListener("click", () => closeModal(m.id)));
  });

  function openForm(title, bodyHTML) {
    $("#formModalTitle").textContent = title;
    $("#formModalBody").innerHTML = bodyHTML;
    openModal("formModal");
    return $("#formModalBody");
  }

  function confirmAction(message, onConfirm) {
    $("#confirmModalBody").innerHTML = `
      <p>${message}</p>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn danger block" id="confirmYes">Yes, continue</button>
        <button class="btn block" id="confirmNo">Cancel</button>
      </div>`;
    openModal("confirmModal");
    $("#confirmNo").addEventListener("click", () => closeModal("confirmModal"));
    $("#confirmYes").addEventListener("click", async () => {
      $("#confirmYes").disabled = true;
      await onConfirm();
      closeModal("confirmModal");
    });
  }

  // ---------- routing ----------
  function go(route) {
    currentRoute = route;
    const meta = ROUTES_MAP[route];
    pageTitle.textContent = meta.title;
    $$(".nav-item[data-route]").forEach(b => b.classList.toggle("active", b.dataset.route === route));
    content.innerHTML = `<section class="section active" id="sec-${route}"></section>`;
    meta.render($(`#sec-${route}`));
    refreshSOSBadge(); // persistent across every page, not just Overview/Feedback
    closeSidebarMobile();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $$(".nav-item[data-route]").forEach(btn => btn.addEventListener("click", () => go(btn.dataset.route)));
  $("#profileShortcut").addEventListener("click", () => go("profile"));
  $("#logoutBtn").addEventListener("click", () => {
    AuthStore.clearSession();
    window.location.href = "../index.html";
  });

  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sideBackdrop");
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.add("open"); backdrop.classList.add("open"); });
  $("#sideClose").addEventListener("click", closeSidebarMobile);
  backdrop.addEventListener("click", closeSidebarMobile);
  function closeSidebarMobile() { sidebar.classList.remove("open"); backdrop.classList.remove("open"); }

  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("buspal-theme", next);
  });

  async function refreshSOSBadge() {
    const alerts = await OpsAPI.getSOSAlerts();
    const open = alerts.filter(a => a.status !== "resolved");
    $("#sosLiveBadge").hidden = open.length === 0;
    if (open.length) $("#sosLiveBadge").textContent = `⚠ ${open.length} SOS active`;

    const fab = $("#sosFab");
    if (fab) {
      fab.classList.toggle("active-alert", open.length > 0);
      fab.classList.toggle("idle", open.length === 0);
      const existingCount = $(".sos-fab-count", fab);
      if (open.length > 0) {
        if (existingCount) existingCount.textContent = open.length;
        else {
          const badge = document.createElement("span");
          badge.className = "sos-fab-count";
          badge.textContent = open.length;
          fab.appendChild(badge);
        }
      } else if (existingCount) {
        existingCount.remove();
      }
    }
  }
  $("#sosFab")?.addEventListener("click", () => go("feedback"));
  // Poll every 8s so the alert surfaces even if the operator never navigates —
  // stands in for a real push (WebSocket/SSE) once the backend supports one.
  setInterval(refreshSOSBadge, 8000);
