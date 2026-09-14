/* ============================================================
   BusPal — Operator Dashboard — Buses

   Real PHP + MySQL bus management.
   Bus photos use:
     POST   /api/buses/photos.php
     DELETE /api/buses/photos.php?id=...

   The bus CRUD itself is delegated to OpsAPI.
   ============================================================ */

(() => {
  const API_BASE = "http://localhost/buspal-backend-php/api";

  function apiUrl(path) {
    return `${API_BASE}/${String(path).replace(/^\/+/, "")}`;
  }

  function authHeaders() {
    const token = AuthStore.getToken();

    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  }

  function normalisePhoto(photo) {
    if (!photo) return null;

    if (typeof photo === "string") {
      return {
        id: null,
        path: photo,
        preview: apiPublicPath(photo),
        isNew: false,
      };
    }

    return {
      id: photo.id ?? null,
      path: photo.path ?? "",
      preview: photo.preview || apiPublicPath(photo.path || ""),
      isNew: !!photo.isNew,
      file: photo.file || null,
    };
  }

  function normalisePhotos(photos) {
    return (Array.isArray(photos) ? photos : [])
      .map(normalisePhoto)
      .filter(Boolean);
  }

  function apiPublicPath(path) {
    if (!path) return "";

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `http://localhost/buspal-backend-php/${String(path).replace(/^\/+/, "")}`;
  }

  async function uploadBusPhoto(busId, file) {
    const formData = new FormData();
    formData.append("busId", String(busId));
    formData.append("photo", file);

    let response;

    try {
      response = await fetch(apiUrl("buses/photos.php"), {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
    } catch (error) {
      console.error("Photo upload connection error:", error);
      throw new Error("Unable to connect to the photo upload service.");
    }

    let body = null;

    try {
      body = await response.json();
    } catch {
      throw new Error(`Invalid photo upload response (HTTP ${response.status}).`);
    }

    if (!response.ok || body.success === false) {
      throw new Error(
        body.message || `Photo upload failed (HTTP ${response.status}).`
      );
    }

    return body.data || body;
  }

  async function deleteBusPhoto(photoId) {
    if (!photoId) return;

    let response;

    try {
      response = await fetch(
        apiUrl(`buses/photos.php?id=${encodeURIComponent(photoId)}`),
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );
    } catch (error) {
      console.error("Photo delete connection error:", error);
      throw new Error("Unable to connect to the photo service.");
    }

    let body = null;

    try {
      body = await response.json();
    } catch {
      throw new Error(`Invalid photo delete response (HTTP ${response.status}).`);
    }

    if (!response.ok || body.success === false) {
      throw new Error(
        body.message || `Photo deletion failed (HTTP ${response.status}).`
      );
    }

    return body.data || body;
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Couldn't preview the image."));

      reader.readAsDataURL(file);
    });
  }

  async function renderBuses(root) {
    root.innerHTML = `
      <div class="empty">
        <div class="ico">🚌</div>
        Loading buses…
      </div>
    `;

    try {
      const buses = await OpsAPI.getBuses();

      const active = buses.filter(b => b.status === "active").length;
      const maintenance = buses.length - active;
      const totalSeats = buses.reduce(
        (sum, b) => sum + Number(b.capacity || 0),
        0
      );

      root.innerHTML = `
        <div class="grid-4">
          <div class="stat-card">
            <div class="k">${buses.length}</div>
            <div class="l">Total buses</div>
          </div>

          <div class="stat-card">
            <div class="k" style="color:var(--brand-2)">${active}</div>
            <div class="l">Active</div>
          </div>

          <div class="stat-card">
            <div class="k" style="color:var(--amber)">${maintenance}</div>
            <div class="l">In maintenance</div>
          </div>

          <div class="stat-card">
            <div class="k">${totalSeats}</div>
            <div class="l">Total fleet capacity</div>
          </div>
        </div>

        <div class="section-toolbar">
          <div class="filters">
            <input
              class="filter-input"
              id="busSearch"
              placeholder="Search plate or model…"
            />

            <select class="filter-input" id="busStatusFilter">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <button class="btn brand" id="addBusBtn">
            + Add bus
          </button>
        </div>

        <div id="busTableWrap"></div>
      `;

      function draw() {
        const q = $("#busSearch", root)
          .value
          .trim()
          .toLowerCase();

        const st = $("#busStatusFilter", root).value;

        const rows = buses.filter(b =>
          (
            !q ||
            String(b.plate || "").toLowerCase().includes(q) ||
            String(b.model || "").toLowerCase().includes(q)
          ) &&
          (!st || b.status === st)
        );

        $("#busTableWrap", root).innerHTML = rows.length
          ? `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Bus</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Odometer</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  ${rows.map(b => {
                    const photos = normalisePhotos(b.photos);
                    const firstPhoto = photos[0]?.preview;

                    const thumb = firstPhoto
                      ? `
                        <img
                          class="row-avatar row-avatar-bus-photo"
                          src="${esc(firstPhoto)}"
                          alt=""
                          data-view-photos="${esc(b.id)}"
                          title="View photos"
                        />
                      `
                      : `
                        <div
                          class="row-avatar row-avatar-bus"
                          data-view-photos="${esc(b.id)}"
                          title="No photos yet"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            width="18"
                            height="18"
                          >
                            <rect x="3" y="6" width="18" height="10" rx="2"/>
                            <path d="M3 11h18"/>
                            <path d="M7 6v5M17 6v5"/>
                            <circle cx="7.5" cy="18" r="1.4"/>
                            <circle cx="16.5" cy="18" r="1.4"/>
                          </svg>
                        </div>
                      `;

                    return `
                      <tr>
                        <td>
                          <div class="staff-cell">
                            ${thumb}

                            <div>
                              <div class="cell-strong cell-mono">
                                ${esc(b.plate)}
                              </div>

                              <div class="cell-sub">
                                ${esc(b.model)}

                                ${
                                  photos.length
                                    ? ` · ${photos.length} photo${photos.length > 1 ? "s" : ""}`
                                    : ""
                                }
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>${esc(b.type || "")}</td>

                        <td>
                          ${Number(b.capacity || 0)} seats
                        </td>

                        <td class="cell-mono">
                          ${Number(b.odometer || 0).toLocaleString()} km
                        </td>

                        <td>
                          <span class="pill ${esc(b.status || "")}">
                            ${esc(b.status || "")}
                          </span>
                        </td>

                        <td class="td-actions">
                          <button
                            class="icon-btn"
                            title="Toggle status"
                            data-toggle-bus="${esc(b.id)}"
                          >
                            ⇄
                          </button>

                          <button
                            class="icon-btn"
                            title="Edit"
                            data-edit-bus="${esc(b.id)}"
                          >
                            ✎
                          </button>

                          <button
                            class="icon-btn danger"
                            title="Delete"
                            data-del-bus="${esc(b.id)}"
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
          : emptyHTML("No buses match your search.");

        bindBusActions();
      }

      function bindBusActions() {
        $$("[data-toggle-bus]", root).forEach(button => {
          button.addEventListener("click", async () => {
            try {
              await OpsAPI.toggleBusStatus(button.dataset.toggleBus);
              toast("Bus status updated.");
              go("buses");
            } catch (error) {
              console.error(error);
              toast(error.message || "Unable to update bus status.");
            }
          });
        });

        $$("[data-edit-bus]", root).forEach(button => {
          button.addEventListener("click", () => {
            const bus = buses.find(
              x => String(x.id) === String(button.dataset.editBus)
            );

            if (bus) {
              openBusForm(bus);
            }
          });
        });

        $$("[data-del-bus]", root).forEach(button => {
          button.addEventListener("click", () => {
            const bus = buses.find(
              x => String(x.id) === String(button.dataset.delBus)
            );

            if (!bus) return;

            confirmAction(
              `Delete bus <strong>${esc(bus.plate)}</strong>? This can't be undone.`,
              async () => {
                try {
                  await OpsAPI.deleteBus(bus.id);
                  toast("Bus deleted.");
                  go("buses");
                } catch (error) {
                  console.error(error);
                  toast(error.message || "Unable to delete bus.");
                }
              }
            );
          });
        });

        $$("[data-view-photos]", root).forEach(element => {
          element.addEventListener("click", () => {
            const bus = buses.find(
              x => String(x.id) === String(element.dataset.viewPhotos)
            );

            if (bus) {
              openPhotoGallery(bus);
            }
          });
        });
      }

      $("#busSearch", root).addEventListener("input", draw);
      $("#busStatusFilter", root).addEventListener("change", draw);
      $("#addBusBtn", root).addEventListener("click", () => openBusForm());

      draw();
    } catch (error) {
      console.error("Loading buses failed:", error);

      root.innerHTML = emptyHTML(
        error.message || "Unable to load buses."
      );
    }
  }

  function openPhotoGallery(bus) {
    const photos = normalisePhotos(bus.photos);

    openForm(
      `${bus.plate} — Photos`,
      photos.length
        ? `
          <div class="bus-gallery-grid">
            ${photos.map(photo => `
              <img
                src="${esc(photo.preview)}"
                alt="${esc(bus.plate)}"
              />
            `).join("")}
          </div>
        `
        : `
          <div class="empty">
            <div class="ico">📷</div>
            No photos uploaded yet — add some from Edit bus.
          </div>
        `
    );
  }

  function photoSlotHTML(index, photo) {
    if (!photo) {
      return `
        <div class="bus-photo-slot" data-slot="${index}">
          <label class="bus-photo-add">
            <span>+ Add</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              data-upload-photo="${index}"
              hidden
            />
          </label>
        </div>
      `;
    }

    return `
      <div class="bus-photo-slot" data-slot="${index}">
        <img
          src="${esc(photo.preview)}"
          alt=""
        />

        <button
          type="button"
          class="bus-photo-remove"
          data-remove-photo="${index}"
          title="Remove"
        >
          ✕
        </button>
      </div>
    `;
  }

  function openBusForm(bus) {
    const isEdit = !!bus;

    const originalPhotos = isEdit
      ? normalisePhotos(bus.photos)
      : [];

    const photos = [...originalPhotos];

    const removedPhotoIds = new Set();

    while (photos.length < 4) {
      photos.push(null);
    }

    const body = openForm(
      isEdit ? "Edit bus" : "Add bus",
      `
        <form id="busForm" class="form-grid">

          <div class="row-2">
            <div class="field-v">
              <label for="bfPlate">Plate number</label>
              <input
                type="text"
                id="bfPlate"
                value="${esc(bus?.plate || "")}"
                placeholder="e.g. NC-9302"
                required
              />
            </div>

            <div class="field-v">
              <label for="bfModel">Model</label>
              <input
                type="text"
                id="bfModel"
                value="${esc(bus?.model || "")}"
                placeholder="e.g. Magnate"
                required
              />
            </div>
          </div>

          <div class="row-3">
            <div class="field-v">
              <label for="bfType">Type</label>
              <select id="bfType">
                ${
                  ["AC Luxury", "Semi-Luxury", "AC Sleeper", "Standard"]
                    .map(type => `
                      <option
                        ${bus?.type === type ? "selected" : ""}
                      >
                        ${type}
                      </option>
                    `)
                    .join("")
                }
              </select>
            </div>

            <div class="field-v">
              <label for="bfCapacity">Capacity</label>
              <input
                type="text"
                inputmode="numeric"
                id="bfCapacity"
                value="${bus?.capacity ?? 32}"
              />
            </div>

            <div class="field-v">
              <label for="bfFuel">Fuel type</label>
              <select id="bfFuel">
                ${
                  ["Diesel", "Petrol", "Electric", "Hybrid"]
                    .map(type => `
                      <option
                        ${bus?.fuelType === type ? "selected" : ""}
                      >
                        ${type}
                      </option>
                    `)
                    .join("")
                }
              </select>
            </div>
          </div>

          <div class="row-2">
            <div class="field-v">
              <label for="bfOdo">Odometer (km)</label>
              <input
                type="text"
                inputmode="numeric"
                id="bfOdo"
                value="${bus?.odometer ?? 0}"
              />
            </div>

            <div class="field-v">
              <label for="bfStatus">Status</label>
              <select id="bfStatus">
                <option
                  value="active"
                  ${bus?.status === "active" ? "selected" : ""}
                >
                  Active
                </option>

                <option
                  value="maintenance"
                  ${bus?.status === "maintenance" ? "selected" : ""}
                >
                  Maintenance
                </option>
              </select>
            </div>
          </div>

          <div class="field-v">
            <label for="bfMaintInterval">Service every (km)</label>

            <input
              type="text"
              inputmode="numeric"
              id="bfMaintInterval"
              value="${bus?.maintenanceIntervalKm ?? 10000}"
              placeholder="e.g. 5000 or 10000"
            />

            <span class="field-hint">
              Alerts on the Fuel &amp; Maintenance page once the bus
              has covered this many km since its last logged service.
            </span>
          </div>

          <div class="field-v">
            <label>Photos (up to 4)</label>

            <div
              class="bus-photo-grid"
              id="busPhotoGrid"
            >
              ${photos
                .map((photo, index) => photoSlotHTML(index, photo))
                .join("")}
            </div>

            <span class="field-hint">
              Photos are stored on the PHP server and shown to passengers
              when they search for a trip.
            </span>
          </div>

          <button
            class="btn brand"
            type="submit"
          >
            ${isEdit ? "Save changes" : "Add bus"}
          </button>
        </form>
      `
    );

    function rebindPhotoSlots() {
      $("#busPhotoGrid", body).innerHTML = photos
        .map((photo, index) => photoSlotHTML(index, photo))
        .join("");

      $$("[data-upload-photo]", body).forEach(input => {
        input.addEventListener("change", async event => {
          const file = event.target.files[0];

          if (!file) return;

          if (!file.type.startsWith("image/")) {
            toast("Please select an image file.");
            return;
          }

          try {
            const preview = await fileToDataUrl(file);

            const index = Number(input.dataset.uploadPhoto);

            photos[index] = {
              id: null,
              path: "",
              preview,
              file,
              isNew: true,
            };

            rebindPhotoSlots();
          } catch (error) {
            console.error(error);
            toast("Couldn't preview that image.");
          }
        });
      });

      $$("[data-remove-photo]", body).forEach(button => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset.removePhoto);
          const photo = photos[index];

          if (photo?.id) {
            removedPhotoIds.add(Number(photo.id));
          }

          photos[index] = null;

          // Keep four slots available.
          while (photos.length < 4) {
            photos.push(null);
          }

          rebindPhotoSlots();
        });
      });
    }

    rebindPhotoSlots();

    $("#busForm", body).addEventListener("submit", async event => {
      event.preventDefault();

      const submitButton = $('button[type="submit"]', body);

      const data = {
        plate: $("#bfPlate", body).value.trim().toUpperCase(),
        model: $("#bfModel", body).value.trim(),
        type: $("#bfType", body).value,
        capacity: Number($("#bfCapacity", body).value) || 0,
        fuelType: $("#bfFuel", body).value,
        odometer: Number($("#bfOdo", body).value) || 0,
        status: $("#bfStatus", body).value,
        maintenanceIntervalKm:
          Number($("#bfMaintInterval", body).value) || 10000,
      };

      if (!data.plate || !data.model) {
        toast("Plate and model are required.");
        return;
      }

      if (data.capacity <= 0) {
        toast("Capacity must be greater than 0.");
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = isEdit
        ? "Saving…"
        : "Adding…";

      try {
        let savedBus;

        if (isEdit) {
          savedBus = await OpsAPI.updateBus(bus.id, data);
        } else {
          savedBus = await OpsAPI.createBus(data);
        }

        /*
         * The PHP API returns the actual numeric bus id.
         * For an old/mock OpsAPI response, fall back to the existing id.
         */
        const busId =
          savedBus?.id ??
          bus?.id;

        if (!busId) {
          throw new Error(
            "Bus was saved, but the server did not return a bus ID for photo upload."
          );
        }

        // Delete photos the user removed.
        for (const photoId of removedPhotoIds) {
          try {
            await deleteBusPhoto(photoId);
          } catch (error) {
            console.error(
              `Failed to delete photo ${photoId}:`,
              error
            );
          }
        }

        // Upload newly selected photos.
        const newPhotos = photos.filter(
          photo => photo?.isNew && photo.file
        );

        for (const photo of newPhotos) {
          await uploadBusPhoto(busId, photo.file);
        }

        closeModal("formModal");

        toast(
          isEdit
            ? "Bus updated."
            : "Bus added."
        );

        go("buses");
      } catch (error) {
        console.error("Bus save error:", error);

        submitButton.disabled = false;
        submitButton.textContent = isEdit
          ? "Save changes"
          : "Add bus";

        toast(
          error.message ||
          "Unable to save the bus."
        );
      }
    });
  }

  ROUTES_MAP.buses = {
    title: "Buses",
    sub: "Add, update, or retire buses in your fleet.",
    render: renderBuses,
  };
})();