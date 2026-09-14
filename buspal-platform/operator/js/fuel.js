/* ============================================================
   BusPal — Operator Dashboard — Fuel & Maintenance
   Real PHP + MySQL backend
   ============================================================ */

(() => {

  async function renderFuel(root) {

    root.innerHTML = `
      <div class="empty">
        <div class="ico">⛽</div>
        Loading…
      </div>
    `;


    let log;
    let buses;
    let maintenance;
    let maintLog;

    try {

      [
        log,
        buses,
        maintenance,
        maintLog
      ] = await Promise.all([
        OpsAPI.getFuelLog(),
        OpsAPI.getBuses(),
        OpsAPI.getMaintenanceStatus(),
        OpsAPI.getMaintenanceLog()
      ]);

    } catch (error) {

      console.error(
        "Fuel & Maintenance loading error:",
        error
      );

      root.innerHTML =
        emptyHTML(
          error.message ||
          "Unable to load Fuel & Maintenance data."
        );

      return;
    }


    const totalCost =
      log.reduce(
        (sum, fuel) =>
          sum + Number(fuel.cost || 0),
        0
      );


    const totalLiters =
      log.reduce(
        (sum, fuel) =>
          sum + Number(fuel.liters || 0),
        0
      );


    const avgCost =
      totalLiters
        ? totalCost / totalLiters
        : 0;


    const dueCount =
      maintenance.filter(
        m =>
          m.level === "overdue" ||
          m.level === "due-soon"
      ).length;


    root.innerHTML = `

      <!-- =====================================================
           SUMMARY
           ===================================================== -->

      <div class="grid-4">

        <div class="stat-card">
          <div class="k">
            ${fmtLKR(totalCost)}
          </div>
          <div class="l">
            Total logged spend
          </div>
        </div>


        <div class="stat-card">
          <div class="k">
            ${totalLiters.toLocaleString()} L
          </div>
          <div class="l">
            Total fuel logged
          </div>
        </div>


        <div class="stat-card">
          <div class="k">
            ${fmtLKR(
              Math.round(avgCost)
            )}
          </div>
          <div class="l">
            Avg. cost / liter
          </div>
        </div>


        <div
          class="stat-card kpi-clickable"
          id="maintJumpCard"
        >
          <div
            class="k"
            style="
              color:${
                dueCount
                  ? "var(--danger)"
                  : "var(--brand-2)"
              }
            "
          >
            ${dueCount}
          </div>

          <div class="l">
            Buses due for service
          </div>
        </div>

      </div>


      <!-- =====================================================
           MAINTENANCE
           ===================================================== -->

      <div id="maintenanceCard">

        <div
          class="section-toolbar"
          style="margin-bottom:12px"
        >

          <div>

            <h3>
              Maintenance
            </h3>

            <p
              class="muted small"
              style="margin-top:2px"
            >
              Track service intervals, send a bus
              for maintenance, and log service history
              — per bus.
            </p>

          </div>

        </div>


        <div
          class="maint-grid"
          id="maintGridWrap"
        ></div>

      </div>


      <!-- =====================================================
           SERVICE HISTORY
           ===================================================== -->

      <div class="section-toolbar">

        <div>

          <h3
            style="margin-bottom:2px"
          >
            Service history
          </h3>

        </div>


        <div class="filters">

          <select
            class="filter-input"
            id="maintBusFilter"
          >

            <option value="">
              All buses
            </option>

            ${buses.map(bus => `
              <option value="${bus.id}">
                ${esc(bus.plate)}
              </option>
            `).join("")}

          </select>

        </div>


        <button
          class="btn brand"
          id="addServiceBtn"
          type="button"
        >
          + Log a service
        </button>

      </div>


      <div
        id="maintLogTableWrap"
      ></div>


      <!-- =====================================================
           FUEL LOG
           ===================================================== -->

      <div class="section-toolbar">

        <div>

          <h3
            style="margin-bottom:2px"
          >
            Fuel log
          </h3>

        </div>


        <div class="filters">

          <select
            class="filter-input"
            id="fuelBusFilter"
          >

            <option value="">
              All buses
            </option>

            ${buses.map(bus => `
              <option value="${bus.id}">
                ${esc(bus.plate)}
              </option>
            `).join("")}

          </select>

        </div>


        <button
          class="btn brand"
          id="addFuelBtn"
          type="button"
        >
          + Log fuel entry
        </button>

      </div>


      <div
        id="fuelTableWrap"
      ></div>

    `;


    /* ========================================================
       MAINTENANCE DRAW
       ======================================================== */

    drawMaintenance(
      root,
      maintenance
    );


    drawMaintLog(
      root,
      maintLog,
      buses
    );


    /* ========================================================
       BUTTONS
       ======================================================== */

    $("#maintJumpCard", root)
      .addEventListener(
        "click",
        () =>
          $("#maintenanceCard", root)
            .scrollIntoView({
              behavior: "smooth"
            })
      );


    $("#maintBusFilter", root)
      .addEventListener(
        "change",
        () =>
          drawMaintLog(
            root,
            maintLog,
            buses
          )
      );


    $("#addServiceBtn", root)
      .addEventListener(
        "click",
        () =>
          openServiceForm(
            buses
          )
      );


    /* ========================================================
       FUEL DRAW
       ======================================================== */

    function drawFuel() {

      const busF =
        $("#fuelBusFilter", root)
          .value;


      const rows =
        log.filter(
          fuel =>
            !busF ||
            String(fuel.busId) ===
            String(busF)
        );


      $("#fuelTableWrap", root)
        .innerHTML =
        rows.length

          ? `
            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>
                    <th>Date</th>
                    <th>Bus</th>
                    <th>Liters</th>
                    <th>Cost</th>
                    <th>Odometer</th>
                    <th>Station</th>
                    <th></th>
                  </tr>

                </thead>


                <tbody>

                  ${rows.map(fuel => `

                    <tr>

                      <td class="cell-mono">
                        ${esc(fuel.date)}
                      </td>


                      <td class="cell-strong">

                        ${
                          fuel.bus?.plate
                            ? esc(
                                fuel.bus.plate
                              )
                            : fuel.plate
                              ? esc(
                                  fuel.plate
                                )
                              : (() => {

                                  const bus =
                                    buses.find(
                                      b =>
                                        Number(b.id) ===
                                        Number(fuel.busId)
                                    );

                                  return bus
                                    ? esc(
                                        bus.plate
                                      )
                                    : "—";

                                })()
                        }

                      </td>


                      <td>
                        ${Number(
                          fuel.liters || 0
                        )} L
                      </td>


                      <td class="cell-mono">
                        ${fmtLKR(
                          fuel.cost
                        )}
                      </td>


                      <td class="cell-mono">
                        ${Number(
                          fuel.odometer || 0
                        ).toLocaleString()} km
                      </td>


                      <td>
                        ${esc(
                          fuel.station || "—"
                        )}
                      </td>


                      <td class="td-actions">

                        <button
                          type="button"
                          class="icon-btn"
                          title="Edit"
                          data-edit-fuel="${Number(
                            fuel.id
                          )}"
                        >
                          ✎
                        </button>


                        <button
                          type="button"
                          class="icon-btn danger"
                          title="Delete"
                          data-del-fuel="${Number(
                            fuel.id
                          )}"
                        >
                          🗑
                        </button>

                      </td>

                    </tr>

                  `).join("")}

                </tbody>

              </table>

            </div>
          `

          : emptyHTML(
              "No fuel entries logged yet."
            );


      /* ======================================================
         EDIT FUEL
         ====================================================== */

      $$(
        "[data-edit-fuel]",
        root
      ).forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const fuelId =
              Number(
                button.dataset.editFuel
              );


            const entry =
              log.find(
                fuel =>
                  Number(fuel.id) ===
                  fuelId
              );


            if (!entry) {

              toast(
                "Could not find this fuel entry."
              );

              return;
            }


            openFuelForm(
              buses,
              entry
            );

          }
        );

      });


      /* ======================================================
         DELETE FUEL
         ====================================================== */

      $$(
        "[data-del-fuel]",
        root
      ).forEach(button => {

        button.addEventListener(
          "click",
          () => {

            confirmAction(
              "Delete this fuel entry?",

              async () => {

                await OpsAPI.deleteFuelEntry(
                  Number(
                    button.dataset.delFuel
                  )
                );


                toast(
                  "Fuel entry deleted."
                );


                go("fuel");
              }
            );

          }
        );

      });

    }


    $("#fuelBusFilter", root)
      .addEventListener(
        "change",
        drawFuel
      );


    $("#addFuelBtn", root)
      .addEventListener(
        "click",
        () =>
          openFuelForm(
            buses
          )
      );


    drawFuel();
  }


  /* ==========================================================
     MAINTENANCE CARDS
     ========================================================== */

  function drawMaintenance(
    root,
    maintenance
  ) {

    const levelOrder = {
      overdue: 0,
      "due-soon": 1,
      ok: 2
    };


    const rows =
      [...maintenance].sort(
        (a, b) =>
          levelOrder[a.level] -
          levelOrder[b.level]
      );


    $("#maintGridWrap", root)
      .innerHTML =
      rows
        .map(
          m =>
            maintCardHTML(m)
        )
        .join("");


    $$(
      "[data-log-service]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () =>
          openServiceForm(
            maintenance,
            Number(
              button.dataset.logService
            )
          )
      );

    });


    $$(
      "[data-edit-interval]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const bus =
            maintenance.find(
              m =>
                Number(m.id) ===
                Number(
                  button.dataset.editInterval
                )
            );


          if (bus) {
            openIntervalForm(bus);
          }

        }
      );

    });


    $$(
      "[data-send-maint]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const bus =
            maintenance.find(
              m =>
                Number(m.id) ===
                Number(
                  button.dataset.sendMaint
                )
            );


          if (bus) {
            openSendToMaintenanceForm(
              bus
            );
          }

        }
      );

    });


    $$(
      "[data-return-service]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const bus =
            maintenance.find(
              m =>
                Number(m.id) ===
                Number(
                  button.dataset.returnService
                )
            );


          if (bus) {
            openReturnToServiceForm(
              bus
            );
          }

        }
      );

    });

  }


  /* ==========================================================
     MAINTENANCE CARD HTML
     ========================================================== */

  function maintCardHTML(m) {

    const pct =
      Math.max(
        0,
        Math.min(
          100,
          (m.kmSinceService /
            m.interval) *
            100
        )
      );


    const inMaintenance =
      m.status ===
      "maintenance";


    return `

      <div class="card maint-card">

        <div class="maint-card-head">

          <div>

            <div class="plate">
              ${esc(m.plate)}
            </div>

            <div class="model">
              ${esc(m.model)}
            </div>

          </div>


          <span
            class="
              pill
              ${
                inMaintenance
                  ? "maintenance"
                  : "active"
              }
            "
          >
            ${
              inMaintenance
                ? "in maintenance"
                : "active"
            }
          </span>

        </div>


        <div>

          <div class="maint-progress-track">

            <div
              class="
                maint-progress-fill
                ${m.level}
              "
              style="
                width:${pct}%
              "
            ></div>

          </div>


          <div class="maint-progress-label">

            <span>
              ${Number(
                m.kmSinceService || 0
              ).toLocaleString()}
              km since service
            </span>


            <span>
              ${maintStatusText(m)}
            </span>

          </div>

        </div>


        <div class="maint-stats-row">

          <div>

            <div class="lbl">
              Odometer
            </div>

            <div class="val">
              ${Number(
                m.odometer || 0
              ).toLocaleString()}
              km
            </div>

          </div>


          <div>

            <div class="lbl">
              Last service
            </div>

            <div class="val">
              ${Number(
                m.lastService || 0
              ).toLocaleString()}
              km
            </div>

          </div>


          <div>

            <div class="lbl">
              Interval
            </div>


            <div class="val">

              ${Number(
                m.interval || 0
              ).toLocaleString()}
              km


              <button
                type="button"
                class="icon-btn"
                style="
                  width:22px;
                  height:22px;
                  font-size:11px
                "
                title="Edit interval"
                data-edit-interval="${Number(
                  m.id
                )}"
              >
                ✎
              </button>

            </div>

          </div>

        </div>


        <div
          class="maint-card-actions"
        >

          <button
            type="button"
            class="btn sm"
            data-log-service="${Number(
              m.id
            )}"
          >
            Log service
          </button>


          ${
            inMaintenance

              ? `
                <button
                  type="button"
                  class="btn sm brand"
                  data-return-service="${Number(
                    m.id
                  )}"
                >
                  Return to service
                </button>
              `

              : `
                <button
                  type="button"
                  class="btn sm danger"
                  data-send-maint="${Number(
                    m.id
                  )}"
                >
                  Send to maintenance
                </button>
              `
          }

        </div>

      </div>

    `;
  }


  function maintStatusText(m) {

    if (
      m.level ===
      "overdue"
    ) {

      return `overdue by ${
        Math.abs(
          Number(m.kmUntilDue || 0)
        ).toLocaleString()
      } km`;

    }


    if (
      m.level ===
      "due-soon"
    ) {

      return `due in ${
        Number(
          m.kmUntilDue || 0
        ).toLocaleString()
      } km`;

    }


    return `${
      Number(
        m.kmUntilDue || 0
      ).toLocaleString()
    } km left`;
  }


  /* ==========================================================
     INTERVAL FORM
     ========================================================== */

  function openIntervalForm(
    bus
  ) {

    const body =
      openForm(
        `Service interval — ${
          bus.plate
        }`,

        `
          <form
            id="intervalForm"
            class="form-grid"
          >

            <div class="field-v">

              <label
                for="ivInterval"
              >
                Service every (km)
              </label>

              <input
                type="text"
                inputmode="numeric"
                id="ivInterval"
                value="${Number(
                  bus.interval || 0
                )}"
                placeholder="e.g. 5000 or 10000"
              />

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              Save interval
            </button>

          </form>
        `
      );


    $("#intervalForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const interval =
            Number(
              $(
                "#ivInterval",
                body
              ).value
            );


          if (
            !Number.isFinite(interval) ||
            interval <= 0
          ) {

            toast(
              "Enter a valid service interval."
            );

            return;
          }


          await OpsAPI.updateMaintenanceInterval(
            bus.id,
            interval
          );


          closeModal(
            "formModal"
          );


          toast(
            "Interval updated."
          );


          go("fuel");
        }
      );
  }


  /* ==========================================================
     SEND TO MAINTENANCE
     ========================================================== */

  function openSendToMaintenanceForm(
    bus
  ) {

    const body =
      openForm(
        `Send ${bus.plate} for maintenance`,

        `
          <form
            id="sendMaintForm"
            class="form-grid"
          >

            <p class="muted small">

              This marks the bus as unavailable
              for scheduling until it's returned
              to service.

            </p>


            <div class="field-v">

              <label
                for="smNote"
              >
                Reason / note
              </label>


              <input
                type="text"
                id="smNote"
                placeholder="e.g. Brake inspection, AC repair"
              />

            </div>


            <button
              class="btn danger"
              type="submit"
            >
              Send for maintenance
            </button>

          </form>
        `
      );


    $("#sendMaintForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          await OpsAPI.sendToMaintenance(
            bus.id,
            $(
              "#smNote",
              body
            ).value.trim()
          );


          closeModal(
            "formModal"
          );


          toast(
            `${bus.plate} sent for maintenance.`
          );


          go("fuel");
        }
      );
  }


  /* ==========================================================
     RETURN TO SERVICE
     ========================================================== */

  function openReturnToServiceForm(
    bus
  ) {

    const today =
      new Date()
        .toISOString()
        .slice(0, 10);


    const body =
      openForm(
        `Return ${bus.plate} to service`,

        `
          <form
            id="returnForm"
            class="form-grid"
          >

            <div class="row-2">

              <div class="field-v">

                <label
                  for="rsDate"
                >
                  Date
                </label>


                <input
                  type="date"
                  id="rsDate"
                  value="${today}"
                />

              </div>


              <div class="field-v">

                <label
                  for="rsOdo"
                >
                  Odometer (km)
                </label>


                <input
                  type="text"
                  inputmode="numeric"
                  id="rsOdo"
                  value="${Number(
                    bus.odometer || 0
                  )}"
                />

              </div>

            </div>


            <div class="field-v">

              <label
                for="rsNote"
              >
                Work done
              </label>


              <input
                type="text"
                id="rsNote"
                placeholder="e.g. Brake pads replaced, full service"
              />

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              Return to service
            </button>

          </form>
        `
      );


    $("#returnForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          await OpsAPI.returnToService(
            bus.id,
            {
              date:
                $(
                  "#rsDate",
                  body
                ).value,

              odometer:
                $(
                  "#rsOdo",
                  body
                ).value,

              note:
                $(
                  "#rsNote",
                  body
                ).value.trim()
            }
          );


          closeModal(
            "formModal"
          );


          toast(
            `${bus.plate} returned to service.`
          );


          go("fuel");
        }
      );
  }


  /* ==========================================================
     SERVICE HISTORY
     ========================================================== */

  function drawMaintLog(
    root,
    maintLog,
    buses
  ) {

    const busF =
      $("#maintBusFilter", root)
        .value;


    const rows =
      maintLog.filter(
        maintenance =>
          !busF ||
          String(
            maintenance.busId
          ) === String(busF)
      );


    $("#maintLogTableWrap", root)
      .innerHTML =
      rows.length

        ? `
          <div class="table-wrap">

            <table class="data-table">

              <thead>

                <tr>
                  <th>Date</th>
                  <th>Bus</th>
                  <th>Odometer</th>
                  <th>Note</th>
                  <th></th>
                </tr>

              </thead>


              <tbody>

                ${rows.map(entry => `

                  <tr>

                    <td class="cell-mono">
                      ${esc(entry.date)}
                    </td>


                    <td class="cell-strong">

                      ${
                        entry.bus?.plate
                          ? esc(
                              entry.bus.plate
                            )
                          : (() => {

                              const bus =
                                buses.find(
                                  b =>
                                    Number(b.id) ===
                                    Number(
                                      entry.busId
                                    )
                                );

                              return bus
                                ? esc(
                                    bus.plate
                                  )
                                : "—";

                            })()
                      }

                    </td>


                    <td class="cell-mono">
                      ${Number(
                        entry.odometer || 0
                      ).toLocaleString()}
                      km
                    </td>


                    <td>

                      ${esc(
                        entry.note || ""
                      )}

                      ${
                        entry.type === "sent"

                          ? `
                            <span class="badge bad">
                              sent
                            </span>
                          `

                          : entry.type ===
                            "returned"

                            ? `
                              <span class="badge ok">
                                returned
                              </span>
                            `

                            : ""
                      }

                    </td>


                    <td class="td-actions">

                      <button
                        type="button"
                        class="icon-btn"
                        title="Edit"
                        data-edit-service="${Number(
                          entry.id
                        )}"
                      >
                        ✎
                      </button>


                      <button
                        type="button"
                        class="icon-btn danger"
                        title="Delete"
                        data-del-service="${Number(
                          entry.id
                        )}"
                      >
                        🗑
                      </button>

                    </td>

                  </tr>

                `).join("")}

              </tbody>

            </table>

          </div>
        `

        : emptyHTML(
            "No service history logged yet."
          );


    /* ========================================================
       EDIT SERVICE
       ======================================================== */

    $$(
      "[data-edit-service]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const entryId =
            Number(
              button.dataset.editService
            );


          const entry =
            maintLog.find(
              item =>
                Number(item.id) ===
                entryId
            );


          if (!entry) {

            toast(
              "Could not find this service record."
            );

            return;
          }


          openServiceForm(
            buses,
            entry.busId,
            entry
          );
        }
      );

    });


    /* ========================================================
       DELETE SERVICE
       ======================================================== */

    $$(
      "[data-del-service]",
      root
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          confirmAction(
            "Delete this service record? This will recalculate that bus's maintenance status.",

            async () => {

              await OpsAPI.deleteMaintenanceEntry(
                Number(
                  button.dataset.delService
                )
              );


              toast(
                "Service record deleted."
              );


              go("fuel");
            }
          );

        }
      );

    });

  }


  /* ==========================================================
     SERVICE FORM
     ========================================================== */

  function openServiceForm(
    buses,
    preselectBusId,
    existingEntry
  ) {

    const isEdit =
      !!existingEntry;


    const selectedBusId =
      existingEntry
        ? Number(existingEntry.busId)
        : (
            preselectBusId != null
              ? Number(preselectBusId)
              : null
          );


    const bus =
      selectedBusId != null
        ? buses.find(
            item =>
              Number(item.id) ===
              selectedBusId
          )
        : null;


    const body =
      openForm(
        isEdit
          ? "Edit service record"
          : "Log a service",

        `
          <form
            id="serviceForm"
            class="form-grid"
          >

            <div class="field-v">

              <label for="svBus">
                Bus
              </label>


              <select
                id="svBus"
                ${isEdit ? "disabled" : ""}
                required
              >

                ${buses.map(item => `

                  <option
                    value="${item.id}"
                    ${
                      selectedBusId ===
                      Number(item.id)
                        ? "selected"
                        : ""
                    }
                  >
                    ${esc(item.plate)}
                    ·
                    ${esc(item.model)}
                  </option>

                `).join("")}

              </select>

            </div>


            <div class="row-2">

              <div class="field-v">

                <label for="svDate">
                  Date
                </label>


                <input
                  type="date"
                  id="svDate"
                  value="${
                    existingEntry?.date ||
                    new Date()
                      .toISOString()
                      .slice(0, 10)
                  }"
                />

              </div>


              <div class="field-v">

                <label for="svOdo">
                  Odometer (km)
                </label>


                <input
                  type="text"
                  inputmode="numeric"
                  id="svOdo"
                  value="${
                    existingEntry?.odometer ??
                    bus?.odometer ??
                    ""
                  }"
                  placeholder="Reading at time of service"
                />

              </div>

            </div>


            <div class="field-v">

              <label for="svNote">
                Note
              </label>


              <input
                type="text"
                id="svNote"
                value="${esc(
                  existingEntry?.note ||
                  ""
                )}"
                placeholder="e.g. Full service — oil, filters, brakes"
              />

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              ${
                isEdit
                  ? "Save changes"
                  : "Log service"
              }
            </button>

          </form>
        `
      );


    $("#serviceForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const data = {

            busId:
              Number(
                $(
                  "#svBus",
                  body
                ).value
              ),

            date:
              $(
                "#svDate",
                body
              ).value,

            odometer:
              Number(
                $(
                  "#svOdo",
                  body
                ).value
              ) || 0,

            note:
              $(
                "#svNote",
                body
              ).value.trim()

          };


          if (!data.busId) {

            toast(
              "Select a bus."
            );

            return;
          }


          if (isEdit) {

            await OpsAPI.updateMaintenanceEntry(
              existingEntry.id,
              data
            );

          } else {

            await OpsAPI.addMaintenanceEntry(
              data
            );

          }


          closeModal(
            "formModal"
          );


          toast(
            isEdit
              ? "Service record updated."
              : "Service logged."
          );


          go("fuel");
        }
      );
  }


  /* ==========================================================
     FUEL FORM
     ========================================================== */

  function openFuelForm(
    buses,
    existingEntry
  ) {

    const isEdit =
      !!existingEntry;


    const selectedBusId =
      existingEntry
        ? Number(
            existingEntry.busId
          )
        : null;


    const body =
      openForm(
        isEdit
          ? "Edit fuel entry"
          : "Log fuel entry",

        `
          <form
            id="fuelForm"
            class="form-grid"
          >

            <div class="row-2">

              <div class="field-v">

                <label for="ffBus">
                  Bus
                </label>


                <select
                  id="ffBus"
                  required
                >

                  <option value="">
                    Select bus…
                  </option>


                  ${buses.map(bus => `

                    <option
                      value="${bus.id}"
                      ${
                        selectedBusId ===
                        Number(bus.id)
                          ? "selected"
                          : ""
                      }
                    >
                      ${esc(bus.plate)}
                      ·
                      ${esc(bus.model)}
                    </option>

                  `).join("")}

                </select>

              </div>


              <div class="field-v">

                <label for="ffDate">
                  Date
                </label>


                <input
                  type="date"
                  id="ffDate"
                  value="${
                    existingEntry?.date ||
                    new Date()
                      .toISOString()
                      .slice(0, 10)
                  }"
                />

              </div>

            </div>


            <div class="row-2">

              <div class="field-v">

                <label for="ffLiters">
                  Liters
                </label>


                <input
                  type="text"
                  inputmode="decimal"
                  id="ffLiters"
                  value="${
                    existingEntry?.liters ??
                    ""
                  }"
                  placeholder="e.g. 120"
                />

              </div>


              <div class="field-v">

                <label for="ffCost">
                  Cost (LKR)
                </label>


                <input
                  type="text"
                  inputmode="numeric"
                  id="ffCost"
                  value="${
                    existingEntry?.cost ??
                    ""
                  }"
                  placeholder="e.g. 43200"
                />

              </div>

            </div>


            <div class="row-2">

              <div class="field-v">

                <label for="ffOdo">
                  Odometer (km)
                </label>


                <input
                  type="text"
                  inputmode="numeric"
                  id="ffOdo"
                  value="${
                    existingEntry?.odometer ??
                    ""
                  }"
                />

              </div>


              <div class="field-v">

                <label for="ffStation">
                  Fuel station
                </label>


                <input
                  type="text"
                  id="ffStation"
                  value="${esc(
                    existingEntry?.station ||
                    ""
                  )}"
                  placeholder="e.g. Ceypetco - Kegalle"
                />

              </div>

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              ${
                isEdit
                  ? "Save changes"
                  : "Save entry"
              }
            </button>

          </form>
        `
      );


    $("#fuelForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const busId =
            Number(
              $(
                "#ffBus",
                body
              ).value
            );


          if (!busId) {

            toast(
              "Select a bus first."
            );

            return;
          }


          const liters =
            Number(
              $(
                "#ffLiters",
                body
              ).value
            ) || 0;


          const cost =
            Number(
              $(
                "#ffCost",
                body
              ).value
            ) || 0;


          const odometer =
            Number(
              $(
                "#ffOdo",
                body
              ).value
            ) || 0;


          if (
            liters <= 0
          ) {

            toast(
              "Enter a valid fuel amount."
            );

            return;
          }


          if (
            cost < 0
          ) {

            toast(
              "Enter a valid fuel cost."
            );

            return;
          }


          const data = {

            busId,

            date:
              $(
                "#ffDate",
                body
              ).value,

            liters,

            cost,

            odometer,

            station:
              $(
                "#ffStation",
                body
              ).value.trim()

          };


          if (isEdit) {

            await OpsAPI.updateFuelEntry(
              existingEntry.id,
              data
            );

          } else {

            await OpsAPI.addFuelEntry(
              data
            );

          }


          closeModal(
            "formModal"
          );


          toast(
            isEdit
              ? "Fuel entry updated."
              : "Fuel entry logged."
          );


          go("fuel");
        }
      );
  }


  /* ==========================================================
     REGISTER ROUTE
     ========================================================== */

  ROUTES_MAP.fuel = {

    title:
      "Fuel & Maintenance",

    sub:
      "Log refills, track fuel spend, and stay ahead of service intervals.",

    render:
      renderFuel

  };

})();