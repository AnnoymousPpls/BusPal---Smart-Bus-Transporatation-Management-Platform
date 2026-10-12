/* BusPal — Operator Dashboard — Boot */

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
