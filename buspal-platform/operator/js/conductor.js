/* ============================================================
   BusPal — Operator Dashboard — Conductor View
   Real PHP + MySQL backend
   ============================================================ */

(() => {

  /* ----------------------------------------------------------
     Get today's date using the user's local timezone
     ---------------------------------------------------------- */

  function getTodayLocal() {
    const date = new Date();

    date.setMinutes(
      date.getMinutes() -
      date.getTimezoneOffset()
    );

    return date.toISOString().slice(0, 10);
  }


  /* ----------------------------------------------------------
     Render Conductor View
     ---------------------------------------------------------- */

  async function renderConductor(root) {

    root.innerHTML = `
      <div class="empty">
        <div class="ico">▦</div>
        Loading trips…
      </div>
    `;


    let trips;

    try {

      trips =
        await OpsAPI.getConductorTrips();

    } catch (error) {

      console.error(
        "Unable to load conductor trips:",
        error
      );

      root.innerHTML =
        emptyHTML(
          error.message ||
          "Unable to load scheduled departures."
        );

      return;
    }


    if (
      !Array.isArray(trips) ||
      trips.length === 0
    ) {

      root.innerHTML =
        emptyHTML(
          "No scheduled departures yet — add one under Routes & Schedules."
        );

      return;
    }


    const portalBaseUrl =
      new URL(
        "../conductor/index.html",
        window.location.href
      ).href;


    root.innerHTML = `

      <!-- Portal information -->

      <div
        class="card card-pad"
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:10px;
          flex-wrap:wrap;
          background:var(--glass-2)
        "
      >

        <div class="muted small">

          Conductors use a separate,
          no-login page with just a trip code —
          pick a trip below, then share access.

        </div>


        <a
          class="btn sm"
          href="${esc(portalBaseUrl)}"
          target="_blank"
          rel="noopener"
        >
          Open Conductor Portal ↗
        </a>

      </div>


      <!-- Trip selector -->

      <div class="card card-pad">

        <div class="row-3">

          <div class="field-v">

            <label for="cvTrip">
              Trip
            </label>


            <select id="cvTrip">

              ${trips.map((trip, index) => `
                <option value="${index}">

                  ${esc(trip.from)}
                  →
                  ${esc(trip.to)}
                  ·
                  ${esc(trip.time)}
                  (${esc(
                    trip.busLabel ||
                    "Unassigned"
                  )})

                </option>
              `).join("")}

            </select>

          </div>


          <div class="field-v">

            <label for="cvDate">
              Travel date
            </label>


            <input
              type="date"
              id="cvDate"
              value="${getTodayLocal()}"
            />

          </div>


          <div class="field-v">

            <label>
              &nbsp;
            </label>


            <button
              class="btn brand block"
              id="cvShareBtn"
              type="button"
            >
              📱 Share access code with conductor
            </button>

          </div>

        </div>


        <div
          class="muted small"
          id="cvCrewLine"
          style="margin-top:10px"
        >
          &nbsp;
        </div>

      </div>


      <div id="cvBody"></div>
    `;


    /* ----------------------------------------------------------
       Draw selected trip
       ---------------------------------------------------------- */

    async function draw() {

      const selectedIndex =
        Number(
          $("#cvTrip", root).value
        );


      const trip =
        trips[selectedIndex];


      if (!trip) {

        $("#cvBody", root).innerHTML =
          emptyHTML(
            "Selected trip could not be found."
          );

        return;
      }


      const date =
        $("#cvDate", root).value;


      $("#cvCrewLine", root).textContent =
        (
          trip.driverName ||
          trip.conductorName
        )
          ? `Driver: ${
              trip.driverName ||
              "—"
            } · Conductor: ${
              trip.conductorName ||
              "—"
            }`
          : "No crew assigned to this departure yet.";


      if (!date) {

        $("#cvBody", root).innerHTML =
          emptyHTML(
            "Please select a travel date."
          );

        return;
      }


      try {

        const result =
          await OpsAPI.getManifest(
            trip.from,
            trip.to,
            date,
            trip.time,
            trip.capacity
          );


        const manifest =
          Array.isArray(
            result?.manifest
          )
            ? result.manifest
            : [];


        const takenSeats =
          Array.isArray(
            result?.takenSeats
          )
            ? result.takenSeats.map(
                String
              )
            : [];


        const capacity =
          Number(
            result?.capacity ??
            trip.capacity ??
            40
          );


        /* ------------------------------------------------------
           Main body
           ------------------------------------------------------ */

        $("#cvBody", root).innerHTML = `

          <div class="grid-2">

            <!-- Seat chart -->

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


                <span class="badge info">

                  ${takenSeats.length}/${capacity}
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
                id="cvSeatMap"
              ></div>

            </div>


            <!-- Manifest -->

            <div class="card card-pad">

              <h3
                style="margin-bottom:10px"
              >
                Manifest
              </h3>


              <div
                id="cvManifest"
                style="
                  display:flex;
                  flex-direction:column;
                  gap:8px
                "
              ></div>

            </div>

          </div>
        `;


        /* ------------------------------------------------------
           Generate seat layout
           ------------------------------------------------------ */

        const seatRows =
          SeatLayout.generate(
            capacity
          );


        const seatsHTML =
          seatRows
            .map(row => {

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
                            <div class="aisle">
                            </div>
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
            })
            .join("");


        $("#cvSeatMap", root)
          .innerHTML =
          seatsHTML;


        /* ------------------------------------------------------
           Booked seat click
           ------------------------------------------------------ */

        $$(".seat.taken", root)
          .forEach(element => {

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
          });


        /* ------------------------------------------------------
           Available seat click
           ------------------------------------------------------ */

        $$(".seat.free", root)
          .forEach(element => {

            element.addEventListener(
              "click",
              () => {

                openCounterBooking(
                  trip,
                  date,
                  element.dataset.seat,
                  draw
                );

              }
            );
          });


        /* ------------------------------------------------------
           Manifest
           ------------------------------------------------------ */

        $("#cvManifest", root)
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

                        <div class="cell-strong">
                          ${esc(
                            booking.passengerName
                          )}
                        </div>


                        <div class="cell-sub">

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

            : emptyHTML(
                "No seats booked for this trip yet."
              );


      } catch (error) {

        console.error(
          "Manifest loading error:",
          error
        );


        $("#cvBody", root).innerHTML =
          emptyHTML(
            error.message ||
            "Unable to load trip manifest."
          );
      }

    }


    /* ----------------------------------------------------------
       Seat details
       ---------------------------------------------------------- */

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


                <div class="cell-strong">
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


    /* ----------------------------------------------------------
       Counter booking
       ---------------------------------------------------------- */

    function openCounterBooking(
      trip,
      date,
      seat,
      onDone
    ) {

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
                Confirm booking —
                seat ${seat}
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

              await OpsAPI.counterBooking({

                from:
                  trip.from,

                to:
                  trip.to,

                date,

                depTime:
                  trip.time,

                plate:
                  trip.busLabel ||
                  "",

                pickupPoint,

                passengerName,

                phone,

                seats: [
                  String(seat)
                ]

              });


              closeModal(
                "formModal"
              );


              toast(
                `Seat ${seat} booked at the counter.`
              );


              await onDone();

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


    /* ----------------------------------------------------------
       Events
       ---------------------------------------------------------- */

    $("#cvTrip", root)
      .addEventListener(
        "change",
        draw
      );


    $("#cvDate", root)
      .addEventListener(
        "change",
        draw
      );


    $("#cvShareBtn", root)
      .addEventListener(
        "click",
        async () => {

          const trip =
            trips[
              Number(
                $("#cvTrip", root)
                  .value
              )
            ];


          const date =
            $("#cvDate", root)
              .value;


          if (!trip) {

            toast(
              "Please select a trip."
            );

            return;
          }


          if (!date) {

            toast(
              "Please select a travel date."
            );

            return;
          }


          try {

            const result =
              await OpsAPI.getTripCode(
                trip.from,
                trip.to,
                date,
                trip.time,
                {
                  capacity:
                    trip.capacity,

                  busLabel:
                    trip.busLabel,

                  driverName:
                    trip.driverName,

                  conductorName:
                    trip.conductorName
                }
              );


            const code =
              result?.code;


            if (!code) {

              toast(
                "The server did not return an access code."
              );

              return;
            }


            const portalUrl =
              new URL(
                `../conductor/index.html?code=${encodeURIComponent(
                  code
                )}`,
                window.location.href
              ).href;


            openForm(
              "Share with conductor",

              `
                <div class="form-grid">

                  <p class="muted small">

                    No login needed —
                    the conductor opens this link
                    on their own phone.

                    It only unlocks
                    <strong>this one trip</strong>.

                  </p>


                  <div class="field-v">

                    <label>
                      Access code
                    </label>


                    <div
                      class="cell-mono"
                      style="
                        font-size:28px;
                        font-weight:800;
                        letter-spacing:4px;
                        text-align:center;
                        padding:14px;
                        background:var(--glass-2);
                        border-radius:12px
                      "
                    >
                      ${esc(code)}
                    </div>

                  </div>


                  <div class="field-v">

                    <label>
                      Trip
                    </label>


                    <div class="cell-strong">

                      ${esc(trip.from)}
                      →
                      ${esc(trip.to)}
                      ·
                      ${esc(trip.time)}
                      ·
                      ${esc(date)}

                    </div>

                  </div>


                  <div class="field-v">

                    <label>
                      Link to send them
                      (WhatsApp, SMS, etc.)
                    </label>


                    <input
                      type="text"
                      readonly
                      value="${esc(portalUrl)}"
                      id="portalUrlInput"
                      style="
                        font-family:var(--mono);
                        font-size:11.5px
                      "
                    />

                  </div>


                  <div class="row-2">

                    <button
                      class="btn block"
                      id="copyLinkBtn"
                      type="button"
                    >
                      Copy link
                    </button>


                    <a
                      class="btn brand block"
                      href="${esc(
                        portalUrl
                      )}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open portal now ↗
                    </a>

                  </div>

                </div>
              `
            );


            $("#copyLinkBtn")
              ?.addEventListener(
                "click",
                async () => {

                  try {

                    await navigator.clipboard.writeText(
                      portalUrl
                    );


                    toast(
                      "Link copied — send it to your conductor."
                    );

                  } catch {

                    $("#portalUrlInput")
                      ?.select();


                    toast(
                      "Link selected — copy it manually."
                    );

                  }

                }
              );


          } catch (error) {

            console.error(
              "Trip code generation error:",
              error
            );


            toast(
              error.message ||
              "Unable to generate access code."
            );
          }

        }
      );


    /* ----------------------------------------------------------
       Initial render
       ---------------------------------------------------------- */

    await draw();

  }


  /* ------------------------------------------------------------
     Register route
     ------------------------------------------------------------ */

  ROUTES_MAP.conductor = {

    title:
      "Conductor View",

    sub:
      "Confirm seats, view pickup contacts, and take counter bookings per trip.",

    render:
      renderConductor

  };

})();