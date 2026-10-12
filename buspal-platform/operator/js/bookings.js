/* BusPal — Operator Dashboard — Bookings */

(() => {

  /* ==========================================================
     DATE HELPERS
     ========================================================== */

  function getTodayLocalDate() {

    const now = new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        now.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  function normaliseBookingDate(value) {

    if (!value) {
      return "";
    }

    const text =
      String(value).trim();


    /*
     * Already in YYYY-MM-DD format.
     */

    const isoMatch =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );


    if (isoMatch) {

      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    }


    /*
     * Support DD/MM/YYYY.
     */

    const slashMatch =
      text.match(
        /^(\d{2})\/(\d{2})\/(\d{4})$/
      );


    if (slashMatch) {

      return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;

    }


    /*
     * Support DD-MM-YYYY.
     */

    const dashMatch =
      text.match(
        /^(\d{2})-(\d{2})-(\d{4})$/
      );


    if (dashMatch) {

      return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;

    }


    return "";

  }


  /* ==========================================================
     BOOKING STATUS
     ========================================================== */

  function getEffectiveBookingStatus(booking) {

    /*
     * Never change a booking that has explicitly been cancelled.
     */

    if (
      booking.status ===
      "cancelled"
    ) {

      return "cancelled";

    }


    /*
     * Never change an explicitly completed booking.
     */

    if (
      booking.status ===
      "completed"
    ) {

      return "completed";

    }


    const bookingDate =
      normaliseBookingDate(
        booking.date
      );


    /*
     * If there is no usable date,
     * preserve the server status.
     */

    if (!bookingDate) {

      return booking.status;

    }


    const today =
      getTodayLocalDate();


    /*
     * Any booking whose travel date has passed
     * is automatically treated as completed.
     */

    if (
      bookingDate <
      today
    ) {

      return "completed";

    }


    /*
     * Today and future dates remain upcoming.
     */

    return "upcoming";

  }


  /*
   * Add an effectiveStatus property without modifying
   * the original API response.
   */

  function prepareBookings(bookings) {

    return bookings.map(
      booking => ({

        ...booking,

        effectiveStatus:
          getEffectiveBookingStatus(
            booking
          )

      })
    );

  }


  /* ==========================================================
     RENDER BOOKINGS
     ========================================================== */

  async function renderBookings(root) {

    root.innerHTML = `

      <div class="empty">

        <div class="ico">
          ▤
        </div>

        Loading bookings…

      </div>

    `;


    let bookings;


    try {

      bookings =
        await BusPalAPI.getAllBookings();

    } catch (error) {

      console.error(
        "Bookings loading error:",
        error
      );


      root.innerHTML =
        emptyHTML(
          error.message ||
          "Unable to load bookings."
        );


      return;

    }


    /*
     * Calculate the status that should actually
     * be displayed.
     */

    bookings =
      prepareBookings(
        Array.isArray(
          bookings
        )
          ? bookings
          : []
      );


    /* ========================================================
       STATISTICS
       ======================================================== */

    const upcoming =
      bookings.filter(
        booking =>
          booking.effectiveStatus ===
          "upcoming"
      ).length;


    const completed =
      bookings.filter(
        booking =>
          booking.effectiveStatus ===
          "completed"
      ).length;


    const cancelled =
      bookings.filter(
        booking =>
          booking.effectiveStatus ===
          "cancelled"
      ).length;


    /* ========================================================
       PAGE
       ======================================================== */

    root.innerHTML = `

      <div class="grid-4">


        <!-- TOTAL BOOKINGS -->

        <div class="stat-card">

          <div class="k">

            ${bookings.length}

          </div>


          <div class="l">

            Total bookings

          </div>

        </div>


        <!-- UPCOMING -->

        <div class="stat-card">

          <div
            class="k"
            style="color:var(--brand)"
          >

            ${upcoming}

          </div>


          <div class="l">

            Upcoming

          </div>

        </div>


        <!-- COMPLETED -->

        <div class="stat-card">

          <div
            class="k"
            style="color:var(--brand-2)"
          >

            ${completed}

          </div>


          <div class="l">

            Completed

          </div>

        </div>


        <!-- CANCELLED -->

        <div class="stat-card">

          <div
            class="k"
            style="color:var(--muted)"
          >

            ${cancelled}

          </div>


          <div class="l">

            Cancelled

          </div>

        </div>


      </div>


      <!-- ====================================================
           TOOLBAR
           ==================================================== -->

      <div
        class="section-toolbar bookings-toolbar"
      >

        <div class="filters">


          <!-- SEARCH -->

          <input
            class="filter-input"
            id="bkSearch"
            placeholder="Search passenger, phone, or route…"
          />


          <!-- STATUS FILTER -->

          <select
            class="filter-input"
            id="bkStatusFilter"
          >

            <option value="">
              All statuses
            </option>


            <option value="upcoming">
              Upcoming
            </option>


            <option value="completed">
              Completed
            </option>


            <option value="cancelled">
              Cancelled
            </option>

          </select>


          <!-- SOURCE FILTER -->

          <select
            class="filter-input"
            id="bkSourceFilter"
          >

            <option value="">
              Self + counter
            </option>


            <option value="self">
              Self-booked only
            </option>


            <option value="counter">
              Counter-booked only
            </option>

          </select>


        </div>


        <!-- ==================================================
             DOWNLOAD REPORT BUTTON
             ================================================== -->

        <button
          type="button"
          class="btn bookings-report-btn"
          id="downloadBookingsReport"
          title="Download bookings report"
        >

          ↓ Download Report

        </button>


      </div>


      <!-- ====================================================
           BOOKINGS HISTORY TABLE
           ==================================================== -->

      <div id="bkTableWrap"></div>

    `;


    /* ==========================================================
       TOOLBAR CSS
       ========================================================== */

    if (
      !document.getElementById(
        "buspalBookingsToolbarStyle"
      )
    ) {

      const style =
        document.createElement(
          "style"
        );


      style.id =
        "buspalBookingsToolbarStyle";


      style.textContent = `

        .bookings-toolbar {

          display: flex;

          justify-content: space-between;

          align-items: center;

          gap: 16px;

          width: 100%;

        }


        .bookings-toolbar .filters {

          display: flex;

          align-items: center;

          gap: 10px;

          flex: 1;

        }


        .bookings-report-btn {

          flex-shrink: 0;

          white-space: nowrap;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          gap: 6px;

        }


        @media (max-width: 900px) {

          .bookings-toolbar {

            flex-direction: column;

            align-items: stretch;

          }


          .bookings-toolbar .filters {

            flex-direction: column;

            align-items: stretch;

            width: 100%;

          }


          .bookings-report-btn {

            width: 100%;

          }

        }

      `;


      document.head.appendChild(
        style
      );

    }


    /* ==========================================================
       DRAW BOOKINGS HISTORY TABLE
       ========================================================== */

    function draw() {

      const q =
        $("#bkSearch", root)
          .value
          .trim()
          .toLowerCase();


      const status =
        $("#bkStatusFilter", root)
          .value;


      const source =
        $("#bkSourceFilter", root)
          .value;


      const rows =
        bookings.filter(
          booking => {

            const passenger =
              String(
                booking.passengerName ||
                ""
              ).toLowerCase();


            const phone =
              String(
                booking.phone ||
                ""
              ).toLowerCase();


            const from =
              String(
                booking.from ||
                ""
              ).toLowerCase();


            const to =
              String(
                booking.to ||
                ""
              ).toLowerCase();


            const bookingSource =
              String(
                booking.source ||
                "self"
              ).toLowerCase();


            return (

              (
                !q ||
                passenger.includes(q) ||
                phone.includes(q) ||
                from.includes(q) ||
                to.includes(q)
              )

              &&

              (
                !status ||
                booking.effectiveStatus ===
                status
              )

              &&

              (
                !source ||
                bookingSource ===
                source
              )

            );

          }
        );


      /* ========================================================
         TABLE HTML
         ======================================================== */

      $("#bkTableWrap", root)
        .innerHTML =

        rows.length

          ? `

            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>

                    <th>
                      Passenger
                    </th>

                    <th>
                      Route
                    </th>

                    <th>
                      Date &amp; time
                    </th>

                    <th>
                      Seats
                    </th>

                    <th>
                      Fare
                    </th>

                    <th>
                      Status
                    </th>

                    <th>
                      Source
                    </th>

                    <th></th>

                  </tr>

                </thead>


                <tbody>

                  ${rows
                    .map(
                      booking => `

                    <tr>


                      <!-- PASSENGER -->

                      <td>

                        <div class="cell-strong">

                          ${esc(
                            booking.passengerName
                          )}

                        </div>


                        <div class="cell-sub">

                          ${esc(
                            booking.phone ||
                            "—"
                          )}

                        </div>

                      </td>


                      <!-- ROUTE -->

                      <td>

                        ${esc(
                          booking.from
                        )}

                        →

                        ${esc(
                          booking.to
                        )}

                      </td>


                      <!-- DATE -->

                      <td class="cell-mono">

                        ${esc(
                          booking.date
                        )}


                        <div class="cell-sub">

                          ${esc(
                            booking.depTime
                          )}

                        </div>

                      </td>


                      <!-- SEATS -->

                      <td class="cell-mono">

                        ${
                          Array.isArray(
                            booking.seats
                          )

                            ? esc(
                                booking.seats.join(
                                  ", "
                                )
                              )

                            : "—"
                        }

                      </td>


                      <!-- FARE -->

                      <td class="cell-mono">

                        ${fmtLKR(
                          Number(
                            booking.price ||
                            0
                          ) *
                          (
                            Array.isArray(
                              booking.seats
                            )

                              ? booking.seats.length

                              : 0
                          )
                        )}

                      </td>


                      <!-- STATUS -->

                      <td>

                        <span
                          class="
                            pill
                            ${
                              booking.effectiveStatus ===
                              "upcoming"

                                ? "info"

                                : booking.effectiveStatus ===
                                  "completed"

                                  ? "active"

                                  : "hidden-pill"
                            }
                          "
                        >

                          ${esc(
                            booking.effectiveStatus
                          )}

                        </span>

                      </td>


                      <!-- SOURCE -->

                      <td>

                        <span
                          class="
                            badge
                            ${
                              String(
                                booking.source ||
                                "self"
                              ).toLowerCase() ===
                              "counter"

                                ? "warn"

                                : "off"
                            }
                          "
                        >

                          ${
                            String(
                              booking.source ||
                              "self"
                            ).toLowerCase() ===
                            "counter"

                              ? "counter"

                              : "self"
                          }

                        </span>

                      </td>


                      <!-- ACTIONS -->

                      <td class="td-actions">


                        <!-- CALL PASSENGER -->

                        ${
                          booking.phone

                            ? `

                              <a
                                class="btn sm"
                                href="tel:${esc(
                                  booking.phone
                                )}"
                                title="Call passenger"
                              >

                                📞

                              </a>

                            `

                            : ""
                        }


                        <!-- CANCEL BOOKING -->

                        ${
                          booking.effectiveStatus ===
                          "upcoming"

                            ? `

                              <button
                                type="button"
                                class="icon-btn"
                                title="Cancel booking"
                                data-cancel-bk="${Number(
                                  booking.id
                                )}"
                              >

                                ⊘

                              </button>

                            `

                            : ""
                        }


                        <!-- DELETE BOOKING -->

                        <button
                          type="button"
                          class="icon-btn danger"
                          title="Delete record"
                          data-del-bk="${Number(
                            booking.id
                          )}"
                        >

                          🗑

                        </button>


                      </td>


                    </tr>

                  `
                    )
                    .join("")}

                </tbody>

              </table>

            </div>

          `

          : emptyHTML(
              "No bookings match your search."
            );


      /* ========================================================
         CANCEL BOOKING
         ======================================================== */

      $$(
        "[data-cancel-bk]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const bookingId =
                Number(
                  button.dataset.cancelBk
                );


              const booking =
                rows.find(
                  item =>
                    Number(
                      item.id
                    ) ===
                    bookingId
                );


              if (!booking) {

                toast(
                  "Could not find this booking."
                );

                return;

              }


              /*
               * Extra safety check.
               */

              if (
                booking.effectiveStatus !==
                "upcoming"
              ) {

                toast(
                  "This booking can no longer be cancelled because its travel date has passed."
                );

                return;

              }


              confirmAction(

                `
                  Cancel
                  <strong>
                    ${esc(
                      booking.passengerName
                    )}
                  </strong>'s booking
                  (
                    ${esc(
                      booking.from
                    )}
                    →
                    ${esc(
                      booking.to
                    )},
                    seats
                    ${
                      Array.isArray(
                        booking.seats
                      )
                        ? esc(
                            booking.seats.join(
                              ", "
                            )
                          )
                        : "—"
                    }
                  )?

                  The seat${
                    Array.isArray(
                      booking.seats
                    ) &&
                    booking.seats.length > 1
                      ? "s"
                      : ""
                  }
                  will become available immediately.
                `,

                async () => {

                  try {

                    await BusPalAPI.cancelAnyBooking(
                      booking.id
                    );


                    toast(
                      "Booking cancelled — seat released."
                    );


                    go(
                      "bookings"
                    );


                  } catch (error) {

                    console.error(
                      "Cancel booking error:",
                      error
                    );


                    toast(
                      error.message ||
                      "Unable to cancel booking."
                    );

                  }

                }

              );

            }
          );

        }
      );


      /* ========================================================
         DELETE BOOKING
         ======================================================== */

      $$(
        "[data-del-bk]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const bookingId =
                Number(
                  button.dataset.delBk
                );


              const booking =
                rows.find(
                  item =>
                    Number(
                      item.id
                    ) ===
                    bookingId
                );


              if (!booking) {

                toast(
                  "Could not find this booking."
                );

                return;

              }


              confirmAction(

                `
                  Permanently delete this
                  booking record for
                  <strong>
                    ${esc(
                      booking.passengerName
                    )}
                  </strong>?

                  This removes the record
                  entirely, not just cancels it.
                `,

                async () => {

                  try {

                    await BusPalAPI.deleteBooking(
                      booking.id
                    );


                    toast(
                      "Booking deleted."
                    );


                    go(
                      "bookings"
                    );


                  } catch (error) {

                    console.error(
                      "Delete booking error:",
                      error
                    );


                    toast(
                      error.message ||
                      "Unable to delete booking."
                    );

                  }

                }

              );

            }
          );

        }
      );

    }


    /* ==========================================================
       FILTER EVENTS
       ========================================================== */

    $("#bkSearch", root)
      .addEventListener(
        "input",
        draw
      );


    $("#bkStatusFilter", root)
      .addEventListener(
        "change",
        draw
      );


    $("#bkSourceFilter", root)
      .addEventListener(
        "change",
        draw
      );


    /* ==========================================================
       DOWNLOAD REPORT EVENT
       ========================================================== */

    $("#downloadBookingsReport", root)
      .addEventListener(
        "click",
        () => {

          /*
           * bookings-report.js will provide
           * this function.
           */

          if (
            typeof downloadBookingsReport ===
            "function"
          ) {

            downloadBookingsReport(
              bookings
            );

          } else {

            toast(
              "Bookings report module is not loaded."
            );

            console.error(
              "downloadBookingsReport() is not available. Make sure bookings-report.js is loaded."
            );

          }

        }
      );


    /* ==========================================================
       INITIAL DRAW
       ========================================================== */

    draw();

  }


  /* ============================================================
     ROUTE REGISTRATION
     ============================================================ */

  ROUTES_MAP.bookings = {

    title:
      "Bookings",

    sub:
      "Every passenger reservation across the fleet.",

    render:
      renderBookings

  };


})();