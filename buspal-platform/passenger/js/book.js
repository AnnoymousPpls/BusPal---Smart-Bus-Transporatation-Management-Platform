/* ============================================================
   BusPal — Passenger Dashboard — Book a Trip
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderBook(root) {
    root.innerHTML = `
      <div class="card card-pad">
        <form id="searchForm" class="row-3">
          <div class="field-v">
            <label for="fFrom">From</label>
            <input type="text" id="fFrom" placeholder="e.g. Colombo" value="Colombo" />
          </div>
          <div class="field-v">
            <label for="fTo">To</label>
            <input type="text" id="fTo" placeholder="e.g. Kandy" />
          </div>
          <div class="field-v">
            <label for="fDate">Date</label>
            <input type="date" id="fDate" value="2026-08-02" />
          </div>
          <div style="grid-column:1/-1">
            <button class="btn brand" type="submit">Search buses</button>
          </div>
        </form>
      </div>
      <div id="tripResults" style="display:flex;flex-direction:column;gap:12px"></div>
    `;

    const resultsEl = $("#tripResults", root);
    async function runSearch(e) {
      e?.preventDefault();
      resultsEl.innerHTML = `<div class="empty"><div class="ico">⌕</div>Searching…</div>`;
      const trips = await BusPalAPI.searchTrips({
        from: $("#fFrom", root).value.trim(),
        to: $("#fTo", root).value.trim(),
        date: $("#fDate", root).value,
      });
      resultsEl.innerHTML = trips.length
        ? trips.map(tripCardHTML).join("")
        : emptyHTML("No buses match that search — try a different route or date.");
      $$(".btn-select-seats", resultsEl).forEach(btn =>
        btn.addEventListener("click", () => openSeatModal(btn.dataset.tripId)));
    }
    $("#searchForm", root).addEventListener("submit", runSearch);
    runSearch();
  }

  function tripCardHTML(t) {
    const low = t.seatsAvailable <= 4;
    const photo = BusPalStore.getBusPhotos(t.plate)[0];
    const photoHTML = photo
      ? `<img class="trip-photo" src="${photo}" alt="${esc(t.plate)}" />`
      : `<div class="trip-photo-placeholder">🚌</div>`;
    return `
      <div class="trip-card">
        <div style="display:flex;align-items:center;gap:10px">
          ${photoHTML}
          <div class="trip-time">
            <div class="t">${t.depTime}</div>
            <div class="d">${t.from}</div>
          </div>
        </div>
        <div>
          <div class="trip-route">
            <div class="trip-time"><div class="t">${t.arrTime}</div><div class="d">${t.to}</div></div>
            <div class="route-line"></div>
            <span class="muted small">${t.duration}</span>
          </div>
          <div class="trip-meta">
            <span class="badge info">${t.busType}</span>
            <span class="badge ${low ? "warn" : "ok"}">${t.seatsAvailable} seats left</span>
            <span class="muted small">Bus ${t.plate} · ${t.date}</span>
          </div>
        </div>
        <div class="trip-price">
          <div class="p">${fmtLKR(t.price)}</div>
          <div class="muted small" style="margin-bottom:8px">per seat</div>
          <button class="btn brand btn-select-seats" data-trip-id="${t.id}" ${t.seatsAvailable === 0 ? "disabled" : ""}>
            ${t.seatsAvailable === 0 ? "Sold out" : "Select seats"}
          </button>
        </div>
      </div>`;
  }

  // ---------- seat modal ----------
  async function openSeatModal(tripId) {
    const trip = await BusPalAPI.getTrip(tripId);
    seatSelection = { tripId, trip, seats: new Set() };
    $("#seatModalTitle").textContent = `${trip.from} → ${trip.to}`;
    $("#seatModalSub").textContent = `${trip.date} · ${trip.depTime} departure · ${trip.busType}`;
    $("#seatModalBody").innerHTML = seatModalBodyHTML(trip);
    bindSeatMap();
    openModal("seatModal");
  }

  function seatMapHTML(seatsTotal, seatsTaken) {
    const rows = SeatLayout.generate(seatsTotal);
    return rows.map(row => {
      const seatDivs = row.seats.map((n, i) => {
        const id = String(n);
        const taken = seatsTaken.includes(id);
        // aisle gap after the 2nd seat, but only in normal 2+2 rows — the
        // back bench spans the full width with no gap, like the real sheet.
        const aisle = (row.type === "pair" && i === 1) ? `<div class="aisle"></div>` : "";
        return `<div class="seat ${taken ? "taken" : "free"}" data-seat="${id}">${id}</div>${aisle}`;
      }).join("");
      return `<div class="seat-row seat-row-${row.type}">${seatDivs}</div>`;
    }).join("");
  }

  function seatModalBodyHTML(trip) {
    return `
      <div class="seat-legend">
        <span><span class="legend-chip" style="background:rgba(255,255,255,.08)"></span>Available</span>
        <span><span class="legend-chip" style="background:var(--danger)"></span>Taken</span>
        <span><span class="legend-chip" style="background:var(--brand)"></span>Selected</span>
      </div>
      <div class="seat-map">${seatMapHTML(trip.seatsTotal, trip.seatsTaken)}</div>
      <div class="grid-2" style="align-items:center">
        <div>
          <div class="muted small">Selected seats</div>
          <div id="seatSummary" style="font-family:var(--mono);font-weight:600;margin-top:4px">None yet</div>
        </div>
        <div style="text-align:right">
          <div class="muted small">Total</div>
          <div id="seatTotal" style="font-size:19px;font-weight:800;font-family:var(--mono)">${fmtLKR(0)}</div>
        </div>
      </div>
      <button class="btn brand block" id="confirmSeats" style="margin-top:14px" disabled>Confirm booking</button>
    `;
  }

  function bindSeatMap() {
    const body = $("#seatModalBody");
    $$(".seat.free", body).forEach(seat => {
      seat.addEventListener("click", () => {
        const id = seat.dataset.seat;
        if (seatSelection.seats.has(id)) { seatSelection.seats.delete(id); seat.classList.remove("selected"); }
        else { seatSelection.seats.add(id); seat.classList.add("selected"); }
        const list = [...seatSelection.seats];
        $("#seatSummary", body).textContent = list.length ? list.join(", ") : "None yet";
        $("#seatTotal", body).textContent = fmtLKR(list.length * seatSelection.trip.price);
        $("#confirmSeats", body).disabled = list.length === 0;
      });
    });
    $("#confirmSeats", body).addEventListener("click", confirmBooking);
  }

  async function confirmBooking() {
    const btn = $("#confirmSeats");
    btn.disabled = true;
    btn.textContent = "Booking…";
    const booking = await BusPalAPI.createBooking({
      tripId: seatSelection.tripId,
      seats: [...seatSelection.seats],
    });
    closeModal("seatModal");
    toast(`Booking confirmed — ${booking.seats.join(", ")} on ${booking.trip.from} → ${booking.trip.to}`);
    $("#passModalBody").innerHTML = boardingPassHTML(booking);
    openModal("passModal");
  }

  ROUTES.book = { title: "Book a Trip", sub: "Search routes and reserve your seat.", render: renderBook };
})();
