/* ============================================================
   BusPal — Operator Dashboard — Boot
   MUST be the last <script> tag on the page — every feature file
   (overview.js, buses.js, routes.js, ...) needs to have already
   registered its entry into ROUTES_MAP before go() is first called.
   ============================================================ */

(() => {
  // ---------- session UI (name/role badge + avatar initials) ----------
  if (window.__session) {
    const initials = __session.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
    $("#avatarInitials").textContent = initials;
    const badge = document.createElement("div");
    badge.className = "signed-in-badge";
    badge.innerHTML = `Signed in as<strong>${__session.name}</strong><span class="pill ${__session.role === "owner" ? "active" : "info"}" style="margin-top:4px;width:fit-content">${__session.role}</span>`;
    $(".side-bottom").prepend(badge);
  }

  go("overview");
})();
