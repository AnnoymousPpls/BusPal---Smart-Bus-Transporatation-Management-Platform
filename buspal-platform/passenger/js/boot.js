/* ============================================================
   BusPal — Passenger Dashboard — Boot
   MUST be the last <script> tag on the page.

   Initializes the passenger dashboard using the real
   AuthStore session created during login.
   ============================================================ */

(() => {
  // ---------- session guard ----------
  const session = AuthStore.getSession();

  if (!session) {
    window.location.href = "../index.html";
    return;
  }

  // Make the session available to any legacy feature code
  // that still expects window.__session.
  window.__session = session;

  // ---------- SOS ----------
  $("#sosPill").addEventListener("click", openSOSModal);

  // ---------- session UI ----------
  const name = session.name || "Passenger";

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  $("#avatarInitials").textContent = initials;

  const badge = document.createElement("div");
  badge.className = "signed-in-badge";
  badge.innerHTML = `
    Signed in as
    <strong>${esc(name)}</strong>
  `;

  $(".side-bottom").prepend(badge);

  // ---------- initial route ----------
  go("overview");
})();