/* ============================================================
   BusPal — Operator Dashboard — Buses
   Photos are stored in the shared store (shared/js/store.js), keyed
   by plate, so the passenger side's Book a Trip page can read the
   same photos — not duplicated per-app data.
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderBuses(root) {
    root.innerHTML = `<div class="empty"><div class="ico">🚌</div>Loading buses…</div>`;
    const buses = await OpsAPI.getBuses();
    const active = buses.filter(b => b.status === "active").length;
    const maintenance = buses.length - active;
    const totalSeats = buses.reduce((s, b) => s + (b.capacity || 0), 0);
    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card"><div class="k">${buses.length}</div><div class="l">Total buses</div></div>
        <div class="stat-card"><div class="k" style="color:var(--brand-2)">${active}</div><div class="l">Active</div></div>
        <div class="stat-card"><div class="k" style="color:var(--amber)">${maintenance}</div><div class="l">In maintenance</div></div>
        <div class="stat-card"><div class="k">${totalSeats}</div><div class="l">Total fleet capacity</div></div>
      </div>
      <div class="section-toolbar">
        <div class="filters">
          <input class="filter-input" id="busSearch" placeholder="Search plate or model…" />
          <select class="filter-input" id="busStatusFilter">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <button class="btn brand" id="addBusBtn">+ Add bus</button>
      </div>
      <div id="busTableWrap"></div>
    `;
    function draw() {
      const q = $("#busSearch", root).value.trim().toLowerCase();
      const st = $("#busStatusFilter", root).value;
      let rows = buses.filter(b =>
        (!q || b.plate.toLowerCase().includes(q) || b.model.toLowerCase().includes(q)) &&
        (!st || b.status === st));
      $("#busTableWrap", root).innerHTML = rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Bus</th><th>Type</th><th>Capacity</th><th>Odometer</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${rows.map(b => {
                const photos = BusPalStore.getBusPhotos(b.plate);
                const thumb = photos[0]
                  ? `<img class="row-avatar row-avatar-bus-photo" src="${photos[0]}" alt="" data-view-photos="${b.id}" title="View photos" />`
                  : `<div class="row-avatar row-avatar-bus" data-view-photos="${b.id}" title="No photos yet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="3" y="6" width="18" height="10" rx="2"/><path d="M3 11h18"/><path d="M7 6v5M17 6v5"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg></div>`;
                return `
                <tr>
                  <td>
                    <div class="staff-cell">
                      ${thumb}
                      <div>
                        <div class="cell-strong cell-mono">${esc(b.plate)}</div>
                        <div class="cell-sub">${esc(b.model)}${photos.length ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}` : ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>${esc(b.type)}</td>
                  <td>${b.capacity} seats</td>
                  <td class="cell-mono">${b.odometer.toLocaleString()} km</td>
                  <td><span class="pill ${b.status}">${b.status}</span></td>
                  <td class="td-actions">
                    <button class="icon-btn" title="Toggle status" data-toggle-bus="${b.id}">⇄</button>
                    <button class="icon-btn" title="Edit" data-edit-bus="${b.id}">✎</button>
                    <button class="icon-btn danger" title="Delete" data-del-bus="${b.id}">🗑</button>
                  </td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>` : emptyHTML("No buses match your search.");
      bindBusActions();
    }
    function bindBusActions() {
      $$("[data-toggle-bus]", root).forEach(b => b.addEventListener("click", async () => {
        await OpsAPI.toggleBusStatus(b.dataset.toggleBus);
        toast("Bus status updated.");
        go("buses");
      }));
      $$("[data-edit-bus]", root).forEach(b => b.addEventListener("click", () => openBusForm(buses.find(x => x.id === b.dataset.editBus))));
      $$("[data-del-bus]", root).forEach(b => b.addEventListener("click", () => {
        const bus = buses.find(x => x.id === b.dataset.delBus);
        confirmAction(`Delete bus <strong>${esc(bus.plate)}</strong>? This can't be undone.`, async () => {
          await OpsAPI.deleteBus(bus.id);
          toast("Bus deleted.");
          go("buses");
        });
      }));
      $$("[data-view-photos]", root).forEach(el => el.addEventListener("click", () => {
        const bus = buses.find(x => x.id === el.dataset.viewPhotos);
        openPhotoGallery(bus);
      }));
    }
    $("#busSearch", root).addEventListener("input", draw);
    $("#busStatusFilter", root).addEventListener("change", draw);
    $("#addBusBtn", root).addEventListener("click", () => openBusForm());
    draw();
  }

  function openPhotoGallery(bus) {
    const photos = BusPalStore.getBusPhotos(bus.plate);
    openForm(`${bus.plate} — Photos`, photos.length ? `
      <div class="bus-gallery-grid">
        ${photos.map(p => `<img src="${p}" alt="${esc(bus.plate)}" />`).join("")}
      </div>
    ` : `<div class="empty"><div class="ico">📷</div>No photos uploaded yet — add some from Edit bus.</div>`);
  }

  function photoSlotHTML(index, dataUrl) {
    return `
      <div class="bus-photo-slot" data-slot="${index}">
        ${dataUrl
          ? `<img src="${dataUrl}" alt="" /><button type="button" class="bus-photo-remove" data-remove-photo="${index}" title="Remove">✕</button>`
          : `<label class="bus-photo-add">
               <span>+ Add</span>
               <input type="file" accept="image/*" data-upload-photo="${index}" hidden />
             </label>`}
      </div>
    `;
  }

  function openBusForm(bus) {
    const isEdit = !!bus;
    let photos = isEdit ? [...BusPalStore.getBusPhotos(bus.plate)] : [];
    while (photos.length < 4) photos.push(null);

    const body = openForm(isEdit ? "Edit bus" : "Add bus", `
      <form id="busForm" class="form-grid">
        <div class="row-2">
          <div class="field-v"><label for="bfPlate">Plate number</label><input type="text" id="bfPlate" value="${esc(bus?.plate || "")}" placeholder="e.g. NC-9302" required /></div>
          <div class="field-v"><label for="bfModel">Model</label><input type="text" id="bfModel" value="${esc(bus?.model || "")}" placeholder="e.g. Magnate" required /></div>
        </div>
        <div class="row-3">
          <div class="field-v"><label for="bfType">Type</label>
            <select id="bfType">
              ${["AC Luxury", "Semi-Luxury", "AC Sleeper", "Standard"].map(t => `<option ${bus?.type === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
          <div class="field-v"><label for="bfCapacity">Capacity</label><input type="text" inputmode="numeric" id="bfCapacity" value="${bus?.capacity ?? 32}" /></div>
          <div class="field-v"><label for="bfFuel">Fuel type</label>
            <select id="bfFuel">
              ${["Diesel", "Petrol", "Electric", "Hybrid"].map(t => `<option ${bus?.fuelType === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="bfOdo">Odometer (km)</label><input type="text" inputmode="numeric" id="bfOdo" value="${bus?.odometer ?? 0}" /></div>
          <div class="field-v"><label for="bfStatus">Status</label>
            <select id="bfStatus">
              <option value="active" ${bus?.status === "active" ? "selected" : ""}>Active</option>
              <option value="maintenance" ${bus?.status === "maintenance" ? "selected" : ""}>Maintenance</option>
            </select>
          </div>
        </div>
        <div class="field-v">
          <label for="bfMaintInterval">Service every (km)</label>
          <input type="text" inputmode="numeric" id="bfMaintInterval" value="${bus?.maintenanceIntervalKm ?? 10000}" placeholder="e.g. 5000 or 10000" />
          <span class="field-hint">Alerts on the Fuel &amp; Maintenance page once the bus has covered this many km since its last logged service.</span>
        </div>
        <div class="field-v">
          <label>Photos (up to 4)</label>
          <div class="bus-photo-grid" id="busPhotoGrid">
            ${photos.map((p, i) => photoSlotHTML(i, p)).join("")}
          </div>
          <span class="field-hint">Shown to passengers when they search for a trip on this bus.</span>
        </div>
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Add bus"}</button>
      </form>
    `);

    function rebindPhotoSlots() {
      $("#busPhotoGrid", body).innerHTML = photos.map((p, i) => photoSlotHTML(i, p)).join("");
      $$("[data-upload-photo]", body).forEach(input => input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const idx = Number(input.dataset.uploadPhoto);
        try {
          photos[idx] = await ImageUtils.resizeImage(file);
          rebindPhotoSlots();
        } catch {
          toast("Couldn't read that image — try a different file.");
        }
      }));
      $$("[data-remove-photo]", body).forEach(btn => btn.addEventListener("click", () => {
        photos[Number(btn.dataset.removePhoto)] = null;
        rebindPhotoSlots();
      }));
    }
    rebindPhotoSlots();

    $("#busForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = {
        plate: $("#bfPlate", body).value.trim().toUpperCase(),
        model: $("#bfModel", body).value.trim(),
        type: $("#bfType", body).value,
        capacity: Number($("#bfCapacity", body).value) || 0,
        fuelType: $("#bfFuel", body).value,
        odometer: Number($("#bfOdo", body).value) || 0,
        status: $("#bfStatus", body).value,
        maintenanceIntervalKm: Number($("#bfMaintInterval", body).value) || 10000,
      };
      if (!data.plate || !data.model) { toast("Plate and model are required."); return; }
      if (isEdit) await OpsAPI.updateBus(bus.id, data); else await OpsAPI.createBus(data);
      if (isEdit && bus.plate !== data.plate) BusPalStore.renameBusPhotos(bus.plate, data.plate);
      BusPalStore.setBusPhotos(data.plate, photos);
      closeModal("formModal");
      toast(isEdit ? "Bus updated." : "Bus added.");
      go("buses");
    });
  }
  ROUTES_MAP.buses = { title: 'Buses', sub: 'Add, update, or retire buses in your fleet.', render: renderBuses };
})();
