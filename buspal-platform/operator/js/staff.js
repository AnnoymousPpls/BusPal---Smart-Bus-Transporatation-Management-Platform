/* ============================================================
   BusPal — Operator Dashboard — Drivers & Conductors
   ============================================================ */

(() => {

  async function renderStaff(root) {
    root.innerHTML =
      `<div class="empty"><div class="ico">◐</div>Loading staff…</div>`;

    let staff = await OpsAPI.getStaff();

    staff = Array.isArray(staff) ? staff : [];

    const driverCount =
      staff.filter(s => String(s.role).toLowerCase() === "driver").length;

    const conductorCount =
      staff.filter(s => String(s.role).toLowerCase() === "conductor").length;

    const onLeave =
      staff.filter(s => s.status === "on-leave").length;

    root.innerHTML = `
      <div class="grid-4">
        <div class="stat-card">
          <div class="k">${staff.length}</div>
          <div class="l">Total staff</div>
        </div>

        <div class="stat-card">
          <div class="k" style="color:var(--brand)">
            ${driverCount}
          </div>
          <div class="l">Drivers</div>
        </div>

        <div class="stat-card">
          <div class="k" style="color:var(--amber)">
            ${conductorCount}
          </div>
          <div class="l">Conductors</div>
        </div>

        <div class="stat-card">
          <div class="k">${onLeave}</div>
          <div class="l">On leave</div>
        </div>
      </div>

      <div class="section-toolbar">
        <div class="filters">
          <input
            class="filter-input"
            id="staffSearch"
            placeholder="Search name or phone…"
          />

          <select class="filter-input" id="staffRoleFilter">
            <option value="">All roles</option>
            <option value="driver">Drivers</option>
            <option value="conductor">Conductors</option>
          </select>
        </div>

        <button class="btn brand" id="addStaffBtn">
          + Add driver / conductor
        </button>
      </div>

      <div id="staffTableWrap"></div>
    `;

    function draw() {
      const q =
        $("#staffSearch", root)
          .value
          .trim()
          .toLowerCase();

      const roleFilter =
        $("#staffRoleFilter", root).value;

      const rows = staff.filter(s => {
        const name =
          String(s.name || "").toLowerCase();

        const phone =
          String(s.phone || "").toLowerCase();

        const role =
          String(s.role || "").toLowerCase();

        return (
          (!q ||
            name.includes(q) ||
            phone.includes(q)) &&
          (!roleFilter || role === roleFilter)
        );
      });

      $("#staffTableWrap", root).innerHTML =
        rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table">

                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>NTC license</th>
                    <th>Driving license</th>
                    <th>Photo visible</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>

                  ${rows.map((s) => {

                    const role =
                      String(s.role || "").toLowerCase();

                    const ntc =
                      s.ntcLicense ??
                      s.ntc_license ??
                      "";

                    const driving =
                      s.drivingLicense ??
                      s.driving_license ??
                      "";

                    const expiry =
                      s.licenseExpiry ??
                      s.license_expiry ??
                      "";

                    return `
                      <tr>

                        <td>
                          <div class="staff-cell">

                            ${
                              s.photo
                                ? `
                                  <img
                                    class="staff-avatar"
                                    src="${esc(s.photo)}"
                                    alt="${esc(s.name)}"
                                  />
                                `
                                : `
                                  <div class="staff-avatar-placeholder">
                                    ${esc(
                                      String(s.name || "")
                                        .split(" ")
                                        .map(p => p[0])
                                        .join("")
                                        .slice(0, 2)
                                    )}
                                  </div>
                                `
                            }

                            <span class="cell-strong">
                              ${esc(s.name)}
                            </span>

                          </div>
                        </td>

                        <td style="text-transform:capitalize">
                          ${esc(role)}
                        </td>

                        <td class="cell-mono">
                          ${esc(s.phone || "—")}
                        </td>

                        <td class="cell-mono">
                          ${esc(ntc) || "—"}
                        </td>

                        <td class="cell-mono">

                          ${
                            role === "driver"
                              ? `
                                ${esc(driving) || "—"}

                                ${
                                  expiry
                                    ? `
                                      <div class="cell-sub">
                                        exp ${esc(expiry)}
                                      </div>
                                    `
                                    : ""
                                }
                              `
                              : "—"
                          }

                        </td>

                        <td>

                          <label class="toggle">

                            <input
                              type="checkbox"
                              ${s.photoVisible ? "checked" : ""}
                              data-staff-photo="${Number(s.id)}"
                            />

                            <span class="toggle-track"></span>

                          </label>

                        </td>

                        <td>
                          <span class="pill ${esc(s.status || "active")}">
                            ${esc(s.status || "active")}
                          </span>
                        </td>

                        <td class="td-actions">

                          <button
                            type="button"
                            class="icon-btn"
                            title="Edit"
                            data-staff-edit-id="${Number(s.id)}"
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            class="icon-btn danger"
                            title="Delete"
                            data-staff-delete-id="${Number(s.id)}"
                          >
                            🗑
                          </button>

                        </td>

                      </tr>
                    `;

                  }).join("")}

                </tbody>
              </table>
            </div>
          `
          : emptyHTML("No staff match your search.");

      bindActions();
    }

    function bindActions() {

      /* ---------------- PHOTO VISIBILITY ---------------- */

      $$("[data-staff-photo]", root).forEach(button => {

        button.addEventListener("change", async () => {

          try {

            await OpsAPI.togglePhotoVisible(
              Number(button.dataset.staffPhoto)
            );

            toast("Photo visibility updated.");
            go("staff");

          } catch (error) {

            console.error(error);

            toast(
              error.message ||
              "Unable to update photo visibility."
            );

          }

        });

      });


      /* ---------------- EDIT ---------------- */

      $$("[data-staff-edit-id]", root).forEach(button => {

        button.addEventListener("click", async () => {

          const id =
            Number(button.dataset.staffEditId);

          try {

            /*
             * Get a fresh copy directly from the backend.
             * This removes any dependency on the locally
             * captured array or stale object.
             */
            const latest =
              await OpsAPI.getStaff();

            const member =
              latest.find(
                person =>
                  Number(person.id) === id
              );

            if (!member) {

              toast("Staff member not found.");
              return;

            }

            openStaffForm(member);

          } catch (error) {

            console.error(
              "Edit staff error:",
              error
            );

            toast(
              error.message ||
              "Unable to load staff record."
            );

          }

        });

      });


      /* ---------------- DELETE ---------------- */

      $$("[data-staff-delete-id]", root).forEach(button => {

        button.addEventListener("click", () => {

          const id =
            Number(button.dataset.staffDeleteId);

          const member =
            staff.find(
              person =>
                Number(person.id) === id
            );

          if (!member) {

            toast("Staff member not found.");
            return;

          }

          confirmAction(
            `Remove <strong>${esc(member.name)}</strong> from staff records?`,
            async () => {

              try {

                await OpsAPI.deleteStaff(
                  member.id
                );

                toast("Staff record removed.");
                go("staff");

              } catch (error) {

                console.error(error);

                toast(
                  error.message ||
                  "Unable to remove staff record."
                );

              }

            }
          );

        });

      });

    }

    $("#staffSearch", root)
      .addEventListener("input", draw);

    $("#staffRoleFilter", root)
      .addEventListener("change", draw);

    $("#addStaffBtn", root)
      .addEventListener("click", () =>
        openStaffForm()
      );

    draw();
  }


  /* ==========================================================
     STAFF FORM
     ========================================================== */

  function openStaffForm(staffMember = null) {

    const isEdit =
      staffMember !== null &&
      staffMember !== undefined;

    let selectedPhotoFile = null;

    const role =
      String(
        staffMember?.role || "driver"
      ).toLowerCase();

    const ntc =
      staffMember?.ntcLicense ??
      staffMember?.ntc_license ??
      "";

    const driving =
      staffMember?.drivingLicense ??
      staffMember?.driving_license ??
      "";

    const expiry =
      staffMember?.licenseExpiry ??
      staffMember?.license_expiry ??
      "";

    const photoVisible =
      staffMember?.photoVisible !== false;

    const status =
      staffMember?.status || "active";

    const body = openForm(
      isEdit
        ? "Edit staff record"
        : "Add driver / conductor",

      `
        <form id="staffForm" class="form-grid">

          <div class="photo-upload">

            <div
              class="photo-upload-preview-placeholder"
              id="sfPhotoPreview"
            >
              ◐
            </div>

            <div class="photo-upload-actions">

              <label
                class="btn sm"
                style="cursor:pointer"
              >
                Upload photo

                <input
                  type="file"
                  accept="image/*"
                  id="sfPhotoInput"
                  style="display:none"
                />
              </label>

              <span class="muted small">
                JPG or PNG, passport-style works best.
              </span>

            </div>

          </div>


          <div class="row-2">

            <div class="field-v">

              <label for="sfName">
                Full name
              </label>

              <input
                type="text"
                id="sfName"
                value="${esc(staffMember?.name || "")}"
                required
              />

            </div>


            <div class="field-v">

              <label for="sfRole">
                Role
              </label>

              <select id="sfRole">

                <option
                  value="driver"
                  ${role === "driver" ? "selected" : ""}
                >
                  Driver
                </option>

                <option
                  value="conductor"
                  ${role === "conductor" ? "selected" : ""}
                >
                  Conductor
                </option>

              </select>

            </div>

          </div>


          <div class="row-2">

            <div class="field-v">

              <label for="sfPhone">
                Phone number
              </label>

              <input
                type="tel"
                id="sfPhone"
                value="${esc(staffMember?.phone || "")}"
                placeholder="07X XXX XXXX"
              />

            </div>


            <div class="field-v">

              <label for="sfNtc">
                NTC license number
              </label>

              <input
                type="text"
                id="sfNtc"
                value="${esc(ntc)}"
                placeholder="NTC-DRV-xxxxx"
              />

            </div>

          </div>


          <div
            class="row-2"
            id="sfDriverFields"
            style="${role === "conductor" ? "display:none" : ""}"
          >

            <div class="field-v">

              <label for="sfLicense">
                Driving license number
              </label>

              <input
                type="text"
                id="sfLicense"
                value="${esc(driving)}"
              />

            </div>


            <div class="field-v">

              <label for="sfExpiry">
                License expiry
              </label>

              <input
                type="date"
                id="sfExpiry"
                value="${esc(expiry)}"
              />

            </div>

          </div>


          <div class="photo-visibility-row">

            <div class="pv-text">

              <strong>
                Show photo to passengers
              </strong>

              Passenger app displays this staff photo
              on trip &amp; tracking screens.

            </div>

            <label class="toggle">

              <input
                type="checkbox"
                id="sfPhotoVisible"
                ${photoVisible ? "checked" : ""}
              />

              <span class="toggle-track"></span>

            </label>

          </div>


          <div class="field-v">

            <label for="sfStatus">
              Status
            </label>

            <select id="sfStatus">

              <option
                value="active"
                ${status === "active" ? "selected" : ""}
              >
                Active
              </option>

              <option
                value="on-leave"
                ${status === "on-leave" ? "selected" : ""}
              >
                On leave
              </option>

            </select>

          </div>


          <button
            class="btn brand"
            type="submit"
          >
            ${isEdit ? "Save changes" : "Add staff"}
          </button>

        </form>
      `
    );


    /* ---------- existing photo ---------- */

    if (staffMember?.photo) {

  const preview =
    $("#sfPhotoPreview", body);

  preview.outerHTML = `
    <div id="staffPhotoBox" style="display:flex;flex-direction:column;gap:8px">
      <img
        class="photo-upload-preview"
        id="sfPhotoPreview"
        src="${esc(staffMember.photo)}"
        alt="${esc(staffMember.name || "Staff")}"
      />

      <button
        type="button"
        class="btn sm danger"
        id="removeStaffPhotoBtn"
      >
        Remove photo
      </button>
    </div>
  `;

  $("#removeStaffPhotoBtn", body)
    .addEventListener("click", async () => {

      try {

        await OpsAPI.deleteStaffPhoto(
          Number(staffMember.id)
        );

        toast("Staff photo removed.");

        closeModal("formModal");

        go("staff");

      } catch (error) {

        console.error(
          "Remove staff photo error:",
          error
        );

        toast(
          error.message ||
          "Unable to remove staff photo."
        );
      }
    });
}

    /* ---------- role switch ---------- */

    $("#sfRole", body)
      .addEventListener("change", () => {

        $("#sfDriverFields", body)
          .style.display =
            $("#sfRole", body).value === "conductor"
              ? "none"
              : "grid";

      });


    /* ---------- photo upload ---------- */

    $("#sfPhotoInput", body)
      .addEventListener("change", event => {

        const file =
          event.target.files[0];

        if (!file) return;

        selectedPhotoFile = file;

        const reader =
          new FileReader();

        reader.onload = () => {

          const oldPreview =
            $("#sfPhotoPreview", body);

          const img =
            document.createElement("img");

          img.className =
            "photo-upload-preview";

          img.id =
            "sfPhotoPreview";

          img.src =
            reader.result;

          oldPreview.replaceWith(img);

        };

        reader.readAsDataURL(file);

      });


    /* ---------- phone validation ---------- */

    Validate.attachPhoneMask(
      $("#sfPhone", body)
    );

    $("#sfPhone", body)
      .addEventListener("blur", () => {

        const value =
          $("#sfPhone", body)
            .value
            .trim();

        Validate.setFieldError(
          $("#sfPhone", body),

          value &&
          !Validate.isValidPhone(value)

            ? "Enter a valid mobile number, e.g. 077 123 4567"

            : ""
        );

      });


    /* ---------- submit ---------- */

    $("#staffForm", body)
      .addEventListener("submit", async event => {

        event.preventDefault();

        const selectedRole =
          $("#sfRole", body).value;

        const phone =
          $("#sfPhone", body)
            .value
            .trim();

        if (!Validate.isValidPhone(phone)) {

          Validate.setFieldError(
            $("#sfPhone", body),
            "Enter a valid mobile number, e.g. 077 123 4567"
          );

          toast("Please fix the highlighted field.");
          return;

        }

        const data = {

          name:
            $("#sfName", body)
              .value
              .trim(),

          role:
            selectedRole,

          phone,

          ntcLicense:
            $("#sfNtc", body)
              .value
              .trim(),

          drivingLicense:
            selectedRole === "driver"
              ? $("#sfLicense", body)
                  .value
                  .trim()
              : "",

          licenseExpiry:
            selectedRole === "driver"
              ? $("#sfExpiry", body).value
              : "",

          photoVisible:
            $("#sfPhotoVisible", body)
              .checked,

          status:
            $("#sfStatus", body).value

        };


        if (!data.name) {

          toast("Name is required.");
          return;

        }


        try {

           let savedId;

if (isEdit) {

  savedId =
    Number(staffMember.id);

  await OpsAPI.updateStaff(
    savedId,
    data
  );

} else {

  const created =
    await OpsAPI.createStaff(data);

  savedId =
    Number(created.id);

}

if (
  selectedPhotoFile &&
  savedId
) {

  await OpsAPI.uploadStaffPhoto(
    savedId,
    selectedPhotoFile
  );
}
          closeModal("formModal");
          go("staff");

        } catch (error) {

          console.error(
            "Staff save error:",
            error
          );

          toast(
            error.message ||
            "Unable to save staff record."
          );

        }

      });

  }


  ROUTES_MAP.staff = {
    title: "Drivers & Conductors",
    sub: "Manage staff records and license details.",
    render: renderStaff
  };

})();