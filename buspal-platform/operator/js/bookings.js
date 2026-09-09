/* ============================================================
   BusPal — Operator Dashboard — Bookings
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderBookings(root) {
    root.innerHTML = `<div class="empty"><div class="ico">▤</div>Loading bookings…</div>`;
    const bookings = await OpsAPI.getAllBookings();
    const upcoming = bookings.filter(b => b.status === "upcoming").length;
    const completed = bookings.filter(b => b.status === "completed").length;
    const cancelled = bookings.filter(b => b.status === "cancelled").length;

    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card"><div class="k">${bookings.length}</div><div class="l">Total bookings</div></div>
        <div class="stat-card"><div class="k" style="color:var(--brand)">${upcoming}</div><div class="l">Upcoming</div></div>
        <div class="stat-card"><div class="k" style="color:var(--brand-2)">${completed}</div><div class="l">Completed</div></div>
        <div class="stat-card"><div class="k" style="color:var(--muted)">${cancelled}</div><div class="l">Cancelled</div></div>
      </div>
      <div class="section-toolbar">
        <div class="filters">
          <input class="filter-input" id="bkSearch" placeholder="Search passenger, phone, or route…" />
          <select class="filter-input" id="bkStatusFilter">
            <option value="">All statuses</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select class="filter-input" id="bkSourceFilter">
            <option value="">Self + counter</option>
            <option value="self">Self-booked only</option>
            <option value="counter">Counter-booked only</option>
          </select>
        </div>
      </div>
      <div id="bkTableWrap"></div>
    `;

    function draw() {
      const q = $("#bkSearch", root).value.trim().toLowerCase();
      const st = $("#bkStatusFilter", root).value;
      const src = $("#bkSourceFilter", root).value;
      const rows = bookings.filter(b =>
        (!q || b.passengerName.toLowerCase().includes(q) || (b.phone || "").includes(q) ||
          b.from.toLowerCase().includes(q) || b.to.toLowerCase().includes(q)) &&
        (!st || b.status === st) && (!src || b.source === src)
      );
      $("#bkTableWrap", root).innerHTML = rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Passenger</th><th>Route</th><th>Date &amp; time</th><th>Seats</th><th>Fare</th><th>Status</th><th>Source</th><th></th></tr></thead>
            <tbody>
              ${rows.map(b => `
                <tr>
                  <td>
                    <div class="cell-strong">${esc(b.passengerName)}</div>
                    <div class="cell-sub">${esc(b.phone || "—")}</div>
                  </td>
                  <td>${esc(b.from)} → ${esc(b.to)}</td>
                  <td class="cell-mono">${esc(b.date)}<div class="cell-sub">${esc(b.depTime)}</div></td>
                  <td class="cell-mono">${b.seats.join(", ")}</td>
                  <td class="cell-mono">${fmtLKR((b.price || 0) * b.seats.length)}</td>
                  <td><span class="pill ${b.status === "upcoming" ? "info" : b.status === "completed" ? "active" : "hidden-pill"}">${b.status}</span></td>
                  <td><span class="badge ${b.source === "counter" ? "warn" : "off"}">${b.source === "counter" ? "counter" : "self"}</span></td>
                  <td class="td-actions">
                    ${b.phone ? `<a class="btn sm" href="tel:${esc(b.phone)}" title="Call passenger">📞</a>` : ""}
                    ${b.status === "upcoming" ? `<button class="icon-btn" title="Cancel — frees the seat for others" data-cancel-bk="${b.id}">⊘</button>` : ""}
                    <button class="icon-btn danger" title="Delete record" data-del-bk="${b.id}">🗑</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : emptyHTML("No bookings match your search.");
      $$("[data-cancel-bk]", root).forEach(b => b.addEventListener("click", () => {
        const booking = rows.find(x => x.id === b.dataset.cancelBk);
        confirmAction(`Cancel <strong>${esc(booking.passengerName)}</strong>'s booking (${esc(booking.from)} → ${esc(booking.to)}, seats ${booking.seats.join(", ")})? The seat${booking.seats.length > 1 ? "s" : ""} will become available for other passengers immediately — good for no-shows or when a customer doesn't answer the call to confirm.`, async () => {
          await OpsAPI.cancelAnyBooking(booking.id);
          toast("Booking cancelled — seat released.");
          go("bookings");
        });
      }));
      $$("[data-del-bk]", root).forEach(b => b.addEventListener("click", () => {
        const booking = rows.find(x => x.id === b.dataset.delBk);
        confirmAction(`Permanently delete this booking record for <strong>${esc(booking.passengerName)}</strong>? This removes it entirely, not just cancels it.`, async () => {
          await OpsAPI.deleteBooking(booking.id);
          toast("Booking deleted.");
          go("bookings");
        });
      }));
    }
    $("#bkSearch", root).addEventListener("input", draw);
    $("#bkStatusFilter", root).addEventListener("change", draw);
    $("#bkSourceFilter", root).addEventListener("change", draw);
    draw();
  }
  ROUTES_MAP.bookings = { title: 'Bookings', sub: 'Every passenger reservation across the fleet.', render: renderBookings };
})();
