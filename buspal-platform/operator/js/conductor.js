/* ============================================================
   BusPal — Operator Dashboard — Conductor View
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderConductor(root) {
    root.innerHTML = `<div class="empty"><div class="ico">▦</div>Loading trips…</div>`;
    const trips = await OpsAPI.getConductorTrips();
    if (!trips.length) { root.innerHTML = emptyHTML("No scheduled departures yet — add one under Routes & Schedules."); return; }

    const portalBaseUrl = new URL("../conductor/index.html", window.location.href).href;
    root.innerHTML = `
      <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:var(--glass-2)">
        <div class="muted small">Conductors use a separate, no-login page with just a trip code — pick a trip below, then share access.</div>
        <a class="btn sm" href="${esc(portalBaseUrl)}" target="_blank" rel="noopener">Open Conductor Portal ↗</a>
      </div>
      <div class="card card-pad">
        <div class="row-3">
          <div class="field-v">
            <label for="cvTrip">Trip</label>
            <select id="cvTrip">
              ${trips.map((t, i) => `<option value="${i}">${esc(t.from)} → ${esc(t.to)} · ${esc(t.time)} (${esc(t.busLabel)})</option>`).join("")}
            </select>
          </div>
          <div class="field-v"><label for="cvDate">Travel date</label><input type="date" id="cvDate" value="2026-08-02" /></div>
          <div class="field-v">
            <label>&nbsp;</label>
            <button class="btn brand block" id="cvShareBtn">📱 Share access code with conductor</button>
          </div>
        </div>
        <div class="muted small" id="cvCrewLine" style="margin-top:10px">&nbsp;</div>
      </div>
      <div id="cvBody"></div>
    `;

    async function draw() {
      const trip = trips[Number($("#cvTrip", root).value)];
      const date = $("#cvDate", root).value;
      $("#cvCrewLine", root).textContent = (trip.driverName || trip.conductorName)
        ? `Driver: ${trip.driverName || "—"} · Conductor: ${trip.conductorName || "—"}`
        : "No crew assigned to this departure yet.";

      const { manifest, takenSeats, capacity } = await OpsAPI.getManifest(trip.from, trip.to, date, trip.time, trip.capacity);
      $("#cvBody", root).innerHTML = `
        <div class="grid-2">
          <div class="card card-pad">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <h3>Seat chart</h3>
              <span class="badge info">${takenSeats.length}/${capacity} booked</span>
            </div>
            <div class="seat-legend">
              <span><span class="legend-chip" style="background:var(--wa-08)"></span>Available</span>
              <span><span class="legend-chip" style="background:var(--danger)"></span>Booked</span>
            </div>
            <div class="seat-map" id="cvSeatMap"></div>
          </div>
          <div class="card card-pad">
            <h3 style="margin-bottom:10px">Manifest</h3>
            <div id="cvManifest" style="display:flex;flex-direction:column;gap:8px"></div>
          </div>
        </div>
      `;

      // seat chart — same numbering as the real BT Express paper sheet
      const seatRows = SeatLayout.generate(capacity);
      const seatsHTML = seatRows.map(row => {
        const seatDivs = row.seats.map((n, i) => {
          const id = String(n);
          const isTaken = takenSeats.includes(id);
          const aisle = (row.type === "pair" && i === 1) ? `<div class="aisle"></div>` : "";
          return `<div class="seat ${isTaken ? "taken" : "free"}" data-seat="${id}">${id}</div>${aisle}`;
        }).join("");
        return `<div class="seat-row seat-row-${row.type}">${seatDivs}</div>`;
      }).join("");
      $("#cvSeatMap", root).innerHTML = seatsHTML;

      $$(".seat.taken", root).forEach(el => el.addEventListener("click", () => {
        const booking = manifest.find(b => b.seats.includes(el.dataset.seat));
        openSeatDetail(el.dataset.seat, booking);
      }));
      $$(".seat.free", root).forEach(el => el.addEventListener("click", () => {
        openCounterBooking(trip, date, el.dataset.seat, draw);
      }));

      // manifest list
      $("#cvManifest", root).innerHTML = manifest.length ? manifest.map(b => `
        <div class="dep-row" style="grid-template-columns:auto 1fr auto">
          <div class="dep-time">${b.seats.join(",")}</div>
          <div>
            <div class="cell-strong">${esc(b.passengerName)}</div>
            <div class="cell-sub">${esc(b.pickupPoint || "—")} · ${b.source === "counter" ? "counter booking" : "self-booked"}</div>
          </div>
          <a class="btn sm" href="tel:${esc(b.phone)}">📞 ${esc(b.phone)}</a>
        </div>
      `).join("") : emptyHTML("No seats booked for this trip yet.");
    }

    function openSeatDetail(seat, booking) {
      if (!booking) return;
      const body = openForm(`Seat ${seat}`, `
        <div class="form-grid">
          <div class="field-v"><label>Passenger</label><div class="cell-strong" style="font-size:16px">${esc(booking.passengerName)}</div></div>
          <div class="row-2">
            <div class="field-v"><label>Phone</label><div><a class="btn block" href="tel:${esc(booking.phone)}">📞 ${esc(booking.phone)}</a></div></div>
            <div class="field-v"><label>Pickup point</label><div class="cell-strong">${esc(booking.pickupPoint || "—")}</div></div>
          </div>
          <div class="field-v"><label>Booking ref</label><div class="cell-mono">${esc(booking.pnr)} · ${esc(booking.source === "counter" ? "counter booking" : "self-booked")}</div></div>
        </div>
      `);
    }

    function openCounterBooking(trip, date, seat, onDone) {
      const body = openForm(`Book seat ${seat} at the counter`, `
        <form id="counterForm" class="form-grid">
          <div class="field-v"><label for="cbName">Passenger name</label><input type="text" id="cbName" required /></div>
          <div class="row-2">
            <div class="field-v"><label for="cbPhone">Phone</label><input type="tel" id="cbPhone" placeholder="07X XXX XXXX" required /></div>
            <div class="field-v"><label for="cbPickup">Pickup point</label><input type="text" id="cbPickup" value="${esc(trip.from)}" /></div>
          </div>
          <button class="btn brand" type="submit">Confirm booking — seat ${seat}</button>
        </form>
      `);
      Validate.attachPhoneMask($("#cbPhone", body));
      $("#cbPhone", body).addEventListener("blur", () => {
        const v = $("#cbPhone", body).value.trim();
        Validate.setFieldError($("#cbPhone", body), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number" : "");
      });
      $("#counterForm", body).addEventListener("submit", async (e) => {
        e.preventDefault();
        const phone = $("#cbPhone", body).value.trim();
        if (!Validate.isValidPhone(phone)) {
          Validate.setFieldError($("#cbPhone", body), "Enter a valid mobile number, e.g. 077 123 4567");
          toast("Please fix the highlighted field.");
          return;
        }
        await OpsAPI.counterBooking({
          from: trip.from, to: trip.to, date, depTime: trip.time,
          plate: trip.busLabel, pickupPoint: $("#cbPickup", body).value.trim() || trip.from,
          passengerName: $("#cbName", body).value.trim(),
          phone,
          seats: [seat],
        });
        closeModal("formModal");
        toast(`Seat ${seat} booked at the counter.`);
        onDone();
      });
    }

    $("#cvTrip", root).addEventListener("change", draw);
    $("#cvDate", root).addEventListener("change", draw);
    $("#cvShareBtn", root).addEventListener("click", async () => {
      const trip = trips[Number($("#cvTrip", root).value)];
      const date = $("#cvDate", root).value;
      const { code } = await OpsAPI.getTripCode(trip.from, trip.to, date, trip.time, {
        capacity: trip.capacity, busLabel: trip.busLabel, driverName: trip.driverName, conductorName: trip.conductorName,
      });
      const portalUrl = new URL(`../conductor/index.html?code=${code}`, window.location.href).href;
      openForm("Share with conductor", `
        <div class="form-grid">
          <p class="muted small">No login needed — the conductor opens this link on their own phone. It only unlocks <strong>this one trip</strong>, nothing else on the dashboard.</p>
          <div class="field-v">
            <label>Access code</label>
            <div class="cell-mono" style="font-size:28px;font-weight:800;letter-spacing:4px;text-align:center;padding:14px;background:var(--glass-2);border-radius:12px">${code}</div>
          </div>
          <div class="field-v">
            <label>Trip</label>
            <div class="cell-strong">${esc(trip.from)} → ${esc(trip.to)} · ${esc(trip.time)} · ${esc(date)}</div>
          </div>
          <div class="field-v">
            <label>Link to send them (WhatsApp, SMS, etc.)</label>
            <input type="text" readonly value="${esc(portalUrl)}" id="portalUrlInput" style="font-family:var(--mono);font-size:11.5px" />
          </div>
          <div class="row-2">
            <button class="btn block" id="copyLinkBtn" type="button">Copy link</button>
            <a class="btn brand block" href="${esc(portalUrl)}" target="_blank" rel="noopener">Open portal now ↗</a>
          </div>
        </div>
      `);
      $("#copyLinkBtn")?.addEventListener("click", () => {
        navigator.clipboard?.writeText(portalUrl);
        $("#portalUrlInput")?.select();
        toast("Link copied — send it to your conductor.");
      });
    });
    draw();
  }
  ROUTES_MAP.conductor = { title: 'Conductor View', sub: 'Confirm seats, view pickup contacts, and take counter bookings per trip.', render: renderConductor };
})();
