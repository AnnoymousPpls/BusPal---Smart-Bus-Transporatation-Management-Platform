/* ============================================================
   BusPal — Passenger Dashboard — Live Tracking
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderTracking(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◎</div>Locating your bus…</div>`;
    const live = await BusPalAPI.getLiveTrip();
    liveIndicator.hidden = !live;
    if (!live) {
      const bookings = await BusPalAPI.getBookings();
      const next = bookings.find(b => b.status === "upcoming");
      root.innerHTML = next ? `
        <div class="empty">
          <div class="ico">◎</div>
          <strong style="display:block;margin-bottom:6px;color:var(--text)">${esc(next.trip.from)} → ${esc(next.trip.to)} isn't being tracked yet</strong>
          Live tracking appears here automatically once BT Express starts tracking your ${esc(next.trip.date)} · ${esc(next.trip.depTime)} trip — usually shortly before departure.
        </div>
      ` : emptyHTML("No upcoming trips to track — search and book a trip first.");
      return;
    }
    root.innerHTML = `
      <div class="grid-2">
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div><strong>${live.from} → ${live.to}</strong><div class="muted small">Bus ${live.busPlate || "TBA"}</div></div>
            <span class="badge info">ETA ${formatEta(live.etaMinutes)}</span>
          </div>
          <div class="route-progress" style="margin-top:6px">
            ${live.stops.map(s => `
              <div class="rp-stop ${s.status}">
                <div class="rp-line"></div>
                <div class="rp-dot"></div>
                <div class="rp-label">${esc(s.name)}</div>
              </div>`).join("")}
          </div>
        </div>
        <div class="card card-pad" style="display:flex;flex-direction:column;gap:14px">
          <h3>Trip crew</h3>
          <div><div class="muted small">Driver</div><div>${live.driverName || "Not assigned yet"}</div></div>
          <div><div class="muted small">Conductor</div><div>${live.conductorName || "Not assigned yet"}</div></div>
          <div><div class="muted small">Your booking</div><div>${live.bookingPnr || live.bookingId}</div></div>
          <hr style="border-color:rgba(255,255,255,.06);width:100%" />
          <button class="btn danger block" id="trkSOS">⚠ Emergency SOS</button>
          <button class="btn block" data-go="support">✆ Report an issue with this trip</button>
        </div>
      </div>
    `;
    root.querySelector("#trkSOS").addEventListener("click", openSOSModal);
    $$("[data-go]", root).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  }

  ROUTES.tracking = { title: "Live Tracking", sub: "Follow your bus in real time.", render: renderTracking };
})();
