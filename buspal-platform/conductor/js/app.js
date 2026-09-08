(() => {
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
  const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("buspal-theme", next);
  });

  function toast(msg, ms = 2600) {
    const t = $("#toast");
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
  }
  function closeModal(id) { document.getElementById(id).classList.remove("open"); }
  $("#formModalClose").addEventListener("click", () => closeModal("formModal"));
  function openForm(title, bodyHTML) {
    $("#formModalTitle").textContent = title;
    $("#formModalBody").innerHTML = bodyHTML;
    openModal("formModal");
    return $("#formModalBody");
  }

  let currentTrip = null;

  // ---- code entry ----
  $("#codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const code = $("#codeInput").value.trim().toUpperCase();
    const trip = BusPalStore.getTripByCode(code);
    if (!trip) {
      $("#codeError").textContent = "That code isn't valid — check with your Owner/Manager.";
      return;
    }
    $("#codeError").textContent = "";
    currentTrip = trip;
    $("#gate").hidden = true;
    $("#tripView").hidden = false;
    renderTrip();
  });
  $("#codeInput").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

  function renderTrip() {
    const t = currentTrip;
    $("#tripView").innerHTML = `
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">
          <div>
            <div class="route-title">${esc(t.from)} <span class="hc-arrow">→</span> ${esc(t.to)}</div>
            <div class="route-meta">${esc(t.date)} · ${esc(t.depTime)} · ${esc(t.busLabel || "Bus TBA")}</div>
            <div class="muted small" style="margin-top:4px">${(t.driverName || t.conductorName) ? `Driver: ${esc(t.driverName || "—")} · Conductor: ${esc(t.conductorName || "—")}` : ""}</div>
          </div>
          <button class="btn ghost sm" id="switchTripBtn">Different trip</button>
        </div>
      </div>
      <div class="card card-pad">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <h3>Seat chart</h3>
          <span class="badge info" id="cBadge"></span>
        </div>
        <div class="seat-legend">
          <span><span class="legend-chip" style="background:var(--wa-08)"></span>Available</span>
          <span><span class="legend-chip" style="background:var(--danger)"></span>Booked</span>
        </div>
        <div class="seat-map" id="cSeatMap"></div>
      </div>
      <div class="card card-pad">
        <h3 style="margin-bottom:10px">Manifest</h3>
        <div id="cManifest" style="display:flex;flex-direction:column;gap:8px"></div>
      </div>
    `;
    $("#switchTripBtn").addEventListener("click", () => {
      currentTrip = null;
      $("#tripView").hidden = true;
      $("#gate").hidden = false;
      $("#codeInput").value = "";
      $("#codeInput").focus();
    });
    drawSeats();
  }

  function drawSeats() {
    const t = currentTrip;
    const capacity = t.capacity || 40;
    const manifest = BusPalStore.getManifest(t.from, t.to, t.date, t.depTime);
    const takenSeats = manifest.flatMap(b => b.seats);
    $("#cBadge").textContent = `${takenSeats.length}/${capacity} booked`;

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
    $("#cSeatMap").innerHTML = seatsHTML;

    $$(".seat.taken", document).forEach(el => el.addEventListener("click", () => {
      const booking = manifest.find(b => b.seats.includes(el.dataset.seat));
      if (booking) openSeatDetail(el.dataset.seat, booking);
    }));
    $$(".seat.free", document).forEach(el => el.addEventListener("click", () => openCounterBooking(el.dataset.seat)));

    $("#cManifest").innerHTML = manifest.length ? manifest.map(b => `
      <div class="dep-row" style="grid-template-columns:auto 1fr auto">
        <div class="dep-time">${b.seats.join(",")}</div>
        <div>
          <div class="cell-strong">${esc(b.passengerName)}</div>
          <div class="cell-sub">${esc(b.pickupPoint || "—")} · ${b.source === "counter" ? "counter booking" : "self-booked"}</div>
        </div>
        <a class="btn sm" href="tel:${esc(b.phone)}">📞 ${esc(b.phone)}</a>
      </div>
    `).join("") : `<div class="empty"><div class="ico">◇</div>No seats booked for this trip yet.</div>`;
  }

  function openSeatDetail(seat, booking) {
    openForm(`Seat ${seat}`, `
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

  function openCounterBooking(seat) {
    const t = currentTrip;
    const body = openForm(`Book seat ${seat} at the counter`, `
      <form id="counterForm" class="form-grid">
        <div class="field-v"><label for="cbName">Passenger name</label><input type="text" id="cbName" required /></div>
        <div class="row-2">
          <div class="field-v"><label for="cbPhone">Phone</label><input type="tel" id="cbPhone" placeholder="07X XXX XXXX" required /></div>
          <div class="field-v"><label for="cbPickup">Pickup point</label><input type="text" id="cbPickup" value="${esc(t.from)}" /></div>
        </div>
        <button class="btn brand" type="submit">Confirm booking — seat ${seat}</button>
      </form>
    `);
    Validate.attachPhoneMask($("#cbPhone", body));
    $("#cbPhone", body).addEventListener("blur", () => {
      const v = $("#cbPhone", body).value.trim();
      Validate.setFieldError($("#cbPhone", body), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number" : "");
    });
    $("#counterForm", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = $("#cbPhone", body).value.trim();
      if (!Validate.isValidPhone(phone)) {
        Validate.setFieldError($("#cbPhone", body), "Enter a valid mobile number, e.g. 077 123 4567");
        toast("Please fix the highlighted field.");
        return;
      }
      BusPalStore.createBooking({
        passengerId: null, passengerName: $("#cbName", body).value.trim(), phone,
        from: t.from, to: t.to, date: t.date, depTime: t.depTime, plate: t.busLabel || "",
        pickupPoint: $("#cbPickup", body).value.trim() || t.from, seats: [seat], source: "counter",
      });
      closeModal("formModal");
      toast(`Seat ${seat} booked at the counter.`);
      drawSeats();
    });
  }

  $("#codeInput").focus();

  // If opened via a shared link like conductor/index.html?code=TS22HY,
  // fill it in and open the trip automatically — one tap for the conductor.
  const urlCode = new URLSearchParams(window.location.search).get("code");
  if (urlCode) {
    $("#codeInput").value = urlCode.toUpperCase();
    $("#codeForm").dispatchEvent(new Event("submit", { cancelable: true }));
  }
})();
