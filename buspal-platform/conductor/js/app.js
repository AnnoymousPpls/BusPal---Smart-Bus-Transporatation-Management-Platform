/* ============================================================
   BusPal — Conductor Portal
   Real PHP + MySQL backend
   No BusPalStore / mock data
   ============================================================ */

(() => {

  const API_BASE =
    "http://localhost/buspal-backend-php/api";


  /* ==========================================================
     HELPERS
     ========================================================== */

  const $ = (sel, scope = document) =>
    scope.querySelector(sel);

  const $$ = (sel, scope = document) =>
    [...scope.querySelectorAll(sel)];

  const esc = (s) =>
    (s ?? "")
      .toString()
      .replace(
        /[&<>"']/g,
        c => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
      );


  /* ==========================================================
     API REQUEST
     ========================================================== */

  async function apiRequest(endpoint, options = {}) {

    let response;

    try {

      response = await fetch(
        `${API_BASE}${endpoint}`,
        {
          method:
            options.method || "GET",

          headers: {
            "Content-Type":
              "application/json",

            ...(options.headers || {})
          },

          body:
            options.body
        }
      );

    } catch (error) {

      console.error(
        "Conductor API connection error:",
        error
      );

      throw new Error(
        "Unable to connect to the BusPal server. Make sure WAMP and Apache are running."
      );
    }


    let body;

    try {

      body =
        await response.json();

    } catch (error) {

      console.error(
        "Invalid server response:",
        error
      );

      throw new Error(
        `Server returned an invalid response. HTTP ${response.status}.`
      );
    }


    if (
      !response.ok ||
      body?.success === false
    ) {

      throw new Error(
        body?.message ||
        body?.error ||
        `Request failed with status ${response.status}.`
      );
    }


    return body?.data ?? body;
  }


  /* ==========================================================
     GET TRIP BY ACCESS CODE
     ========================================================== */

  async function getTripByCode(code) {

    const cleanCode =
      String(code || "")
        .trim()
        .toUpperCase();


    return apiRequest(
      `/conductor/index.php?code=${encodeURIComponent(cleanCode)}`
    );
  }


  /* ==========================================================
     COUNTER BOOKING
     ========================================================== */

  async function createCounterBooking(payload) {

    return apiRequest(
      "/conductor/index.php?action=book",
      {
        method: "POST",

        body:
          JSON.stringify(payload)
      }
    );
  }


  /* ==========================================================
     THEME
     ========================================================== */

  $("#themeToggle")?.addEventListener(
    "click",
    () => {

      const current =
        document.documentElement.getAttribute(
          "data-theme"
        ) === "light"
          ? "light"
          : "dark";


      const next =
        current === "light"
          ? "dark"
          : "light";


      document.documentElement.setAttribute(
        "data-theme",
        next
      );


      localStorage.setItem(
        "buspal-theme",
        next
      );
    }
  );


  /* ==========================================================
     TOAST
     ========================================================== */

  function toast(
    message,
    duration = 2600
  ) {

    const element =
      $("#toast");

    if (!element) {
      return;
    }


    element.textContent =
      message;

    element.hidden =
      false;


    clearTimeout(
      toast._timer
    );


    toast._timer =
      setTimeout(
        () => {
          element.hidden =
            true;
        },
        duration
      );
  }


  /* ==========================================================
     MODAL
     ========================================================== */

  function openModal(id) {

    const modal =
      document.getElementById(id);

    if (!modal) {
      return;
    }


    if (
      !modal.querySelector(
        ".modal-backdrop"
      )
    ) {

      const backdrop =
        document.createElement(
          "div"
        );

      backdrop.className =
        "modal-backdrop";


      backdrop.addEventListener(
        "click",
        () => closeModal(id)
      );


      modal.prepend(
        backdrop
      );
    }


    modal.classList.add(
      "open"
    );


    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }


  function closeModal(id) {

    const modal =
      document.getElementById(id);

    if (!modal) {
      return;
    }


    modal.classList.remove(
      "open"
    );


    modal.setAttribute(
      "aria-hidden",
      "true"
    );
  }


  $("#formModalClose")?.addEventListener(
    "click",
    () =>
      closeModal(
        "formModal"
      )
  );


  function openForm(
    title,
    bodyHTML
  ) {

    $("#formModalTitle")
      .textContent =
      title;


    $("#formModalBody")
      .innerHTML =
      bodyHTML;


    openModal(
      "formModal"
    );


    return $(
      "#formModalBody"
    );
  }


  /* ==========================================================
     CURRENT TRIP
     ========================================================== */

  let currentTrip =
    null;

  let currentAccessCode =
    "";


  /* ==========================================================
     OPEN TRIP
     ========================================================== */

  async function openTrip(
    code
  ) {

    const cleanCode =
      String(code || "")
        .trim()
        .toUpperCase();


    if (!cleanCode) {

      $("#codeError")
        .textContent =
        "Enter the trip access code.";

      return;
    }


    $("#codeError")
      .textContent =
      "Checking code…";


    try {

      const trip =
        await getTripByCode(
          cleanCode
        );


      if (
        !trip ||
        !trip.from ||
        !trip.to
      ) {

        throw new Error(
          "The server returned an invalid trip."
        );
      }


      currentAccessCode =
        cleanCode;


      currentTrip =
        trip;


      $("#codeError")
        .textContent =
        "";


      $("#gate")
        .hidden =
        true;


      $("#tripView")
        .hidden =
        false;


      await renderTrip();

    } catch (error) {

      console.error(
        "Trip access error:",
        error
      );


      currentTrip =
        null;

      currentAccessCode =
        "";


      $("#tripView")
        .hidden =
        true;


      $("#gate")
        .hidden =
        false;


      $("#codeError")
        .textContent =
        error.message ||
        "That code isn't valid — check with your Owner/Manager.";
    }
  }


  /* ==========================================================
     CODE FORM
     ========================================================== */

  $("#codeForm")
    .addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const code =
          $("#codeInput")
            .value
            .trim()
            .toUpperCase();


        await openTrip(
          code
        );
      }
    );


  $("#codeInput")
    .addEventListener(
      "input",
      event => {

        event.target.value =
          event.target.value
            .toUpperCase()
            .replace(
              /[^A-Z0-9]/g,
              ""
            )
            .slice(0, 6);
      }
    );


  /* ==========================================================
     RENDER TRIP
     ========================================================== */

  async function renderTrip() {

    const trip =
      currentTrip;


    $("#tripView")
      .innerHTML = `

        <div class="card card-pad">

          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              flex-wrap:wrap;
              gap:10px
            "
          >

            <div>

              <div class="route-title">
                ${esc(trip.from)}
                <span class="hc-arrow">
                  →
                </span>
                ${esc(trip.to)}
              </div>


              <div class="route-meta">
                ${esc(trip.date)}
                ·
                ${esc(trip.depTime)}
                ·
                ${esc(
                  trip.busLabel ||
                  "Bus TBA"
                )}
              </div>


              <div
                class="muted small"
                style="margin-top:4px"
              >
                ${
                  trip.driverName ||
                  trip.conductorName
                    ? `
                      Driver:
                      ${esc(
                        trip.driverName ||
                        "—"
                      )}

                      ·

                      Conductor:
                      ${esc(
                        trip.conductorName ||
                        "—"
                      )}
                    `
                    : ""
                }
              </div>

            </div>


            <button
              class="btn ghost sm"
              id="switchTripBtn"
              type="button"
            >
              Different trip
            </button>

          </div>

        </div>


        <div id="tripData">

          <div class="empty">

            <div class="ico">
              ▦
            </div>

            Loading trip…

          </div>

        </div>
      `;


    $("#switchTripBtn")
      .addEventListener(
        "click",
        () => {

          currentTrip =
            null;

          currentAccessCode =
            "";


          $("#tripView")
            .hidden =
            true;


          $("#gate")
            .hidden =
            false;


          $("#codeInput")
            .value =
            "";


          $("#codeError")
            .textContent =
            "";


          $("#codeInput")
            .focus();
        }
      );


    await drawTrip();
  }


  /* ==========================================================
     LOAD CURRENT TRIP + MANIFEST
     ========================================================== */

  async function drawTrip() {

    if (
      !currentTrip ||
      !currentAccessCode
    ) {
      return;
    }


    try {

      /*
       * Always ask PHP for the latest manifest.
       * This means conductor sees new bookings
       * without using local/mock data.
       */

      const latestTrip =
        await getTripByCode(
          currentAccessCode
        );


      currentTrip =
        latestTrip;


      const capacity =
        Number(
          latestTrip.capacity ||
          40
        );


      const manifest =
        Array.isArray(
          latestTrip.manifest
        )
          ? latestTrip.manifest
          : [];


      const takenSeats =
        manifest.flatMap(
          booking =>
            Array.isArray(
              booking.seats
            )
              ? booking.seats
                  .map(String)
              : []
        );


      $("#tripData")
        .innerHTML = `

          <div class="grid-2">

            <div class="card card-pad">

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  align-items:center;
                  margin-bottom:6px
                "
              >

                <h3>
                  Seat chart
                </h3>


                <span
                  class="badge info"
                  id="cBadge"
                >
                  ${
                    takenSeats.length
                  }/${capacity}
                  booked
                </span>

              </div>


              <div class="seat-legend">

                <span>

                  <span
                    class="legend-chip"
                    style="
                      background:
                        var(--wa-08)
                    "
                  ></span>

                  Available

                </span>


                <span>

                  <span
                    class="legend-chip"
                    style="
                      background:
                        var(--danger)
                    "
                  ></span>

                  Booked

                </span>

              </div>


              <div
                class="seat-map"
                id="cSeatMap"
              ></div>

            </div>


            <div class="card card-pad">

              <h3
                style="margin-bottom:10px"
              >
                Manifest
              </h3>


              <div
                id="cManifest"
                style="
                  display:flex;
                  flex-direction:column;
                  gap:8px
                "
              ></div>

            </div>

          </div>
        `;


      /* ========================================================
         SEAT MAP
         ======================================================== */

      const seatRows =
        SeatLayout.generate(
          capacity
        );


      const seatsHTML =
        seatRows
          .map(
            row => {

              const seatDivs =
                row.seats
                  .map(
                    (number, index) => {

                      const seat =
                        String(number);


                      const isTaken =
                        takenSeats.includes(
                          seat
                        );


                      const aisle =
                        (
                          row.type ===
                            "pair" &&
                          index === 1
                        )
                          ? `
                            <div
                              class="aisle"
                            ></div>
                          `
                          : "";


                      return `
                        <div
                          class="
                            seat
                            ${
                              isTaken
                                ? "taken"
                                : "free"
                            }
                          "
                          data-seat="${seat}"
                        >
                          ${seat}
                        </div>

                        ${aisle}
                      `;
                    }
                  )
                  .join("");


              return `
                <div
                  class="
                    seat-row
                    seat-row-${row.type}
                  "
                >
                  ${seatDivs}
                </div>
              `;
            }
          )
          .join("");


      $("#cSeatMap")
        .innerHTML =
        seatsHTML;


      /* ========================================================
         BOOKED SEATS
         ======================================================== */

      $$(".seat.taken", $("#cSeatMap"))
        .forEach(
          element => {

            element.addEventListener(
              "click",
              () => {

                const booking =
                  manifest.find(
                    item =>
                      Array.isArray(
                        item.seats
                      ) &&
                      item.seats
                        .map(String)
                        .includes(
                          element.dataset.seat
                        )
                  );


                if (booking) {

                  openSeatDetail(
                    element.dataset.seat,
                    booking
                  );

                }
              }
            );
          }
        );


      /* ========================================================
         FREE SEATS
         ======================================================== */

      $$(".seat.free", $("#cSeatMap"))
        .forEach(
          element => {

            element.addEventListener(
              "click",
              () =>
                openCounterBooking(
                  element.dataset.seat
                )
            );
          }
        );


      /* ========================================================
         MANIFEST
         ======================================================== */

      $("#cManifest")
        .innerHTML =
        manifest.length

          ? manifest
              .map(
                booking => `
                  <div
                    class="dep-row"
                    style="
                      grid-template-columns:
                      auto 1fr auto
                    "
                  >

                    <div class="dep-time">
                      ${booking.seats.join(",")}
                    </div>


                    <div>

                      <div
                        class="cell-strong"
                      >
                        ${esc(
                          booking.passengerName
                        )}
                      </div>


                      <div
                        class="cell-sub"
                      >
                        ${esc(
                          booking.pickupPoint ||
                          "—"
                        )}
                        ·
                        ${
                          booking.source ===
                          "counter"
                            ? "counter booking"
                            : "self-booked"
                        }
                      </div>

                    </div>


                    <a
                      class="btn sm"
                      href="tel:${esc(
                        booking.phone ||
                        ""
                      )}"
                    >
                      📞
                      ${esc(
                        booking.phone ||
                        "—"
                      )}
                    </a>

                  </div>
                `
              )
              .join("")

          : `
              <div class="empty">

                <div class="ico">
                  ◇
                </div>

                No seats booked for this trip yet.

              </div>
            `;

    } catch (error) {

      console.error(
        "Trip data loading error:",
        error
      );


      $("#tripData")
        .innerHTML = `
          <div class="empty">

            <div class="ico">
              ⚠
            </div>

            ${esc(
              error.message ||
              "Unable to load trip data."
            )}

          </div>
        `;
    }
  }


  /* ==========================================================
     SEAT DETAILS
     ========================================================== */

  function openSeatDetail(
    seat,
    booking
  ) {

    if (!booking) {
      return;
    }


    openForm(
      `Seat ${seat}`,

      `
        <div class="form-grid">

          <div class="field-v">

            <label>
              Passenger
            </label>

            <div
              class="cell-strong"
              style="font-size:16px"
            >
              ${esc(
                booking.passengerName
              )}
            </div>

          </div>


          <div class="row-2">

            <div class="field-v">

              <label>
                Phone
              </label>

              <div>

                <a
                  class="btn block"
                  href="tel:${esc(
                    booking.phone ||
                    ""
                  )}"
                >
                  📞
                  ${esc(
                    booking.phone ||
                    "—"
                  )}
                </a>

              </div>

            </div>


            <div class="field-v">

              <label>
                Pickup point
              </label>

              <div
                class="cell-strong"
              >
                ${esc(
                  booking.pickupPoint ||
                  "—"
                )}
              </div>

            </div>

          </div>


          <div class="field-v">

            <label>
              Booking ref
            </label>

            <div class="cell-mono">

              ${esc(
                booking.pnr ||
                "—"
              )}

              ·

              ${
                booking.source ===
                "counter"
                  ? "counter booking"
                  : "self-booked"
              }

            </div>

          </div>

        </div>
      `
    );
  }


  /* ==========================================================
     COUNTER BOOKING
     ========================================================== */

  function openCounterBooking(
    seat
  ) {

    const trip =
      currentTrip;


    const body =
      openForm(
        `Book seat ${seat} at the counter`,

        `
          <form
            id="counterForm"
            class="form-grid"
          >

            <div class="field-v">

              <label for="cbName">
                Passenger name
              </label>

              <input
                type="text"
                id="cbName"
                required
              />

            </div>


            <div class="row-2">

              <div class="field-v">

                <label for="cbPhone">
                  Phone
                </label>

                <input
                  type="tel"
                  id="cbPhone"
                  placeholder="07X XXX XXXX"
                  required
                />

              </div>


              <div class="field-v">

                <label for="cbPickup">
                  Pickup point
                </label>

                <input
                  type="text"
                  id="cbPickup"
                  value="${esc(
                    trip.from
                  )}"
                />

              </div>

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              Confirm booking — seat ${seat}
            </button>

          </form>
        `
      );


    Validate.attachPhoneMask(
      $("#cbPhone", body)
    );


    $("#cbPhone", body)
      .addEventListener(
        "blur",
        () => {

          const value =
            $("#cbPhone", body)
              .value
              .trim();


          Validate.setFieldError(
            $("#cbPhone", body),

            value &&
            !Validate.isValidPhone(
              value
            )

              ? "Enter a valid mobile number"

              : ""
          );
        }
      );


    $("#counterForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const passengerName =
            $("#cbName", body)
              .value
              .trim();


          const phone =
            $("#cbPhone", body)
              .value
              .trim();


          const pickupPoint =
            $("#cbPickup", body)
              .value
              .trim() ||
            trip.from;


          if (!passengerName) {

            toast(
              "Passenger name is required."
            );

            return;
          }


          if (
            !Validate.isValidPhone(
              phone
            )
          ) {

            Validate.setFieldError(
              $("#cbPhone", body),

              "Enter a valid mobile number, e.g. 077 123 4567"
            );


            toast(
              "Please fix the highlighted field."
            );


            return;
          }


          try {

            await createCounterBooking({

              code:
                currentAccessCode,

              seats: [
                String(seat)
              ],

              passengerName,

              phone,

              pickupPoint
            });


            closeModal(
              "formModal"
            );


            toast(
              `Seat ${seat} booked at the counter.`
            );


            /*
             * Reload the manifest from PHP.
             * The booked seat will immediately
             * become unavailable.
             */

            await drawTrip();

          } catch (error) {

            console.error(
              "Counter booking error:",
              error
            );


            toast(
              error.message ||
              "Unable to complete booking."
            );
          }
        }
      );
  }


  /* ==========================================================
     AUTO OPEN FROM ?code=
     ========================================================== */

  $("#codeInput")
    .focus();


  const urlCode =
    new URLSearchParams(
      window.location.search
    ).get("code");


  if (urlCode) {

    const cleanCode =
      urlCode
        .trim()
        .toUpperCase();


    $("#codeInput")
      .value =
      cleanCode;


    openTrip(
      cleanCode
    );
  }

})();