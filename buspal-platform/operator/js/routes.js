/* ============================================================
   BusPal — Operator Dashboard — Routes & Schedules
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
    const routeFrom = (r) =>
    r.from ?? r.from_city ?? "";

  const routeTo = (r) =>
    r.to ?? r.to_city ?? "";
  async function renderRoutes(root) {
    root.innerHTML = `<div class="empty"><div class="ico">⌁</div>Loading routes…</div>`;
    const [routes, buses, staff] = await Promise.all([OpsAPI.getRoutes(), OpsAPI.getBuses(), OpsAPI.getStaff()]);
    const drivers = staff.filter(s => s.role === "driver");
    const conductors = staff.filter(s => s.role === "conductor");
    const visibleCount = routes.filter(r => r.visible).length;
    const totalDeps = routes.reduce((s, r) => s + r.departures.length, 0);
    const avgFare = routes.length ? Math.round(routes.reduce((s, r) => s + r.fare, 0) / routes.length) : 0;

    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card"><div class="k">${routes.length}</div><div class="l">Total routes</div></div>
        <div class="stat-card"><div class="k" style="color:var(--brand-2)">${visibleCount}</div><div class="l">Visible to passengers</div></div>
        <div class="stat-card"><div class="k">${totalDeps}</div><div class="l">Scheduled departures</div></div>
        <div class="stat-card"><div class="k">${fmtLKR(avgFare)}</div><div class="l">Average fare</div></div>
      </div>
      <div class="section-toolbar">
        <div class="filters"><input class="filter-input" id="routeSearch" placeholder="Search by city…" /></div>
        <button class="btn brand" id="addRouteBtn">+ Add route</button>
      </div>
      <div id="routeList" style="display:flex;flex-direction:column;gap:14px"></div>
    `;

    function selectOptions(list, selectedId, placeholder) {
      return `<option value="">${placeholder}</option>` +
        list.map(p => `<option value="${p.id}" ${p.id === selectedId ? "selected" : ""}>${esc(p.name || p.plate)}</option>`).join("");
    }

    function draw() {
      const q = $("#routeSearch", root).value.trim().toLowerCase();
      const rows = routes.filter(r => {
  const from = routeFrom(r).toLowerCase();
  const to = routeTo(r).toLowerCase();

  return !q || from.includes(q) || to.includes(q);
});
      $("#routeList", root).innerHTML = rows.length ? rows.map(r => `
        <div class="card route-card ${r.visible ? "is-visible" : ""}">
          <div class="route-card-head">
            <div>
              <div class="route-title"> ${esc(routeFrom(r))} <span class="hc-arrow">→</span>${esc(routeTo(r))}
                <span class="pill ${r.visible ? "active" : "hidden-pill"}">${r.visible ? "visible to passengers" : "hidden"}</span>
              </div>
              <div class="route-chip-row">
                <span class="route-chip">📏 ${r.distanceKm} km</span>
                <span class="route-chip">💵 ${fmtLKR(r.fare)}</span>
                <span class="route-chip">🕑 ${r.departures.length} departure${r.departures.length === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div class="route-card-actions">
              <label class="toggle">
                <input type="checkbox" ${r.visible ? "checked" : ""} data-toggle-route="${r.id}" />
                <span class="toggle-track"></span>
                <span class="toggle-label">Show to passengers</span>
              </label>
              <button class="icon-btn" title="Edit route" data-edit-route="${r.id}">✎</button>
              <button class="icon-btn danger" title="Delete route" data-del-route="${r.id}">🗑</button>
            </div>
          </div>

          <div class="dep-list">
            ${r.departures.map(d => `
              <div class="dep-row">
                <div class="dep-time">${esc(d.time)}</div>
                <div class="dep-field"><span class="dep-field-label">Bus</span><select data-assign="bus" data-route="${r.id}" data-dep="${d.id}">${selectOptions(buses, d.busId, "Assign bus…")}</select></div>
                <div class="dep-field"><span class="dep-field-label">Driver</span><select data-assign="driver" data-route="${r.id}" data-dep="${d.id}">${selectOptions(drivers, d.driverId, "Assign driver…")}</select></div>
                <div class="dep-field"><span class="dep-field-label">Conductor</span><select data-assign="conductor" data-route="${r.id}" data-dep="${d.id}">${selectOptions(conductors, d.conductorId, "Assign conductor…")}</select></div>
                <div class="td-actions">
                  <button class="icon-btn" title="${d.busId ? "Start live tracking for this departure" : "Assign a bus first"}" ${d.busId ? "" : "disabled"} data-quick-track="${r.id}:${d.id}">▶</button>
                  <button class="icon-btn danger" title="Remove departure" data-del-dep="${r.id}:${d.id}">🗑</button>
                </div>
              </div>
            `).join("") || `<div class="dep-empty-note">No departures scheduled yet.</div>`}
          </div>
          <div style="margin-top:10px">
            <button class="btn sm" data-add-dep="${r.id}">+ Add departure time</button>
          </div>
        </div>
      `).join("") : emptyHTML("No routes match your search.");
      bindRouteActions();
    }

    function bindRouteActions() {
      $$("[data-toggle-route]", root).forEach(el => el.addEventListener("change", async () => {
        await OpsAPI.toggleRouteVisible(el.dataset.toggleRoute);
        toast("Route visibility updated.");
        go("routes");
      }));
      $$("[data-edit-route]", root).forEach(b =>
  b.addEventListener("click", () => {
    const route = routes.find(
      r => Number(r.id) === Number(b.dataset.editRoute)
    );

    if (!route) {
      toast("Route not found.");
      return;
    }

    openRouteForm(route);
  })
);
      $$("[data-del-route]", root).forEach(b => b.addEventListener("click", () => {
         const r = routes.find(
  x => Number(x.id) === Number(b.dataset.delRoute)
);

if (!r) {
  toast("Route not found.");
  return;
}
        confirmAction(`Delete route <strong>${esc(r.from)} → ${esc(r.to)}</strong> and all its departures?`, async () => {
          await OpsAPI.deleteRoute(r.id);
          toast("Route deleted.");
          go("routes");
        });
      }));
      $$("[data-assign]", root).forEach(sel => sel.addEventListener("change", async () => {
        const field = sel.dataset.assign === "bus" ? "busId" : sel.dataset.assign === "driver" ? "driverId" : "conductorId";
        await OpsAPI.updateDeparture(sel.dataset.route, sel.dataset.dep, { [field]: sel.value });
        toast("Assignment saved.");
        go("routes");
      }));
      $$("[data-quick-track]", root).forEach(b => b.addEventListener("click", () => {
        const [routeId, depId] = b.dataset.quickTrack.split(":");
        window.__pendingTrackTrip = { routeId, depId };
        go("tracking");
      }));
      $$("[data-del-dep]", root).forEach(b => b.addEventListener("click", async () => {
        const [routeId, depId] = b.dataset.delDep.split(":");
        await OpsAPI.deleteDeparture(routeId, depId);
        toast("Departure removed.");
        go("routes");
      }));
      $$("[data-add-dep]", root).forEach(b =>
  b.addEventListener("click", async () => {
    let time = prompt("Departure time (HH:MM)", "07:00");

    if (!time) return;

    // Accept both 10:00 and 10.00
    time = time.trim().replace(".", ":");

    // Validate HH:MM
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

    if (!match) {
      toast("Enter the time as HH:MM, for example 10:00.");
      return;
    }

    try {
      await OpsAPI.addDeparture(
        b.dataset.addDep,
        { time }
      );

      toast(`Departure ${time} added.`);
      go("routes");
    } catch (error) {
      console.error("Add departure failed:", error);
      toast(error.message || "Unable to add departure.");
    }
  })
);
    }
    $("#routeSearch", root).addEventListener("input", draw);
    $("#addRouteBtn", root).addEventListener("click", () => openRouteForm());
    draw();
  }

  function openRouteForm(route) {
    const isEdit = !!route;
    const body = openForm(isEdit ? "Edit route" : "Add route", `
      <form id="routeForm" class="form-grid">
        <div class="row-2">
          <div class="field-v"><label for="rfFrom">From</label><input type="text" id="rfFrom"  value="${esc(route ? routeFrom(route) : "")}" placeholder="e.g. Colombo" required /></div>
          <div class="field-v"><label for="rfTo">To</label><input type="text" id="rfTo"  value="${esc(route ? routeTo(route) : "")}" placeholder="e.g. Kandy" required /></div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="rfDist">Distance (km)</label><input type="text" inputmode="numeric" id="rfDist" value="${route?.distanceKm ?? ""}" /></div>
          <div class="field-v"><label for="rfFare">Fare (LKR)</label><input type="text" inputmode="numeric" id="rfFare" value="${route?.fare ?? ""}" /></div>
        </div>
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Add route"}</button>
      </form>
    `);
    $("#routeForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        from: $("#rfFrom", body).value.trim(),
        to: $("#rfTo", body).value.trim(),
        distanceKm: Number($("#rfDist", body).value) || 0,
        fare: Number($("#rfFare", body).value) || 0,
      };
      if (!data.from || !data.to) { toast("From and To are required."); return; }
      if (isEdit) await OpsAPI.updateRoute(route.id, data); else await OpsAPI.createRoute(data);
      closeModal("formModal");
      toast(isEdit ? "Route updated." : "Route added.");
      go("routes");
    });
  }
  ROUTES_MAP.routes = { title: 'Routes & Schedules', sub: 'Manage routes, departures, and crew assignments.', render: renderRoutes };
})();
