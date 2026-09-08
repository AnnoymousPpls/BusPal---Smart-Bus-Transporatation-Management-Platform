/* ============================================================
   BusPal — Passenger Dashboard — My Bookings
   bindBookingRowActions/boardingPassHTML now live in core.js since
   overview.js and book.js also need them — a local IIFE here would
   hide them from those files.
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderBookings(root) {
    root.innerHTML = `<div class="empty"><div class="ico">▤</div>Loading bookings…</div>`;
    const bookings = await BusPalAPI.getBookings();
    if (!bookings.length) { root.innerHTML = emptyHTML("No bookings yet — search a trip to get started."); return; }
    root.innerHTML = `<div style="display:flex;flex-direction:column;gap:12px">${bookings.map(bookingRowHTML).join("")}</div>`;
    bindBookingRowActions(root);
  }

  ROUTES.bookings = { title: "My Bookings", sub: "Manage upcoming and past reservations.", render: renderBookings };
})();
