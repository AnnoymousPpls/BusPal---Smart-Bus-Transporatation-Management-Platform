/* BusPal — Operator Dashboard — Routes & Schedules */

(() => {
  "use strict";

  const PAGE_KEY = "routes";

  /*
  |--------------------------------------------------------------------------
  | DATE HELPERS
  |--------------------------------------------------------------------------
  */

  function todaySriLanka() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }

  function addDays(dateString, days) {
    const [y, m, d] = dateString.split("-").map(Number);

    const date = new Date(
      Date.UTC(y, m - 1, d)
    );

    date.setUTCDate(
      date.getUTCDate() + days
    );

    return date
      .toISOString()
      .slice(0, 10);
  }

  function normaliseDate(value) {
    const valueString =
      String(value || "").trim();

    const match =
      valueString.match(
        /^(\d{4}-\d{2}-\d{2})/
      );

    return match
      ? match[1]
      : "";
  }


  /*
  |--------------------------------------------------------------------------
  | ROUTE HELPERS
  |--------------------------------------------------------------------------
  */

  function routeFrom(route) {
    return route?.from ??
      route?.from_city ??
      "";
  }

  function routeTo(route) {
    return route?.to ??
      route?.to_city ??
      "";
  }

  function routeDepartures(route) {
    return Array.isArray(route?.departures)
      ? route.departures
      : [];
  }


  /*
  |--------------------------------------------------------------------------
  | GENERAL HELPERS
  |--------------------------------------------------------------------------
  */

  function safeNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function escLocal(value) {
    if (typeof esc === "function") {
      return esc(value);
    }

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function money(value) {
    if (typeof fmtLKR === "function") {
      return fmtLKR(
        safeNumber(value)
      );
    }

    return `LKR ${safeNumber(value)
      .toLocaleString("en-LK")}`;
  }

  function showToast(message) {
    if (typeof toast === "function") {
      toast(message);
    } else {
      console.log(message);
    }
  }

  function showConfirm(message, action) {
    if (typeof confirmAction === "function") {
      confirmAction(
        message,
        action
      );

      return;
    }

    if (
      window.confirm(
        message.replace(/<[^>]*>/g, "")
      )
    ) {
      action();
    }
  }

  function query(selector, root) {
    return root.querySelector(selector);
  }

  function queryAll(selector, root) {
    return Array.from(
      root.querySelectorAll(selector)
    );
  }

  function empty(message) {
    if (typeof emptyHTML === "function") {
      return emptyHTML(message);
    }

    return `
      <div class="empty">
        <div class="ico">⌁</div>
        ${escLocal(message)}
      </div>
    `;
  }


  /*
  |--------------------------------------------------------------------------
  | SELECT OPTIONS
  |--------------------------------------------------------------------------
  */

  function optionHTML(
    list,
    selectedId,
    placeholder,
    type
  ) {
    const selected =
      selectedId == null
        ? ""
        : String(selectedId);

    const options =
      list.map(item => {

        const id =
          Number(item.id);

        const label =
          type === "bus"
            ? `${item.plate || ""}${
                item.model
                  ? ` · ${item.model}`
                  : ""
              }`
            : item.name || "";

        return `
          <option
            value="${id}"
            ${
              String(id) === selected
                ? "selected"
                : ""
            }
          >
            ${escLocal(label)}
          </option>
        `;
      }).join("");

    return `
      <option value="">
        ${escLocal(placeholder)}
      </option>
      ${options}
    `;
  }


  /*
  |--------------------------------------------------------------------------
  | MAIN ROUTE PAGE
  |--------------------------------------------------------------------------
  */

  async function renderRoutes(root) {

    root.innerHTML = `
      <div class="empty">
        <div class="ico">⌁</div>
        Loading routes…
      </div>
    `;


    /*
     * Load buses and staff.
     */

    let buses = [];
    let staff = [];

    try {

      [
        buses,
        staff
      ] = await Promise.all([
        BusPalAPI.getBuses(),
        BusPalAPI.getStaff(),
      ]);

    } catch (error) {

      console.error(
        "Routes dependency load failed:",
        error
      );

      root.innerHTML =
        empty(
          error?.message ||
          "Unable to load buses and staff."
        );

      return;
    }


    /*
     * Separate drivers and conductors.
     */

    const drivers =
      staff.filter(
        s =>
          String(
            s.role
          ).toLowerCase() ===
          "driver"
      );

    const conductors =
      staff.filter(
        s =>
          String(
            s.role
          ).toLowerCase() ===
          "conductor"
      );


    /*
     * Default date = today.
     */

    let selectedDate =
      todaySriLanka();

    let routes = [];


    /*
     |--------------------------------------------------------------------------
     | LOAD ROUTES FOR SELECTED DATE
     |--------------------------------------------------------------------------
     */

    async function loadRoutes(date) {

      const safeDate =
        normaliseDate(date) ||
        todaySriLanka();

      selectedDate =
        safeDate;


      /*
       * Existing API already supports
       *
       * GET /routes/?date=YYYY-MM-DD
       *
       * so we simply request the selected date.
       */

      const data =
        await BusPalAPI.getRoutes(
          safeDate
        );

      routes =
        Array.isArray(data)
          ? data
          : [];


      renderPage();
    }


    /*
     |--------------------------------------------------------------------------
     | PAGE RENDER
     |--------------------------------------------------------------------------
     */

    function renderPage() {

      const visibleCount =
        routes.filter(
          r =>
            Boolean(
              r.visible
            )
        ).length;


      const departureCount =
        routes.reduce(
          (sum, r) =>
            sum +
            routeDepartures(r).length,
          0
        );


      const averageFare =
        routes.length
          ? Math.round(
              routes.reduce(
                (sum, r) =>
                  sum +
                  safeNumber(
                    r.fare
                  ),
                0
              ) /
              routes.length
            )
          : 0;


      root.innerHTML = `

        <div class="grid-4">

          <div class="stat-card">
            <div class="k">
              ${routes.length}
            </div>

            <div class="l">
              Total routes
            </div>
          </div>


          <div class="stat-card">

            <div
              class="k"
              style="color:var(--brand-2)"
            >
              ${visibleCount}
            </div>

            <div class="l">
              Visible to passengers
            </div>

          </div>


          <div class="stat-card">

            <div class="k">
              ${departureCount}
            </div>

            <div class="l">
              Scheduled departures
            </div>

          </div>


          <div class="stat-card">

            <div class="k">
              ${money(averageFare)}
            </div>

            <div class="l">
              Average fare
            </div>

          </div>

        </div>


        <div class="section-toolbar">

          <div class="filters">

            <input
              class="filter-input"
              id="routeSearch"
              placeholder="Search by city…"
              autocomplete="off"
            />


            <select
              class="filter-input"
              id="routeDate"
            >

              <option value="yesterday">
                Yesterday
              </option>

              <option value="today">
                Today
              </option>

              <option value="tomorrow">
                Tomorrow
              </option>

              <option value="custom">
                Custom date
              </option>

            </select>


            <input
              type="date"
              class="filter-input"
              id="customRouteDate"
              value="${escLocal(selectedDate)}"
              style="display:none"
            />

          </div>


          <div
            style="
              display:flex;
              gap:8px;
              flex-wrap:wrap
            "
          >

            <button
              class="btn"
              id="downloadRouteReportBtn"
            >
              ↓ Download Report
            </button>


            <button
              class="btn brand"
              id="addRouteBtn"
            >
              + Add route
            </button>

          </div>

        </div>


        <div
          id="selectedDateLabel"
          style="
            margin:8px 0 14px;
            color:var(--muted);
            font-size:13px;
          "
        >
          Showing departures for
          <strong>
            ${escLocal(selectedDate)}
          </strong>
        </div>


        <div
          id="routeList"
          style="
            display:flex;
            flex-direction:column;
            gap:14px
          "
        ></div>

      `;


      syncDateControls();

      drawRoutes();

      bindPageControls();
    }


    /*
     |--------------------------------------------------------------------------
     | DATE CONTROL
     |--------------------------------------------------------------------------
     */

    function syncDateControls() {
  const dateSelect = query("#routeDate", root);
  const customDate = query("#customRouteDate", root);

  if (!dateSelect || !customDate) return;

  const today = todaySriLanka();
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  if (selectedDate === yesterday) {
    dateSelect.value = "yesterday";
    customDate.style.display = "none";

  } else if (selectedDate === today) {
    dateSelect.value = "today";
    customDate.style.display = "none";

  } else if (selectedDate === tomorrow) {
    dateSelect.value = "tomorrow";
    customDate.style.display = "none";

  } else {
    dateSelect.value = "custom";
    customDate.style.display = "";
    customDate.value = selectedDate;
  }
}


    /*
     |--------------------------------------------------------------------------
     | DRAW ROUTES
     |--------------------------------------------------------------------------
     */

    function drawRoutes() {

      const list =
        query(
          "#routeList",
          root
        );

      const search =
        query(
          "#routeSearch",
          root
        );


      if (
        !list ||
        !search
      ) {
        return;
      }


      const term =
        search.value
          .trim()
          .toLowerCase();


      const filtered =
        routes.filter(
          route => {

            const from =
              routeFrom(route)
                .toLowerCase();

            const to =
              routeTo(route)
                .toLowerCase();

            return (
              !term ||
              from.includes(term) ||
              to.includes(term)
            );
          }
        );


      if (!filtered.length) {

        list.innerHTML =
          empty(
            "No routes match your search."
          );

        return;
      }


      list.innerHTML =
        filtered.map(
          route => {

            /*
             * Sort departures by time.
             *
             * This guarantees:
             *
             * 06:00
             * 07:30
             * 09:15
             * 12:00
             * ...
             */

            const departures =
              [...routeDepartures(route)]
                .sort(
                  (a, b) =>
                    String(
                      a.time || ""
                    ).localeCompare(
                      String(
                        b.time || ""
                      )
                    )
                );


            const visible =
              Boolean(
                route.visible
              );


            return `

              <div
                class="
                  card
                  route-card
                  ${visible
                    ? "is-visible"
                    : ""}
                "
              >

                <div
                  class="route-card-head"
                >

                  <div>

                    <div
                      class="route-title"
                    >

                      ${escLocal(
                        routeFrom(route)
                      )}

                      <span
                        class="hc-arrow"
                      >
                        →
                      </span>

                      ${escLocal(
                        routeTo(route)
                      )}

                      <span
                        class="
                          pill
                          ${
                            visible
                              ? "active"
                              : "hidden-pill"
                          }
                        "
                      >
                        ${
                          visible
                            ? "visible to passengers"
                            : "hidden"
                        }
                      </span>

                    </div>


                    <div
                      class="
                        route-chip-row
                      "
                    >

                      <span
                        class="route-chip"
                      >
                        📏
                        ${safeNumber(
                          route.distanceKm
                        )}
                        km
                      </span>


                      <span
                        class="route-chip"
                      >
                        💵
                        ${money(
                          route.fare
                        )}
                      </span>


                      <span
                        class="route-chip"
                      >
                        🕑
                        ${departures.length}
                        departure${
                          departures.length === 1
                            ? ""
                            : "s"
                        }
                      </span>

                    </div>

                  </div>


                  <div
                    class="
                      route-card-actions
                    "
                  >

                    <label
                      class="toggle"
                    >

                      <input
                        type="checkbox"
                        ${
                          visible
                            ? "checked"
                            : ""
                        }
                        data-toggle-route="${
                          Number(route.id)
                        }"
                      />

                      <span
                        class="toggle-track"
                      ></span>

                      <span
                        class="toggle-label"
                      >
                        Show to passengers
                      </span>

                    </label>


                    <button
                      type="button"
                      class="icon-btn"
                      title="Edit route"
                      data-edit-route="${
                        Number(route.id)
                      }"
                    >
                      ✎
                    </button>


                    <button
                      type="button"
                      class="
                        icon-btn
                        danger
                      "
                      title="Delete route"
                      data-del-route="${
                        Number(route.id)
                      }"
                    >
                      🗑
                    </button>

                  </div>

                </div>


                <div
                  class="dep-list"
                >

                  ${
                    departures.length

                      ? departures
                          .map(
                            departure => `

                    <div
                      class="dep-row"
                    >

                      <div
                        class="dep-time"
                      >
                        ${escLocal(
                          String(
                            departure.time ||
                            ""
                          ).slice(
                            0,
                            5
                          )
                        )}
                      </div>


                      <div
                        class="dep-field"
                      >

                        <span
                          class="
                            dep-field-label
                          "
                        >
                          Bus
                        </span>

                        <select
                          data-assign="bus"
                          data-route="${
                            Number(route.id)
                          }"
                          data-dep="${
                            Number(
                              departure.id
                            )
                          }"
                        >

                          ${optionHTML(
                            buses,
                            departure.busId,
                            "Assign bus…",
                            "bus"
                          )}

                        </select>

                      </div>


                      <div
                        class="dep-field"
                      >

                        <span
                          class="
                            dep-field-label
                          "
                        >
                          Driver
                        </span>

                        <select
                          data-assign="driver"
                          data-route="${
                            Number(route.id)
                          }"
                          data-dep="${
                            Number(
                              departure.id
                            )
                          }"
                        >

                          ${optionHTML(
                            drivers,
                            departure.driverId,
                            "Assign driver…",
                            "staff"
                          )}

                        </select>

                      </div>


                      <div
                        class="dep-field"
                      >

                        <span
                          class="
                            dep-field-label
                          "
                        >
                          Conductor
                        </span>

                        <select
                          data-assign="conductor"
                          data-route="${
                            Number(route.id)
                          }"
                          data-dep="${
                            Number(
                              departure.id
                            )
                          }"
                        >

                          ${optionHTML(
                            conductors,
                            departure.conductorId,
                            "Assign conductor…",
                            "staff"
                          )}

                        </select>

                      </div>


                      <div
                        class="td-actions"
                      >

                        <button
                          type="button"
                          class="icon-btn"
                          title="${
                            departure.busId
                              ? "Start live tracking for this departure"
                              : "Assign a bus first"
                          }"
                          ${
                            departure.busId
                              ? ""
                              : "disabled"
                          }
                          data-quick-track="${
                            Number(route.id)
                          }:${
                            Number(
                              departure.id
                            )
                          }"
                        >
                          ▶
                        </button>


                        <button
                          type="button"
                          class="
                            icon-btn
                            danger
                          "
                          title="Remove departure"
                          data-del-dep="${
                            Number(route.id)
                          }:${
                            Number(
                              departure.id
                            )
                          }"
                        >
                          🗑
                        </button>

                      </div>

                    </div>

                  `
                          )
                          .join("")

                      : `

                    <div
                      class="
                        dep-empty-note
                      "
                    >
                      No departures scheduled
                      for this date.
                    </div>

                  `
                  }

                </div>


                <div
                  style="margin-top:10px"
                >

                  <button
                    type="button"
                    class="btn sm"
                    data-add-dep="${
                      Number(route.id)
                    }"
                  >
                    + Add departure time
                  </button>

                </div>

              </div>

            `;
          }
        ).join("");


      bindRouteActions();
    }


    /*
     |--------------------------------------------------------------------------
     | ROUTE ACTIONS
     |--------------------------------------------------------------------------
     */

    function bindRouteActions() {

      /*
       * Visibility.
       */

      queryAll(
        "[data-toggle-route]",
        root
      ).forEach(
        input => {

          input.addEventListener(
            "change",
            async () => {

              const routeId =
                Number(
                  input.dataset
                    .toggleRoute
                );

              input.disabled =
                true;


              try {

                await BusPalAPI
                  .toggleRouteVisible(
                    routeId
                  );

                showToast(
                  "Route visibility updated."
                );

                await loadRoutes(
                  selectedDate
                );

              } catch (error) {

                console.error(
                  "Route visibility update failed:",
                  error
                );

                input.checked =
                  !input.checked;

                showToast(
                  error?.message ||
                  "Unable to update route visibility."
                );

              } finally {

                input.disabled =
                  false;
              }
            }
          );
        }
      );


      /*
       * Edit route.
       */

      queryAll(
        "[data-edit-route]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const routeId =
                Number(
                  button.dataset
                    .editRoute
                );

              const route =
                routes.find(
                  r =>
                    Number(r.id) ===
                    routeId
                );


              if (!route) {

                showToast(
                  "Route not found."
                );

                return;
              }


              openRouteForm(
                route
              );
            }
          );
        }
      );


      /*
       * Delete route.
       */

      queryAll(
        "[data-del-route]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const routeId =
                Number(
                  button.dataset
                    .delRoute
                );

              const route =
                routes.find(
                  r =>
                    Number(r.id) ===
                    routeId
                );


              if (!route) {

                showToast(
                  "Route not found."
                );

                return;
              }


              showConfirm(

                `Delete route <strong>${
                  escLocal(
                    routeFrom(route)
                  )
                } → ${
                  escLocal(
                    routeTo(route)
                  )
                }</strong> and its departures?`,

                async () => {

                  try {

                    await BusPalAPI
                      .deleteRoute(
                        routeId
                      );

                    showToast(
                      "Route deleted."
                    );

                    await loadRoutes(
                      selectedDate
                    );

                  } catch (error) {

                    console.error(
                      "Delete route failed:",
                      error
                    );

                    showToast(
                      error?.message ||
                      "Unable to delete route."
                    );
                  }
                }
              );
            }
          );
        }
      );


      /*
       * Bus / driver / conductor assignment.
       */

      queryAll(
        "[data-assign]",
        root
      ).forEach(
        select => {

          select.addEventListener(
            "change",
            async () => {

              const routeId =
                Number(
                  select.dataset
                    .route
                );

              const depId =
                Number(
                  select.dataset
                    .dep
                );

              const type =
                select.dataset
                  .assign;


              const field =
                type === "bus"
                  ? "busId"
                  : type === "driver"
                    ? "driverId"
                    : "conductorId";


              const oldValue =
                select.dataset
                  .previousValue ??
                "";


              select.disabled =
                true;


              try {

                await BusPalAPI.updateDeparture(depId,
                {
                 [field]:
                 select.value === ""
                 ? null
                 : Number(select.value)
                }
              );

                select.dataset
                  .previousValue =
                  select.value;


                showToast(
                  "Assignment saved."
                );

              } catch (error) {

                console.error(
                  "Departure assignment failed:",
                  error
                );

                select.value =
                  oldValue;

                showToast(
                  error?.message ||
                  "Unable to save assignment."
                );

              } finally {

                select.disabled =
                  false;
              }
            }
          );


          select.dataset
            .previousValue =
            select.value;
        }
      );


      /*
       * Tracking.
       */

      queryAll(
        "[data-quick-track]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const [
                routeId,
                depId
              ] =
                button.dataset
                  .quickTrack
                  .split(":");


              window.__pendingTrackTrip =
                {
                  routeId,
                  depId
                };


              if (
                typeof go ===
                "function"
              ) {
                go("tracking");
              }
            }
          );
        }
      );


      /*
       * Delete departure.
       */

      queryAll(
        "[data-del-dep]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const [
                routeId,
                depId
              ] =
                button.dataset
                  .delDep
                  .split(":");


              showConfirm(

                "Remove this departure from the selected date?",

                async () => {

                  try {

                    await BusPalAPI
                      .deleteDeparture(
                        routeId,
                        depId
                      );

                    showToast(
                      "Departure removed."
                    );

                    await loadRoutes(
                      selectedDate
                    );

                  } catch (error) {

                    console.error(
                      "Delete departure failed:",
                      error
                    );

                    showToast(
                      error?.message ||
                      "Unable to remove departure."
                    );
                  }
                }
              );
            }
          );
        }
      );


      /*
       * Add departure.
       */

      queryAll(
        "[data-add-dep]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              let time =
                window.prompt(
                  "Departure time (HH:MM)",
                  "07:00"
                );


              if (!time) {
                return;
              }


              time =
                time
                  .trim()
                  .replace(
                    ".",
                    ":"
                  );


              if (
                !/^([01]\d|2[0-3]):([0-5]\d)$/
                  .test(time)
              ) {

                showToast(
                  "Enter the time as HH:MM, for example 10:00."
                );

                return;
              }


              try {

                 await BusPalAPI.addDeparture({
                       routeId: Number(button.dataset.addDep),
                      time,
                     departureDate: selectedDate});


                showToast(
                  `Departure ${time} added for ${selectedDate}.`
                );


                await loadRoutes(
                  selectedDate
                );

              } catch (error) {

                console.error(
                  "Add departure failed:",
                  error
                );

                showToast(
                  error?.message ||
                  "Unable to add departure."
                );
              }
            }
          );
        }
      );
    }


    /*
     |--------------------------------------------------------------------------
     | PAGE CONTROLS
     |--------------------------------------------------------------------------
     */

    function bindPageControls() {

      const search =
        query(
          "#routeSearch",
          root
        );

      const dateSelect =
        query(
          "#routeDate",
          root
        );

      const customDate =
        query(
          "#customRouteDate",
          root
        );

      const addRouteButton =
        query(
          "#addRouteBtn",
          root
        );

      const reportButton =
        query(
          "#downloadRouteReportBtn",
          root
        );


      /*
       * Search.
       */

      if (search) {

        search.addEventListener(
          "input",
          drawRoutes
        );
      }


      /*
       * Date selector.
       */

      if (dateSelect) {

        dateSelect.addEventListener(
          "change",
          async event => {

            const value =
              event.target.value;


            /*
             * Yesterday.
             */

            if (
              value ===
              "yesterday"
            ) {

              if (customDate) {
                customDate.style.display =
                  "none";
              }


              try {

                await loadRoutes(
                  addDays(
                    todaySriLanka(),
                    -1
                  )
                );

              } catch (error) {

                handleLoadError(
                  error
                );
              }

              return;
            }


            /*
             * Today.
             */

            if (
              value ===
              "today"
            ) {

              if (customDate) {
                customDate.style.display =
                  "none";
              }


              try {

                await loadRoutes(
                  todaySriLanka()
                );

              } catch (error) {

                handleLoadError(
                  error
                );
              }

              return;
            }


            /*
             * Tomorrow.
             */

            if (
              value ===
              "tomorrow"
            ) {

              if (customDate) {
                customDate.style.display =
                  "none";
              }


              try {

                await loadRoutes(
                  addDays(
                    todaySriLanka(),
                    1
                  )
                );

              } catch (error) {

                handleLoadError(
                  error
                );
              }

              return;
            }


            /*
             * Custom date.
             */

            if (value === "custom") {

              if (customDate) {

                customDate.style.display =
                  "";


                /*
                 * Keep current selected
                 * date when switching
                 * to custom.
                 */

                if (!customDate.value) {

                  customDate.value =
                    selectedDate;
                }
              }
            }

          }
        );
      }


      /*
       * Custom date picker.
       */

      if (customDate) {

        customDate.addEventListener(
          "change",
          async event => {

            const date =
              event.target.value;


            if (!date) {
              return;
            }


            try {

              await loadRoutes(
                date
              );

            } catch (error) {

              handleLoadError(
                error
              );
            }
          }
        );
      }


      /*
       * Add route.
       */

      if (addRouteButton) {

        addRouteButton.addEventListener(
          "click",
          () =>
            openRouteForm()
        );
      }


      /*
       * Existing report button.
       *
       * We are NOT building the
       * monthly report here.
       *
       * This keeps your existing
       * report integration untouched.
       */

      if (reportButton) {

        reportButton.addEventListener(
          "click",
          () => {

            if (
              typeof window
                .downloadRouteReport ===
              "function"
            ) {

              window.downloadRouteReport(
                routes,
                selectedDate
              );

            } else {

              showToast(
                "Route report download is not available yet."
              );
            }
          }
        );
      }
    }


    /*
     |--------------------------------------------------------------------------
     | LOAD ERROR
     |--------------------------------------------------------------------------
     */

    function handleLoadError(error) {

      console.error(
        "Routes loading failed:",
        error
      );


      showToast(
        error?.message ||
        "Unable to load routes."
      );


      root.innerHTML = `

        <div class="empty">

          <div class="ico">
            ⚠
          </div>

          Unable to load routes.

          <br>

          <small>
            ${escLocal(
              error?.message ||
              "Unknown error"
            )}
          </small>


          <div
            style="margin-top:12px"
          >

            <button
              class="btn"
              id="retryRoutesBtn"
            >
              Retry
            </button>

          </div>

        </div>

      `;


      const retry =
        query(
          "#retryRoutesBtn",
          root
        );


      if (retry) {

        retry.addEventListener(
          "click",
          async () => {

            try {

              await loadRoutes(
                selectedDate
              );

            } catch (retryError) {

              handleLoadError(
                retryError
              );
            }
          }
        );
      }
    }


    /*
     |--------------------------------------------------------------------------
     | INITIAL LOAD
     |--------------------------------------------------------------------------
     */

    try {

      await loadRoutes(
        selectedDate
      );

    } catch (error) {

      handleLoadError(
        error
      );
    }

  }


  /*
  |--------------------------------------------------------------------------
  | ROUTE FORM
  |--------------------------------------------------------------------------
  */

  function openRouteForm(
    route = null
  ) {

    const isEdit =
      Boolean(route);


    if (
      typeof openForm !==
      "function"
    ) {

      showToast(
        "Route form is unavailable because core.js is not loaded."
      );

      return;
    }


    const body =
      openForm(

        isEdit
          ? "Edit route"
          : "Add route",

        `

          <form
            id="routeForm"
            class="form-grid"
          >

            <div class="row-2">

              <div class="field-v">

                <label
                  for="rfFrom"
                >
                  From
                </label>

                <input
                  type="text"
                  id="rfFrom"
                  value="${escLocal(
                    routeFrom(route)
                  )}"
                  placeholder="e.g. Colombo"
                  required
                />

              </div>


              <div class="field-v">

                <label
                  for="rfTo"
                >
                  To
                </label>

                <input
                  type="text"
                  id="rfTo"
                  value="${escLocal(
                    routeTo(route)
                  )}"
                  placeholder="e.g. Kandy"
                  required
                />

              </div>

            </div>


            <div class="row-2">

              <div class="field-v">

                <label
                  for="rfDist"
                >
                  Distance (km)
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  id="rfDist"
                  value="${escLocal(
                    route?.distanceKm ??
                    ""
                  )}"
                />

              </div>


              <div class="field-v">

                <label
                  for="rfFare"
                >
                  Fare (LKR)
                </label>

                <input
                  type="number"
                  min="0"
                  step="1"
                  id="rfFare"
                  value="${escLocal(
                    route?.fare ??
                    ""
                  )}"
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
                  : "Add route"
              }
            </button>

          </form>

        `
      );


    const form =
      query(
        "#routeForm",
        body
      );


    if (!form) {
      return;
    }


    form.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const from =
          query(
            "#rfFrom",
            body
          )?.value.trim() ||
          "";


        const to =
          query(
            "#rfTo",
            body
          )?.value.trim() ||
          "";


        const distanceKm =
          safeNumber(
            query(
              "#rfDist",
              body
            )?.value
          );


        const fare =
          safeNumber(
            query(
              "#rfFare",
              body
            )?.value
          );


        if (
          !from ||
          !to
        ) {

          showToast(
            "From and To are required."
          );

          return;
        }


        const submit =
          form.querySelector(
            "button[type='submit']"
          );


        if (submit) {

          submit.disabled =
            true;

          submit.textContent =
            isEdit
              ? "Saving…"
              : "Adding…";
        }


        try {

          if (isEdit) {

            await BusPalAPI
              .updateRoute(
                Number(route.id),
                {
                  from,
                  to,
                  distanceKm,
                  fare,
                }
              );

          } else {

            await BusPalAPI
              .createRoute(
                {
                  from,
                  to,
                  distanceKm,
                  fare,
                  visible: true,
                }
              );
          }


          if (
            typeof closeModal ===
            "function"
          ) {

            closeModal(
              "formModal"
            );
          }


          showToast(
            isEdit
              ? "Route updated."
              : "Route added."
          );


          if (
            typeof go ===
            "function"
          ) {

            go(
              PAGE_KEY
            );
          }

        } catch (error) {

          console.error(
            "Route save failed:",
            error
          );


          showToast(
            error?.message ||
            "Unable to save route."
          );


          if (submit) {

            submit.disabled =
              false;

            submit.textContent =
              isEdit
                ? "Save changes"
                : "Add route";
          }
        }
      }
    );
  }


  /*
  |--------------------------------------------------------------------------
  | ROUTES MAP
  |--------------------------------------------------------------------------
  */

  ROUTES_MAP.routes = {

    title:
      "Routes & Schedules",

    sub:
      "Manage routes, departures, and crew assignments.",

    render:
      renderRoutes,

  };

})();