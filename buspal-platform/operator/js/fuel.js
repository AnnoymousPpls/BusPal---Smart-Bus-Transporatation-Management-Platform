/* ============================================================
   BusPal — Operator Dashboard — Fuel & Maintenance
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderFuel(root) {
    root.innerHTML = `<div class="empty"><div class="ico">⛽</div>Loading…</div>`;
    const [log, buses, maintenance, maintLog] = await Promise.all([
      OpsAPI.getFuelLog(), OpsAPI.getBuses(), OpsAPI.getMaintenanceStatus(), OpsAPI.getMaintenanceLog(),
    ]);
    const totalCost = log.reduce((s, f) => s + f.cost, 0);
    const totalLiters = log.reduce((s, f) => s + f.liters, 0);
    const avgCost = totalLiters ? (totalCost / totalLiters) : 0;
    const dueCount = maintenance.filter(m => m.level === "overdue" || m.level === "due-soon").length;

    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card"><div class="k">${fmtLKR(totalCost)}</div><div class="l">Total logged spend</div></div>
        <div class="stat-card"><div class="k">${totalLiters.toLocaleString()} L</div><div class="l">Total fuel logged</div></div>
        <div class="stat-card"><div class="k">${fmtLKR(avgCost.toFixed(0))}</div><div class="l">Avg. cost / liter</div></div>
        <div class="stat-card kpi-clickable" id="maintJumpCard"><div class="k" style="color:${dueCount ? "var(--danger)" : "var(--brand-2)"}">${dueCount}</div><div class="l">Buses due for service</div></div>
      </div>

      <div id="maintenanceCard">
        <div class="section-toolbar" style="margin-bottom:12px">
          <div>
            <h3>Maintenance</h3>
            <p class="muted small" style="margin-top:2px">Track service intervals, send a bus for maintenance, and log service history — per bus.</p>
          </div>
        </div>
        <div class="maint-grid" id="maintGridWrap"></div>
      </div>

      <div class="section-toolbar">
        <div>
          <h3 style="margin-bottom:2px">Service history</h3>
        </div>
        <div class="filters">
          <select class="filter-input" id="maintBusFilter">
            <option value="">All buses</option>
            ${buses.map(b => `<option value="${b.id}">${esc(b.plate)}</option>`).join("")}
          </select>
        </div>
        <button class="btn brand" id="addServiceBtn">+ Log a service</button>
      </div>
      <div id="maintLogTableWrap"></div>

      <div class="section-toolbar">
        <div>
          <h3 style="margin-bottom:2px">Fuel log</h3>
        </div>
        <div class="filters">
          <select class="filter-input" id="fuelBusFilter">
            <option value="">All buses</option>
            ${buses.map(b => `<option value="${b.id}">${esc(b.plate)}</option>`).join("")}
          </select>
        </div>
        <button class="btn brand" id="addFuelBtn">+ Log fuel entry</button>
      </div>
      <div id="fuelTableWrap"></div>
    `;

    drawMaintenance(root, maintenance);
    drawMaintLog(root, maintLog, buses);
    $("#maintJumpCard", root).addEventListener("click", () => $("#maintenanceCard", root).scrollIntoView({ behavior: "smooth" }));
    $("#maintBusFilter", root).addEventListener("change", () => drawMaintLog(root, maintLog, buses));
    $("#addServiceBtn", root).addEventListener("click", () => openServiceForm(buses));

    function drawFuel() {
      const busF = $("#fuelBusFilter", root).value;
      const rows = log.filter(f => !busF || f.busId === busF);
      $("#fuelTableWrap", root).innerHTML = rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Date</th><th>Bus</th><th>Liters</th><th>Cost</th><th>Odometer</th><th>Station</th><th></th></tr></thead>
            <tbody>
              ${rows.map(f => `
                <tr>
                  <td class="cell-mono">${esc(f.date)}</td>
                  <td class="cell-strong">${f.bus ? esc(f.bus.plate) : "—"}</td>
                  <td>${f.liters} L</td>
                  <td class="cell-mono">${fmtLKR(f.cost)}</td>
                  <td class="cell-mono">${Number(f.odometer).toLocaleString()} km</td>
                  <td>${esc(f.station)}</td>
                  <td class="td-actions">
                    <button class="icon-btn" title="Edit" data-edit-fuel="${f.id}">✎</button>
                    <button class="icon-btn danger" title="Delete" data-del-fuel="${f.id}">🗑</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : emptyHTML("No fuel entries logged yet.");
      $$("[data-edit-fuel]", root).forEach(b => b.addEventListener("click", () => {
        openFuelForm(buses, rows.find(f => f.id === b.dataset.editFuel));
      }));
      $$("[data-del-fuel]", root).forEach(b => b.addEventListener("click", () => {
        confirmAction("Delete this fuel entry?", async () => {
          await OpsAPI.deleteFuelEntry(b.dataset.delFuel);
          toast("Fuel entry deleted.");
          go("fuel");
        });
      }));
    }
    $("#fuelBusFilter", root).addEventListener("change", drawFuel);
    $("#addFuelBtn", root).addEventListener("click", () => openFuelForm(buses));
    drawFuel();
  }

  // ---------- maintenance cards ----------
  function drawMaintenance(root, maintenance) {
    const levelOrder = { overdue: 0, "due-soon": 1, ok: 2 };
    const rows = [...maintenance].sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);
    $("#maintGridWrap", root).innerHTML = rows.map(m => maintCardHTML(m)).join("");

    $$("[data-log-service]", root).forEach(b => b.addEventListener("click", () => {
      openServiceForm(maintenance, b.dataset.logService);
    }));
    $$("[data-edit-interval]", root).forEach(b => b.addEventListener("click", () => {
      openIntervalForm(maintenance.find(m => m.id === b.dataset.editInterval));
    }));
    $$("[data-send-maint]", root).forEach(b => b.addEventListener("click", () => {
      openSendToMaintenanceForm(maintenance.find(m => m.id === b.dataset.sendMaint));
    }));
    $$("[data-return-service]", root).forEach(b => b.addEventListener("click", () => {
      openReturnToServiceForm(maintenance.find(m => m.id === b.dataset.returnService));
    }));
  }

  function maintCardHTML(m) {
    const pct = Math.max(0, Math.min(100, (m.kmSinceService / m.interval) * 100));
    const inMaintenance = m.status === "maintenance";
    return `
      <div class="card maint-card">
        <div class="maint-card-head">
          <div>
            <div class="plate">${esc(m.plate)}</div>
            <div class="model">${esc(m.model)}</div>
          </div>
          <span class="pill ${inMaintenance ? "maintenance" : "active"}">${inMaintenance ? "in maintenance" : "active"}</span>
        </div>

        <div>
          <div class="maint-progress-track">
            <div class="maint-progress-fill ${m.level}" style="width:${pct}%"></div>
          </div>
          <div class="maint-progress-label">
            <span>${m.kmSinceService.toLocaleString()} km since service</span>
            <span>${maintStatusText(m)}</span>
          </div>
        </div>

        <div class="maint-stats-row">
          <div><div class="lbl">Odometer</div><div class="val">${m.odometer.toLocaleString()} km</div></div>
          <div><div class="lbl">Last service</div><div class="val">${m.lastService.toLocaleString()} km</div></div>
          <div>
            <div class="lbl">Interval</div>
            <div class="val">${m.interval.toLocaleString()} km <button class="icon-btn" style="width:22px;height:22px;font-size:11px" title="Edit interval" data-edit-interval="${m.id}">✎</button></div>
          </div>
        </div>

        <div class="maint-card-actions">
          <button class="btn sm" data-log-service="${m.id}">Log service</button>
          ${inMaintenance
            ? `<button class="btn sm brand" data-return-service="${m.id}">Return to service</button>`
            : `<button class="btn sm danger" data-send-maint="${m.id}">Send to maintenance</button>`}
        </div>
      </div>
    `;
  }

  function maintStatusText(m) {
    if (m.level === "overdue") return `overdue by ${Math.abs(m.kmUntilDue).toLocaleString()} km`;
    if (m.level === "due-soon") return `due in ${m.kmUntilDue.toLocaleString()} km`;
    return `${m.kmUntilDue.toLocaleString()} km left`;
  }

  function openIntervalForm(bus) {
    const body = openForm(`Service interval — ${bus.plate}`, `
      <form id="intervalForm" class="form-grid">
        <div class="field-v">
          <label for="ivInterval">Service every (km)</label>
          <input type="text" inputmode="numeric" id="ivInterval" value="${bus.interval}" placeholder="e.g. 5000 or 10000" />
        </div>
        <button class="btn brand" type="submit">Save interval</button>
      </form>
    `);
    $("#intervalForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      await OpsAPI.updateMaintenanceInterval(bus.id, $("#ivInterval", body).value);
      closeModal("formModal");
      toast("Interval updated.");
      go("fuel");
    });
  }

  function openSendToMaintenanceForm(bus) {
    const body = openForm(`Send ${bus.plate} for maintenance`, `
      <form id="sendMaintForm" class="form-grid">
        <p class="muted small">This marks the bus as unavailable for scheduling until it's returned to service.</p>
        <div class="field-v"><label for="smNote">Reason / note</label><input type="text" id="smNote" placeholder="e.g. Brake inspection, AC repair" /></div>
        <button class="btn danger" type="submit">Send for maintenance</button>
      </form>
    `);
    $("#sendMaintForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      await OpsAPI.sendToMaintenance(bus.id, $("#smNote", body).value.trim());
      closeModal("formModal");
      toast(`${bus.plate} sent for maintenance.`);
      go("fuel");
    });
  }

  function openReturnToServiceForm(bus) {
    const body = openForm(`Return ${bus.plate} to service`, `
      <form id="returnForm" class="form-grid">
        <div class="row-2">
          <div class="field-v"><label for="rsDate">Date</label><input type="date" id="rsDate" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field-v"><label for="rsOdo">Odometer (km)</label><input type="text" inputmode="numeric" id="rsOdo" value="${bus.odometer}" /></div>
        </div>
        <div class="field-v"><label for="rsNote">Work done</label><input type="text" id="rsNote" placeholder="e.g. Brake pads replaced, full service" /></div>
        <button class="btn brand" type="submit">Return to service</button>
      </form>
    `);
    $("#returnForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      await OpsAPI.returnToService(bus.id, {
        date: $("#rsDate", body).value,
        odometer: $("#rsOdo", body).value,
        note: $("#rsNote", body).value.trim(),
      });
      closeModal("formModal");
      toast(`${bus.plate} returned to service.`);
      go("fuel");
    });
  }

  // ---------- service history (full CRUD on log entries) ----------
  function drawMaintLog(root, maintLog, buses) {
    const busF = $("#maintBusFilter", root).value;
    const rows = maintLog.filter(m => !busF || m.busId === busF);
    $("#maintLogTableWrap", root).innerHTML = rows.length ? `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Bus</th><th>Odometer</th><th>Note</th><th></th></tr></thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td class="cell-mono">${esc(m.date)}</td>
                <td class="cell-strong">${m.bus ? esc(m.bus.plate) : "—"}</td>
                <td class="cell-mono">${m.odometer.toLocaleString()} km</td>
                <td>${esc(m.note)}${m.type === "sent" ? ' <span class="badge bad">sent</span>' : m.type === "returned" ? ' <span class="badge ok">returned</span>' : ""}</td>
                <td class="td-actions">
                  <button class="icon-btn" title="Edit" data-edit-service="${m.id}">✎</button>
                  <button class="icon-btn danger" title="Delete" data-del-service="${m.id}">🗑</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : emptyHTML("No service history logged yet.");

    $$("[data-edit-service]", root).forEach(b => b.addEventListener("click", () => {
      const entry = maintLog.find(m => m.id === b.dataset.editService);
      openServiceForm(buses, entry.busId, entry);
    }));
    $$("[data-del-service]", root).forEach(b => b.addEventListener("click", () => {
      confirmAction("Delete this service record? This will recalculate that bus's maintenance status.", async () => {
        await OpsAPI.deleteMaintenanceEntry(b.dataset.delService);
        toast("Service record deleted.");
        go("fuel");
      });
    }));
  }

  /**
   * One form for both logging a new service and editing an existing one.
   * buses: either the full bus list, or the maintenance-status list (both
   * have .id/.plate/.model/.odometer, so either works as the dropdown source).
   */
  function openServiceForm(buses, preselectBusId, existingEntry) {
    const isEdit = !!existingEntry;
    const bus = preselectBusId ? buses.find(b => b.id === preselectBusId) : null;
    const body = openForm(isEdit ? "Edit service record" : "Log a service", `
      <form id="serviceForm" class="form-grid">
        <div class="field-v">
          <label for="svBus">Bus</label>
          <select id="svBus" ${isEdit ? "disabled" : ""} required>
            ${buses.map(b => `<option value="${b.id}" ${(preselectBusId || existingEntry?.busId) === b.id ? "selected" : ""}>${esc(b.plate)} · ${esc(b.model)}</option>`).join("")}
          </select>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="svDate">Date</label><input type="date" id="svDate" value="${existingEntry?.date || new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field-v"><label for="svOdo">Odometer (km)</label><input type="text" inputmode="numeric" id="svOdo" value="${existingEntry?.odometer ?? bus?.odometer ?? ""}" placeholder="Reading at time of service" /></div>
        </div>
        <div class="field-v"><label for="svNote">Note</label><input type="text" id="svNote" value="${esc(existingEntry?.note || "")}" placeholder="e.g. Full service — oil, filters, brakes" /></div>
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Log service"}</button>
      </form>
    `);
    $("#serviceForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        busId: $("#svBus", body).value,
        date: $("#svDate", body).value,
        odometer: $("#svOdo", body).value,
        note: $("#svNote", body).value.trim(),
      };
      if (!data.busId) { toast("Select a bus."); return; }
      if (isEdit) await OpsAPI.updateMaintenanceEntry(existingEntry.id, data);
      else await OpsAPI.addMaintenanceEntry(data);
      closeModal("formModal");
      toast(isEdit ? "Service record updated." : "Service logged.");
      go("fuel");
    });
  }

  function openFuelForm(buses, existingEntry) {
    const isEdit = !!existingEntry;
    const body = openForm(isEdit ? "Edit fuel entry" : "Log fuel entry", `
      <form id="fuelForm" class="form-grid">
        <div class="row-2">
          <div class="field-v"><label for="ffBus">Bus</label>
            <select id="ffBus" required>
              <option value="">Select bus…</option>
              ${buses.map(b => `<option value="${b.id}" ${existingEntry?.busId === b.id ? "selected" : ""}>${esc(b.plate)} · ${esc(b.model)}</option>`).join("")}
            </select>
          </div>
          <div class="field-v"><label for="ffDate">Date</label><input type="date" id="ffDate" value="${existingEntry?.date || new Date().toISOString().slice(0, 10)}" /></div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="ffLiters">Liters</label><input type="text" inputmode="numeric" id="ffLiters" value="${existingEntry?.liters ?? ""}" placeholder="e.g. 120" /></div>
          <div class="field-v"><label for="ffCost">Cost (LKR)</label><input type="text" inputmode="numeric" id="ffCost" value="${existingEntry?.cost ?? ""}" placeholder="e.g. 43200" /></div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="ffOdo">Odometer (km)</label><input type="text" inputmode="numeric" id="ffOdo" value="${existingEntry?.odometer ?? ""}" /></div>
          <div class="field-v"><label for="ffStation">Fuel station</label><input type="text" id="ffStation" value="${esc(existingEntry?.station || "")}" placeholder="e.g. Ceypetco - Kegalle" /></div>
        </div>
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Save entry"}</button>
      </form>
    `);
    $("#fuelForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const busId = $("#ffBus", body).value;
      if (!busId) { toast("Select a bus first."); return; }
      const data = {
        busId,
        date: $("#ffDate", body).value,
        liters: Number($("#ffLiters", body).value) || 0,
        cost: Number($("#ffCost", body).value) || 0,
        odometer: Number($("#ffOdo", body).value) || 0,
        station: $("#ffStation", body).value.trim(),
      };
      if (isEdit) await OpsAPI.updateFuelEntry(existingEntry.id, data);
      else await OpsAPI.addFuelEntry(data);
      closeModal("formModal");
      toast(isEdit ? "Fuel entry updated." : "Fuel entry logged.");
      go("fuel");
    });
  }
  ROUTES_MAP.fuel = { title: 'Fuel & Maintenance', sub: 'Log refills, track fuel spend, and stay ahead of service intervals.', render: renderFuel };
})();
