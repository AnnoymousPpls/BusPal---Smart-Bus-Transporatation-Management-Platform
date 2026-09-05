/* ============================================================
   BusPal — Passenger Dashboard — Core
   Shared DOM refs, helpers, router, and session chrome.
   MUST load before every other passenger/js/*.js file — those files
   register themselves into ROUTES (declared here) and use the
   $/$$/toast/openModal/etc. helpers defined here.

   No IIFE wrapper on purpose: classic (non-module) scripts share one
   global scope, so top-level declarations here are directly usable
   by every script tag that loads after this one.
   ============================================================ */

const content = document.getElementById("content");
const pageTitle = document.getElementById("pageTitle");
const liveIndicator = document.getElementById("liveIndicator");

const ROUTES = {}; // populated by each feature file (overview.js, book.js, ...)
let currentRoute = "overview";
let seatSelection = { tripId: null, trip: null, seats: new Set() };
let heroCleanup = null;

const $ = (sel, scope = document) => scope.querySelector(sel);
const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const fmtLKR = (n) => "LKR " + n.toLocaleString("en-LK", { minimumFractionDigits: 2 });
const formatEta = (mins) => mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;
const emptyHTML = (msg) => `<div class="empty"><div class="ico">◇</div>${msg}</div>`;
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg, ms = 2600) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.hidden = false;
    t.style.animation = "none";
    requestAnimationFrame(() => { t.style.animation = ""; });
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
    if (heroCleanup) { heroCleanup(); heroCleanup = null; }
    currentRoute = route;
    const meta = ROUTES[route];
    pageTitle.textContent = meta.title;
    $$(".nav-item[data-route]").forEach(b => b.classList.toggle("active", b.dataset.route === route));
    content.innerHTML = `<section class="section active" id="sec-${route}"></section>`;
    meta.render($(`#sec-${route}`));
    closeSidebarMobile();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$(".nav-item[data-route]").forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.route));
  });
  $("#profileShortcut").addEventListener("click", () => go("profile"));
  $("#logoutBtn").addEventListener("click", () => {
    AuthStore.clearSession();
    window.location.href = "../index.html";
  });


  // ---------- theme toggle ----------
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("buspal-theme", next);
  });

  // mobile sidebar
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sideBackdrop");
  $("#menuBtn").addEventListener("click", () => { sidebar.classList.add("open"); backdrop.classList.add("open"); });
  $("#sideClose").addEventListener("click", closeSidebarMobile);
  backdrop.addEventListener("click", closeSidebarMobile);
  function closeSidebarMobile() { sidebar.classList.remove("open"); backdrop.classList.remove("open"); }

// ---------- shared across multiple pages (Overview, Book, My Bookings) ----------
function bookingRowHTML(b) {
  const t = b.trip;
  const statusBadge = { upcoming: "info", completed: "ok", cancelled: "bad" }[b.status] || "off";
  return `
    <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
          <strong>${t.from} → ${t.to}</strong>
          <span class="badge ${statusBadge}">${b.status}</span>
        </div>
        <div class="muted small">${t.date} · ${t.depTime}–${t.arrTime} · Seats ${b.seats.join(", ")} · PNR ${b.pnr}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn sm" data-view-pass="${b.id}">View e-ticket</button>
        ${b.status === "upcoming" ? `<button class="btn sm danger" data-cancel="${b.id}">Cancel</button>` : ""}
      </div>
    </div>`;
}

function boardingPassHTML(b, opts = {}) {
  const t = b.trip;
  return `
    <div class="boarding-pass">
      <div class="bp-main">
        <div class="bp-code">BusPal e-ticket</div>
        <div class="bp-route">
          <span class="bp-city">${t.from}</span>
          <span class="bp-arrow">→</span>
          <span class="bp-city">${t.to}</span>
        </div>
        <div class="bp-grid">
          <div><div class="lbl">Date</div><div class="val">${t.date}</div></div>
          <div><div class="lbl">Departs</div><div class="val">${t.depTime}</div></div>
          <div><div class="lbl">Arrives</div><div class="val">${t.arrTime}</div></div>
          <div><div class="lbl">Seats</div><div class="val">${b.seats.join(", ")}</div></div>
          <div><div class="lbl">Bus</div><div class="val">${t.plate}</div></div>
          <div><div class="lbl">Class</div><div class="val">${t.busType}</div></div>
        </div>
      </div>
      ${opts.compact ? "" : `
      <div class="bp-stub">
        <div class="bp-qr">QR<br/>CODE</div>
        <div class="bp-pnr">${b.pnr}</div>
      </div>`}
    </div>
  `;
}

function bindBookingRowActions(root) {
  $$("[data-view-pass]", root).forEach(btn => btn.addEventListener("click", async () => {
    const bookings = await BusPalAPI.getBookings();
    const b = bookings.find(x => x.id === btn.dataset.viewPass);
    $("#passModalBody").innerHTML = boardingPassHTML(b);
    openModal("passModal");
  }));
  $$("[data-cancel]", root).forEach(btn => btn.addEventListener("click", async () => {
    if (!confirm("Cancel this booking? This can't be undone in the demo.")) return;
    await BusPalAPI.cancelBooking(btn.dataset.cancel);
    toast("Booking cancelled.");
    go(currentRoute);
  }));
}

// ---------- shared across multiple pages (Overview, Live Tracking, Feedback & SOS, boot.js) ----------
async function openSOSModal() {
  const contacts = await BusPalAPI.getEmergencyContacts();
  $("#sosModalBody").innerHTML = `
    <div class="sos-big">⚠</div>
    <div>
      <strong>Send an emergency alert?</strong>
      <p class="muted small">This shares your current trip and approximate location with BT Express's operations team and hotline immediately.</p>
    </div>
    <button class="btn danger block" id="sosConfirm">Yes, send SOS now</button>
    <button class="btn ghost block" id="sosCancel">Cancel</button>
    ${contacts.length ? `
      <hr style="border-color:rgba(255,255,255,.08);width:100%;margin:4px 0" />
      <div style="width:100%">
        <div class="muted small" style="margin-bottom:8px">Or call someone you trust right now:</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${contacts.map(c => `<a class="btn block" href="tel:${esc(c.phone)}">📞 ${esc(c.name)} — ${esc(c.phone)}</a>`).join("")}
        </div>
      </div>
    ` : `<p class="muted small" style="width:100%;text-align:center">Add emergency contacts in Profile to see quick-dial options here.</p>`}
  `;
  openModal("sosModal");
  $("#sosCancel").addEventListener("click", () => closeModal("sosModal"));
  $("#sosConfirm").addEventListener("click", async () => {
    const btn = $("#sosConfirm");
    btn.disabled = true; btn.textContent = "Sending…";
    await BusPalAPI.triggerSOS({ bookingId: "BK-88231", note: "Triggered from dashboard" });
    closeModal("sosModal");
    toast("SOS sent. BT Express operations has been notified.", 4000);
  });
}
