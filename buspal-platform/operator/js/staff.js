/* ============================================================
   BusPal — Operator Dashboard — Drivers & Conductors
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderStaff(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◐</div>Loading staff…</div>`;
    const staff = await OpsAPI.getStaff();
    const driverCount = staff.filter(s => s.role === "driver").length;
    const conductorCount = staff.filter(s => s.role === "conductor").length;
    const onLeave = staff.filter(s => s.status === "on-leave").length;
    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card"><div class="k">${staff.length}</div><div class="l">Total staff</div></div>
        <div class="stat-card"><div class="k" style="color:var(--brand)">${driverCount}</div><div class="l">Drivers</div></div>
        <div class="stat-card"><div class="k" style="color:var(--amber)">${conductorCount}</div><div class="l">Conductors</div></div>
        <div class="stat-card"><div class="k">${onLeave}</div><div class="l">On leave</div></div>
      </div>
      <div class="section-toolbar">
        <div class="filters">
          <input class="filter-input" id="staffSearch" placeholder="Search name or phone…" />
          <select class="filter-input" id="staffRoleFilter">
            <option value="">All roles</option>
            <option value="driver">Drivers</option>
            <option value="conductor">Conductors</option>
          </select>
        </div>
        <button class="btn brand" id="addStaffBtn">+ Add driver / conductor</button>
      </div>
      <div id="staffTableWrap"></div>
    `;
    function draw() {
      const q = $("#staffSearch", root).value.trim().toLowerCase();
      const roleF = $("#staffRoleFilter", root).value;
      const rows = staff.filter(s =>
        (!q || s.name.toLowerCase().includes(q) || s.phone.includes(q)) &&
        (!roleF || s.role === roleF));
      $("#staffTableWrap", root).innerHTML = rows.length ? `
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Staff</th><th>Role</th><th>Phone</th><th>NTC license</th><th>Driving license</th><th>Photo visible</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${rows.map(s => `
                <tr>
                  <td>
                    <div class="staff-cell">
                      ${s.photo ? `<img class="staff-avatar" src="${s.photo}" alt="${esc(s.name)}" />` : `<div class="staff-avatar-placeholder">${esc(s.name.split(" ").map(p => p[0]).join("").slice(0, 2))}</div>`}
                      <span class="cell-strong">${esc(s.name)}</span>
                    </div>
                  </td>
                  <td style="text-transform:capitalize">${esc(s.role)}</td>
                  <td class="cell-mono">${esc(s.phone)}</td>
                  <td class="cell-mono">${esc(s.ntcLicense) || "—"}</td>
                  <td class="cell-mono">${s.role === "driver" ? (esc(s.drivingLicense) || "—") + (s.licenseExpiry ? `<div class="cell-sub">exp ${esc(s.licenseExpiry)}</div>` : "") : "—"}</td>
                  <td>
                    <label class="toggle">
                      <input type="checkbox" ${s.photoVisible ? "checked" : ""} data-toggle-photo="${s.id}" />
                      <span class="toggle-track"></span>
                    </label>
                  </td>
                  <td><span class="pill ${s.status}">${s.status}</span></td>
                  <td class="td-actions">
                    <button class="icon-btn" title="Edit" data-edit-staff="${s.id}">✎</button>
                    <button class="icon-btn danger" title="Delete" data-del-staff="${s.id}">🗑</button>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : emptyHTML("No staff match your search.");
      bindStaffActions();
    }
    function bindStaffActions() {
      $$("[data-toggle-photo]", root).forEach(el => el.addEventListener("change", async () => {
        await OpsAPI.togglePhotoVisible(el.dataset.togglePhoto);
        toast("Photo visibility updated.");
        go("staff");
      }));
      $$("[data-edit-staff]", root).forEach(b => b.addEventListener("click", () => openStaffForm(staff.find(s => s.id === b.dataset.editStaff))));
      $$("[data-del-staff]", root).forEach(b => b.addEventListener("click", () => {
        const s = staff.find(x => x.id === b.dataset.delStaff);
        confirmAction(`Remove <strong>${esc(s.name)}</strong> from staff records?`, async () => {
          await OpsAPI.deleteStaff(s.id);
          toast("Staff record removed.");
          go("staff");
        });
      }));
    }
    $("#staffSearch", root).addEventListener("input", draw);
    $("#staffRoleFilter", root).addEventListener("change", draw);
    $("#addStaffBtn", root).addEventListener("click", () => openStaffForm());
    draw();
  }

  function openStaffForm(staffMember) {
    const isEdit = !!staffMember;
    let photoData = staffMember?.photo || null;
    const body = openForm(isEdit ? "Edit staff record" : "Add driver / conductor", `
      <form id="staffForm" class="form-grid">
        <div class="photo-upload">
          ${photoData ? `<img class="photo-upload-preview" id="sfPhotoPreview" src="${photoData}" />` : `<div class="photo-upload-preview-placeholder" id="sfPhotoPreview">◐</div>`}
          <div class="photo-upload-actions">
            <label class="btn sm" style="cursor:pointer">Upload photo<input type="file" accept="image/*" id="sfPhotoInput" style="display:none" /></label>
            <span class="muted small">JPG or PNG, passport-style works best.</span>
          </div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="sfName">Full name</label><input type="text" id="sfName" value="${esc(staffMember?.name || "")}" required /></div>
          <div class="field-v"><label for="sfRole">Role</label>
            <select id="sfRole">
              <option value="driver" ${staffMember?.role === "driver" ? "selected" : ""}>Driver</option>
              <option value="conductor" ${staffMember?.role === "conductor" ? "selected" : ""}>Conductor</option>
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="sfPhone">Phone number</label><input type="tel" id="sfPhone" value="${esc(staffMember?.phone || "")}" placeholder="07X XXX XXXX" /></div>
          <div class="field-v"><label for="sfNtc">NTC license number</label><input type="text" id="sfNtc" value="${esc(staffMember?.ntcLicense || "")}" placeholder="NTC-DRV-xxxxx" /></div>
        </div>
        <div class="row-2" id="sfDriverFields" style="${staffMember?.role === "conductor" ? "display:none" : ""}">
          <div class="field-v"><label for="sfLicense">Driving license number</label><input type="text" id="sfLicense" value="${esc(staffMember?.drivingLicense || "")}" /></div>
          <div class="field-v"><label for="sfExpiry">License expiry</label><input type="date" id="sfExpiry" value="${esc(staffMember?.licenseExpiry || "")}" /></div>
        </div>
        <div class="photo-visibility-row">
          <div class="pv-text"><strong>Show photo to passengers</strong>Passenger app displays this staff photo on trip &amp; tracking screens.</div>
          <label class="toggle">
            <input type="checkbox" id="sfPhotoVisible" ${staffMember?.photoVisible !== false ? "checked" : ""} />
            <span class="toggle-track"></span>
          </label>
        </div>
        <div class="field-v"><label for="sfStatus">Status</label>
          <select id="sfStatus">
            <option value="active" ${staffMember?.status === "active" ? "selected" : ""}>Active</option>
            <option value="on-leave" ${staffMember?.status === "on-leave" ? "selected" : ""}>On leave</option>
          </select>
        </div>
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Add staff"}</button>
      </form>
    `);

    $("#sfRole", body).addEventListener("change", () => {
      $("#sfDriverFields", body).style.display = $("#sfRole", body).value === "conductor" ? "none" : "grid";
    });
    $("#sfPhotoInput", body).addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        photoData = reader.result;
        const preview = $("#sfPhotoPreview", body);
        const img = document.createElement("img");
        img.className = "photo-upload-preview";
        img.id = "sfPhotoPreview";
        img.src = photoData;
        preview.replaceWith(img);
      };
      reader.readAsDataURL(file);
    });

    Validate.attachPhoneMask($("#sfPhone", body));
    $("#sfPhone", body).addEventListener("blur", () => {
      const v = $("#sfPhone", body).value.trim();
      Validate.setFieldError($("#sfPhone", body), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number, e.g. 077 123 4567" : "");
    });

    $("#staffForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const role = $("#sfRole", body).value;
      const phone = $("#sfPhone", body).value.trim();
      if (!Validate.isValidPhone(phone)) {
        Validate.setFieldError($("#sfPhone", body), "Enter a valid mobile number, e.g. 077 123 4567");
        toast("Please fix the highlighted field.");
        return;
      }
      const data = {
        name: $("#sfName", body).value.trim(),
        role, phone,
        ntcLicense: $("#sfNtc", body).value.trim(),
        drivingLicense: role === "driver" ? $("#sfLicense", body).value.trim() : "",
        licenseExpiry: role === "driver" ? $("#sfExpiry", body).value : "",
        photo: photoData,
        photoVisible: $("#sfPhotoVisible", body).checked,
        status: $("#sfStatus", body).value,
      };
      if (!data.name) { toast("Name is required."); return; }
      if (isEdit) await OpsAPI.updateStaff(staffMember.id, data); else await OpsAPI.createStaff(data);
      closeModal("formModal");
      toast(isEdit ? "Staff record updated." : "Staff added.");
      go("staff");
    });
  }
  ROUTES_MAP.staff = { title: 'Drivers & Conductors', sub: 'Manage staff records and license details.', render: renderStaff };
})();
