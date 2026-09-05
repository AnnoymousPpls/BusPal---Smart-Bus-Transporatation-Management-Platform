/* ============================================================
   BusPal — Passenger Dashboard — Boot
   MUST be the last <script> tag on the page — every feature file
   (overview.js, book.js, ...) needs to have already registered its
   entry into ROUTES before go() is first called, and support.js
   needs to have already defined openSOSModal() before this binds it.
   ============================================================ */

(() => {
  $("#sosPill").addEventListener("click", openSOSModal);

  // ---------- session UI (name badge + avatar initials) ----------
  if (window.__session) {
    const initials = __session.name.split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase();
    $("#avatarInitials").textContent = initials;
    const badge = document.createElement("div");
    badge.className = "signed-in-badge";
    badge.innerHTML = `Signed in as<strong>${__session.name}</strong>`;
    $(".side-bottom").prepend(badge);
  }

  go("overview");
})();
