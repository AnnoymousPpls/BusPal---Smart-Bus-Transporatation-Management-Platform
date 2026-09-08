/* ============================================================
   BusPal — Operator Dashboard — Live Tracking
   Full CRUD over live tracking sessions: start tracking a scheduled
   departure, advance its current stop as the trip progresses, edit
   its ETA, and end/delete it. The passenger dashboard's Live Tracking
   page reads whichever active session matches their own booking —
   same shared-store pattern as bookings/feedback/SOS.
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderTracking(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◎</div>Loading…</div>`;
    const [trips, liveTrips] = await Promise.all([OpsAPI.getTrackableTrips(), OpsAPI.getLiveTrips()]);
    const active = liveTrips.filter(t => t.status === "in-progress");

    root.innerHTML = `
      <div class="section-toolbar">
        <div>
          <h3 style="margin-bottom:2px">Active trips</h3>
          <p class="muted small" style="margin-top:2px">Passengers on these trips see live progress on their own Live Tracking page.</p>
        </div>
        <button class="btn brand" id="startTrackingBtn">+ Start tracking a trip</button>
      </div>
      <div id="activeListWrap" style="display:flex;flex-direction:column;gap:14px;margin-bottom:20px"></div>

      <h3 style="margin-bottom:10px">Recently completed</h3>
      <div id="completedListWrap"></div>
    `;

    function draw() {
      $("#activeListWrap", root).innerHTML = active.length ? active.map(t => trackingCardHTML(t)).join("") : emptyHTML("No trips currently being tracked.");
      bindCardActions();

      const completed = liveTrips.filter(t => t.status === "completed").slice(0, 6);
      $("#completedListWrap", root).innerHTML = completed.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Route</th><th>Date</th><th>Bus</th><th></th></tr></thead>
            <tbody>
              ${completed.map(t => `
                <tr>
                  <td class="cell-strong">${esc(t.from)} → ${esc(t.to)}</td>
                  <td class="cell-mono">${esc(t.date)} · ${esc(t.depTime)}</td>
                  <td>${esc(t.busPlate || "—")}</td>
                  <td class="td-actions"><button class="icon-btn danger" title="Delete record" data-del-live="${t.id}">🗑</button></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : emptyHTML("No completed trips yet.");
      $$("[data-del-live]", root).forEach(b => b.addEventListener("click", () => {
        confirmAction("Delete this tracking record?", async () => {
          await OpsAPI.deleteLiveTrip(b.dataset.delLive);
          toast("Record deleted.");
          go("tracking");
        });
      }));
    }

    function trackingCardHTML(t) {
      const doneCount = t.stops.filter(s => s.status === "done").length;
      const visible = t.visible !== false;
      return `
        <div class="card card-pad">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <div class="route-title">${esc(t.from)} <span class="hc-arrow">→</span> ${esc(t.to)}
                <span class="pill ${visible ? "active" : "hidden-pill"}">${visible ? "visible to passengers" : "hidden"}</span>
              </div>
              <div class="route-meta">${esc(t.date)} · ${esc(t.depTime)} · ${esc(t.busPlate || "Bus TBA")}${t.driverName ? " · Driver " + esc(t.driverName) : ""}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <label class="toggle">
                <input type="checkbox" ${visible ? "checked" : ""} data-toggle-visible="${t.id}" />
                <span class="toggle-track"></span>
                <span class="toggle-label">Show to passengers</span>
              </label>
              <span class="badge info">ETA ${formatEta(t.etaMinutes)}</span>
            </div>
          </div>

          <div class="route-progress">
            ${t.stops.map(s => `
              <div class="rp-stop ${s.status}">
                <div class="rp-line"></div>
                <div class="rp-dot"></div>
                <div class="rp-label">${esc(s.name)}</div>
              </div>`).join("")}
          </div>

          <div class="section-toolbar" style="margin-top:14px">
            <div class="filters" style="align-items:center">
              <span class="muted small">New ETA:</span>
              <input class="filter-input" type="number" min="0" placeholder="hrs" style="width:64px" value="${Math.floor(t.etaMinutes / 60)}" data-eta-hours="${t.id}" />
              <input class="filter-input" type="number" min="0" max="59" placeholder="min" style="width:64px" value="${t.etaMinutes % 60}" data-eta-mins="${t.id}" />
              <button class="btn sm" data-save-eta="${t.id}">Update ETA</button>
            </div>
            <div style="display:flex;gap:8px">
              ${doneCount < t.stops.length - 1
                ? `<button class="btn sm brand" data-advance="${t.id}">Advance to next stop →</button>`
                : `<span class="muted small" style="align-self:center">Final stop reached</span>`}
              <button class="btn sm danger" data-end="${t.id}">End trip</button>
            </div>
          </div>
        </div>
      `;
    }

    function bindCardActions() {
      $$("[data-advance]", root).forEach(b => b.addEventListener("click", async () => {
        await OpsAPI.advanceLiveTrip(b.dataset.advance);
        toast("Advanced to next stop.");
        go("tracking");
      }));
      $$("[data-end]", root).forEach(b => b.addEventListener("click", () => {
        confirmAction("End tracking for this trip? Passengers will stop seeing live progress.", async () => {
          await OpsAPI.endLiveTrip(b.dataset.end);
          toast("Trip tracking ended.");
          go("tracking");
        });
      }));
      $$("[data-save-eta]", root).forEach(b => b.addEventListener("click", async () => {
        const hrs = Number($(`[data-eta-hours="${b.dataset.saveEta}"]`, root).value) || 0;
        const mins = Number($(`[data-eta-mins="${b.dataset.saveEta}"]`, root).value) || 0;
        await OpsAPI.updateLiveTrip(b.dataset.saveEta, { etaMinutes: hrs * 60 + mins });
        toast("ETA updated.");
        go("tracking");
      }));
      $$("[data-toggle-visible]", root).forEach(el => el.addEventListener("change", async () => {
        await OpsAPI.toggleLiveTripVisibility(el.dataset.toggleVisible);
        toast("Visibility updated.");
        go("tracking");
      }));
    }

    $("#startTrackingBtn", root).addEventListener("click", () => openStartTrackingForm(trips));
    draw();

    // If Routes & Schedules sent us here with a specific departure to
    // track (its "▶ Track" shortcut), open the form pre-filled for it.
    if (window.__pendingTrackTrip) {
      const pending = window.__pendingTrackTrip;
      window.__pendingTrackTrip = null;
      const idx = trips.findIndex(t => t.routeId === pending.routeId && t.depId === pending.depId);
      if (idx >= 0) openStartTrackingForm(trips, idx);
    }
  }

  function openStartTrackingForm(trips, preselectIndex) {
    if (!trips.length) { toast("Add a route with departures first, under Routes & Schedules."); return; }
    const body = openForm("Start tracking a trip", `
      <form id="startTrackingForm" class="form-grid">
        <div class="field-v">
          <label for="ltTrip">Trip</label>
          <select id="ltTrip">
            ${trips.map((t, i) => `<option value="${i}" ${preselectIndex === i ? "selected" : ""}>${esc(t.from)} → ${esc(t.to)} · ${esc(t.time)} (${esc(t.busPlate)})</option>`).join("")}
          </select>
        </div>
        <div class="field-v"><label for="ltDate">Travel date</label><input type="date" id="ltDate" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field-v">
          <label>Initial ETA</label>
          <div class="row-2">
            <input type="text" inputmode="numeric" id="ltEtaHrs" placeholder="Hours" value="2" />
            <input type="text" inputmode="numeric" id="ltEtaMins" placeholder="Minutes" value="45" />
          </div>
          <span class="field-hint">Most intercity trips run a few hours — enter hours and minutes, not just minutes.</span>
        </div>
        <div class="field-v">
          <label for="ltStops">Stops (comma-separated, in order)</label>
          <input type="text" id="ltStops" placeholder="Colombo Fort, Kadawatha, Kegalle, Kandy" />
          <span class="field-hint">First stop starts as "current", last stop is the destination.</span>
        </div>
        <button class="btn brand" type="submit">Start tracking</button>
      </form>
    `);

    // pre-fill a sensible default stop list once a trip is picked
    function fillDefaultStops() {
      const t = trips[Number($("#ltTrip", body).value)];
      $("#ltStops", body).value = `${t.from}, En route, ${t.to}`;
    }
    $("#ltTrip", body).addEventListener("change", fillDefaultStops);
    fillDefaultStops();

    $("#startTrackingForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const t = trips[Number($("#ltTrip", body).value)];
      const stops = $("#ltStops", body).value.split(",").map(s => s.trim()).filter(Boolean);
      if (stops.length < 2) { toast("Enter at least a start and end stop."); return; }
      const hrs = Number($("#ltEtaHrs", body).value) || 0;
      const mins = Number($("#ltEtaMins", body).value) || 0;
      await OpsAPI.startLiveTrip({
        from: t.from, to: t.to, date: $("#ltDate", body).value, depTime: t.time,
        busPlate: t.busPlate, driverName: t.driverName, conductorName: t.conductorName,
        etaMinutes: hrs * 60 + mins || 30,
        stops,
      });
      closeModal("formModal");
      toast("Tracking started.");
      go("tracking");
    });
  }

  ROUTES_MAP.tracking = { title: "Live Tracking", sub: "Start, update, and end live trip tracking for passengers.", render: renderTracking };
})();
