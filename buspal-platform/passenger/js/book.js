/*  BusPal — Passenger Dashboard — Book a Trip*/

const BACKEND_BASE_URL = "http://localhost/buspal-backend-php";
(() => {

   
  // LOCAL DATE
  

  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


   
  function timeToMinutes(time) {
    if (!time) return null;

    let value = String(time)
      .trim()
      .toUpperCase();

    if (!value) return null;

    const ampmMatch = value.match(/\b(AM|PM)\b/);
    const is12Hour = Boolean(ampmMatch);

    value = value.replace(/\b(AM|PM)\b/g, "").trim();

    const parts = value.split(":");

    if (parts.length < 2) {
      return null;
    }

    let hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    if (is12Hour) {
      const period = ampmMatch[1];

      if (hours < 1 || hours > 12) {
        return null;
      }

      if (period === "AM" && hours === 12) {
        hours = 0;
      }

      if (period === "PM" && hours !== 12) {
        hours += 12;
      }
    }

    if (hours < 0 || hours > 23) {
      return null;
    }

    return hours * 60 + minutes;
  }


   
  // CURRENT TIME
   

  function getCurrentMinutes() {
    const now = new Date();

    return (
      now.getHours() * 60 +
      now.getMinutes()
    );
  }

 
  // TRIP TIME VALIDATION
  
  function isTripBookable(trip) {
    if (!trip) {
      return false;
    }

    const tripDate = String(
      trip.date || ""
    ).slice(0, 10);

    const today = getLocalDateString();

    if (!tripDate) {
      return false;
    }
 
    // Past date
     

    if (tripDate < today) {
      return false;
    }
 
    // Future date
  
    if (tripDate > today) {
      return true;
    }
 
    // Departure must be AFTER current time.
     

    const departureMinutes =
      timeToMinutes(trip.depTime);

    if (departureMinutes === null) {
      console.warn(
        "Unable to validate departure time:",
        trip.depTime
      );

     
      return false;
    }

    return departureMinutes > getCurrentMinutes();
  }

 
  // SEARCH RESULT FILTER
   

  function filterBookableTrips(trips) {
    if (!Array.isArray(trips)) {
      return [];
    }

    return trips.filter(
      trip => isTripBookable(trip)
    );
  }


  
  // ==========================================================
// BOOK PAGE
// ==========================================================

async function renderBook(root) {

  const today =
    getLocalDateString();


  root.innerHTML = `
    <div class="card card-pad">

      <form id="searchForm" class="row-3">

        <div class="field-v">
          <label for="fFrom">
            From
          </label>

          <select id="fFrom">
            <option value="">
              Select departure
            </option>
          </select>
        </div>


        <div class="field-v">
          <label for="fTo">
            To
          </label>

          <select id="fTo">
            <option value="">
              Select destination
            </option>
          </select>
        </div>


        <div class="field-v">
          <label for="fDate">
            Date
          </label>

          <input
            type="date"
            id="fDate"
            value="${today}"
            min="${today}"
          />
        </div>


        <div style="grid-column:1/-1">

          <button
            class="btn brand"
            type="submit"
          >
            Search buses
          </button>

        </div>

      </form>

    </div>


    <div
      id="tripResults"
      style="
        display:flex;
        flex-direction:column;
        gap:12px
      "
    ></div>
  `;


  const resultsEl =
    $("#tripResults", root);


  // ==========================================================
  // LOAD ROUTES
  // ==========================================================

  async function loadRouteDropdowns() {

    try {

      const routes =
        await BusPalAPI.getPublicRoutes();


      const fromSelect =
        $("#fFrom", root);

      const toSelect =
        $("#fTo", root);


      // ------------------------------------------------------
      // Get unique departure cities
      // ------------------------------------------------------

      const fromCities =
        [
          ...new Set(
            routes
              .map(route => route.from)
              .filter(Boolean)
          )
        ];


      // ------------------------------------------------------
      // Get unique destination cities
      // ------------------------------------------------------

      const toCities =
        [
          ...new Set(
            routes
              .map(route => route.to)
              .filter(Boolean)
          )
        ];


      // ------------------------------------------------------
      // Populate FROM dropdown
      // ------------------------------------------------------

      fromSelect.innerHTML = `
        <option value="">
          Select departure
        </option>

        ${
          fromCities
            .map(city => `
              <option value="${esc(city)}">
                ${esc(city)}
              </option>
            `)
            .join("")
        }
      `;


      // ------------------------------------------------------
      // Populate TO dropdown
      // ------------------------------------------------------

      toSelect.innerHTML = `
        <option value="">
          Select destination
        </option>

        ${
          toCities
            .map(city => `
              <option value="${esc(city)}">
                ${esc(city)}
              </option>
            `)
            .join("")
        }
      `;


    } catch (error) {

      console.error(
        "Route loading error:",
        error
      );


      resultsEl.innerHTML =
        emptyHTML(
          error.message ||
          "Unable to load routes."
        );

    }

  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  async function runSearch(e) {

    e?.preventDefault();


    const from =
      $("#fFrom", root)
        .value
        .trim();


    const to =
      $("#fTo", root)
        .value
        .trim();


    const selectedDate =
      $("#fDate", root).value;


    const currentToday =
      getLocalDateString();


    // --------------------------------------------------------
    // Validate FROM
    // --------------------------------------------------------

    if (!from) {

      resultsEl.innerHTML =
        emptyHTML(
          "Please select a departure city."
        );

      return;

    }


    // --------------------------------------------------------
    // Validate TO
    // --------------------------------------------------------

    if (!to) {

      resultsEl.innerHTML =
        emptyHTML(
          "Please select a destination city."
        );

      return;

    }


    // --------------------------------------------------------
    // Prevent same city
    // --------------------------------------------------------

    if (
      from.toLowerCase() ===
      to.toLowerCase()
    ) {

      resultsEl.innerHTML =
        emptyHTML(
          "Departure and destination cannot be the same."
        );

      return;

    }


    // --------------------------------------------------------
    // Block past dates
    // --------------------------------------------------------

    if (
      selectedDate <
      currentToday
    ) {

      resultsEl.innerHTML =
        emptyHTML(
          "You cannot search for buses on a past date."
        );

      return;

    }


    resultsEl.innerHTML = `
      <div class="empty">
        <div class="ico">⌕</div>
        Searching…
      </div>
    `;


    try {

      const trips =
        await BusPalAPI.searchTrips({

          from:

            from,

          to:

            to,

          date:

            selectedDate,

        });


      // ------------------------------------------------------
      // Filter out:
      //
      // - past dates
      // - today's departures that already passed
      // - today's departure at exactly current time
      // ------------------------------------------------------

      const bookableTrips =
        filterBookableTrips(
          trips
        );


      resultsEl.innerHTML =
        bookableTrips.length

          ? bookableTrips
              .map(
                tripCardHTML
              )
              .join("")

          : emptyHTML(

              selectedDate ===
              currentToday

                ? "No buses are available from this time onward today."

                : "No buses match that search — try a different route or date."

            );


      // ------------------------------------------------------
      // SELECT SEATS
      // ------------------------------------------------------

      $$(".btn-select-seats", resultsEl)
        .forEach(btn => {

          btn.addEventListener(
            "click",
            () => {

              openSeatModal(
                btn.dataset.tripId
              );

            }
          );

        });


    } catch (error) {

      console.error(
        "Trip search error:",
        error
      );


      resultsEl.innerHTML = `
        <div class="empty">

          <div class="ico">
            !
          </div>

          ${esc(
            error.message ||
            "Unable to load buses."
          )}

        </div>
      `;

    }

  }


  // ==========================================================
  // SEARCH FORM EVENT
  // ==========================================================

  $("#searchForm", root)
    .addEventListener(
      "submit",
      runSearch
    );


  // ==========================================================
  // LOAD ROUTES FROM DATABASE
  // ==========================================================

  await loadRouteDropdowns();

}


  // ============================================================
  // TRIP CARD
  // ============================================================

  function tripCardHTML(t) {

    const low =
      Number(t.seatsAvailable) <= 4;


    const firstPhoto =
  Array.isArray(t.photos) && t.photos.length
    ? t.photos[0].path
    : null;

let photoURL = null;

if (firstPhoto) {
  if (
    firstPhoto.startsWith("http://") ||
    firstPhoto.startsWith("https://")
  ) {
    photoURL = firstPhoto;
  } else {
    photoURL =
      `${BACKEND_BASE_URL}/${firstPhoto.replace(/^\/+/, "")}`;
  }
}

const photoHTML = photoURL
  ? `
      <div class="trip-photo">
        <img
          src="${esc(photoURL)}"
          alt="${esc(t.busType || "Bus")}"
          loading="lazy"
          onerror="
            this.parentElement.innerHTML =
              '<div class=&quot;trip-photo-placeholder&quot;>🚌</div>'
          "
        />
      </div>
    `
  : `
      <div class="trip-photo-placeholder">
        🚌
      </div>
    `;


    const duration =
      t.duration ||
      "Schedule not specified";


    const arrival =
      t.arrTime ||
      "TBA";


    return `
      <div class="trip-card">

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px
          "
        >

          ${photoHTML}

          <div class="trip-time">

            <div class="t">
              ${esc(
                t.depTime || "TBA"
              )}
            </div>

            <div class="d">
              ${esc(
                t.from || ""
              )}
            </div>

          </div>

        </div>


        <div>

          <div class="trip-route">

            <div class="trip-time">

              <div class="t">
                ${esc(arrival)}
              </div>

              <div class="d">
                ${esc(
                  t.to || ""
                )}
              </div>

            </div>


            <div class="route-line"></div>


            <span class="muted small">
              ${esc(duration)}
            </span>

          </div>


          <div class="trip-meta">

            <span class="badge info">
              ${esc(
                t.busType || "Bus"
              )}
            </span>


            <span
              class="badge ${
                low ? "warn" : "ok"
              }"
            >
              ${Number(
                t.seatsAvailable || 0
              )}
              seats left
            </span>


            <span class="muted small">
              Bus ${esc(
                t.plate || "TBA"
              )}
              ·
              ${esc(
                t.date || ""
              )}
            </span>

          </div>

        </div>


        <div class="trip-price">

          <div class="p">
            ${fmtLKR(
              Number(
                t.price || 0
              )
            )}
          </div>


          <div
            class="muted small"
            style="margin-bottom:8px"
          >
            per seat
          </div>


          <button
            class="btn brand btn-select-seats"
            data-trip-id="${esc(t.id)}"
            ${
              Number(
                t.seatsAvailable
              ) === 0
                ? "disabled"
                : ""
            }
          >
            ${
              Number(
                t.seatsAvailable
              ) === 0
                ? "Sold out"
                : "Select seats"
            }
          </button>

        </div>

      </div>
    `;
  }


  // ============================================================
  // SEAT MODAL
  // ============================================================
async function openSeatModal(tripId) {

  try {

    // Get the latest trip information
    const latestTrip =
      await BusPalAPI.getTrip(tripId);

      console.log("LATEST TRIP:", latestTrip);
      console.log("DATE:", latestTrip?.date);
      console.log("DEP TIME:", latestTrip?.depTime);
      console.log(
       "FULL OBJECT:",
       JSON.stringify(latestTrip, null, 2)
      );


    // Make sure the trip exists
    if (!latestTrip) {

      toast(
        "Trip not found."
      );

      return;

    }


    // --------------------------------------------------------
    // Check whether the departure time has already passed
    // --------------------------------------------------------

    if (!isTripBookable(latestTrip)) {

      toast(
        "This departure is no longer available because its departure time has passed.",
        4000
      );

      return;

    }


    // --------------------------------------------------------
    // Create seat selection state
    // --------------------------------------------------------

    seatSelection = {

      tripId: tripId,

      trip: latestTrip,

      seats: new Set(),

    };


    // --------------------------------------------------------
    // Modal title
    // --------------------------------------------------------

    $("#seatModalTitle")
      .textContent =
        `${latestTrip.from} → ${latestTrip.to}`;


    // --------------------------------------------------------
    // Modal subtitle
    // --------------------------------------------------------

    $("#seatModalSub")
      .textContent =
        `${latestTrip.date} · ${latestTrip.depTime} departure · ${latestTrip.busType}`;


    // --------------------------------------------------------
    // Generate seat map
    // --------------------------------------------------------

    $("#seatModalBody")
      .innerHTML =
        seatModalBodyHTML(
          latestTrip
        );


    // --------------------------------------------------------
    // Bind seat buttons
    // --------------------------------------------------------

    bindSeatMap();


    // --------------------------------------------------------
    // Open modal
    // --------------------------------------------------------

    openModal(
      "seatModal"
    );


  } catch (error) {

    console.error(
      "Open seat modal error:",
      error
    );


    toast(
      error.message ||
      "Unable to load seat information."
    );

  }

}


  // ============================================================
  // SEAT MAP
  // ============================================================

  function seatMapHTML(
    seatsTotal,
    seatsTaken
  ) {

    const rows =
      SeatLayout.generate(
        Number(seatsTotal)
      );


    return rows.map(row => {

      const seatDivs =
        row.seats
          .map((n, i) => {

            const id =
              String(n);


            const taken =
              seatsTaken.includes(
                id
              );


            const aisle =
              row.type === "pair" &&
              i === 1

                ? `<div class="aisle"></div>`

                : "";


            return `
              <div
                class="
                  seat
                  ${
                    taken
                      ? "taken"
                      : "free"
                  }
                "
                data-seat="${esc(id)}"
              >
                ${esc(id)}
              </div>

              ${aisle}
            `;

          })
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

    }).join("");

  }


  // ============================================================
  // SEAT MODAL HTML
  // ============================================================

  function seatModalBodyHTML(
    trip
  ) {

    return `
      <div class="seat-legend">

        <span>
          <span
            class="legend-chip"
            style="
              background:rgba(
                255,
                255,
                255,
                .08
              )
            "
          ></span>

          Available
        </span>


        <span>

          <span
            class="legend-chip"
            style="
              background:var(--danger)
            "
          ></span>

          Taken

        </span>


        <span>

          <span
            class="legend-chip"
            style="
              background:var(--brand)
            "
          ></span>

          Selected

        </span>

      </div>


      <div class="seat-map">

        ${seatMapHTML(
          trip.seatsTotal,
          trip.seatsTaken || []
        )}

      </div>


      <div
        class="grid-2"
        style="align-items:center"
      >

        <div>

          <div class="muted small">
            Selected seats
          </div>


          <div
            id="seatSummary"
            style="
              font-family:var(--mono);
              font-weight:600;
              margin-top:4px
            "
          >
            None yet
          </div>

        </div>


        <div style="text-align:right">

          <div class="muted small">
            Total
          </div>


          <div
            id="seatTotal"
            style="
              font-size:19px;
              font-weight:800;
              font-family:var(--mono)
            "
          >
            ${fmtLKR(0)}
          </div>

        </div>

      </div>


      <button
        class="btn brand block"
        id="confirmSeats"
        style="margin-top:14px"
        disabled
      >
        Confirm booking
      </button>
    `;

  }


  // ============================================================
  // SEAT MAP EVENTS
  // ============================================================

  function bindSeatMap() {

    const body =
      $("#seatModalBody");


    $$(".seat.free", body)
      .forEach(seat => {

        seat.addEventListener(
          "click",
          () => {

            const id =
              seat.dataset.seat;


            if (
              seatSelection.seats
                .has(id)
            ) {

              seatSelection.seats
                .delete(id);

              seat.classList
                .remove(
                  "selected"
                );

            } else {

              seatSelection.seats
                .add(id);

              seat.classList
                .add(
                  "selected"
                );

            }


            const list =
              [
                ...seatSelection.seats
              ];


            $("#seatSummary", body)
              .textContent =
                list.length
                  ? list.join(", ")
                  : "None yet";


            $("#seatTotal", body)
              .textContent =
                fmtLKR(
                  list.length *
                  Number(
                    seatSelection
                      .trip
                      .price || 0
                  )
                );


            $("#confirmSeats", body)
              .disabled =
                list.length === 0;

          }
        );

      });


    $("#confirmSeats", body)
      .addEventListener(
        "click",
        confirmBooking
      );

  }


  // ============================================================
  // CONFIRM BOOKING
  // ============================================================

  async function confirmBooking() {

    const btn =
      $("#confirmSeats");


    // ----------------------------------------------------------
    // FINAL TIME VALIDATION
    // ----------------------------------------------------------

    if (
      !isTripBookable(
        seatSelection.trip
      )
    ) {

      toast(
        "This departure is no longer available because its departure time has passed.",
        4000
      );

      closeModal(
        "seatModal"
      );

      return;

    }


    if (
      !seatSelection.seats ||
      seatSelection.seats.size === 0
    ) {

      toast(
        "Please select at least one seat."
      );

      return;

    }


    btn.disabled = true;

    btn.textContent =
      "Booking…";


    try {

      // --------------------------------------------------------
      // Get the latest trip again.
      //
      // This catches a departure that passed while
      // the passenger was selecting seats.
      // --------------------------------------------------------

      const latestTrip =
        await BusPalAPI.getTrip(
          seatSelection.tripId
        );


      if (
        !latestTrip ||
        !isTripBookable(
          latestTrip
        )
      ) {

        throw new Error(
          "This departure is no longer available because its departure time has passed."
        );

      }


      // --------------------------------------------------------
      // Update the stored trip with latest information.
      // --------------------------------------------------------

      seatSelection.trip =
        latestTrip;


      // --------------------------------------------------------
      // Create booking
      // --------------------------------------------------------

   const booking =
  await BusPalAPI.createBooking({

    tripId:
      seatSelection.tripId,

    travelDate:
      latestTrip.date,

    seats:
      [
        ...seatSelection.seats
      ],

  });


      closeModal(
        "seatModal"
      );


      toast(
  `Booking confirmed — ${
    booking.seats.join(", ")
  } on ${
    booking.from
  } → ${
    booking.to
  }`
);


      $("#passModalBody")
        .innerHTML =
        boardingPassHTML(
         booking
       );

      openModal(
       "passModal"
      );

     generateTicketQR(
      booking
       );


       const downloadButton =
           document.querySelector(
           ".ticket-download-btn"
           );

        if (downloadButton) {

           downloadButton.addEventListener(
          "click",
          () => {

           downloadETicket(
            booking
            );

    }
  );

}
    } catch (error) {

      console.error(
        "Booking error:",
        error
      );


      btn.disabled = false;

      btn.textContent =
        "Confirm booking";


      toast(
        error.message ||
        "Booking failed. Please try again.",
        4000
      );

    }

  }


  // ============================================================
  // ROUTE REGISTRATION
  // ============================================================

  ROUTES.book = {

    title:
      "Book a Trip",

    sub:
      "Search routes and reserve your seat.",

    render:
      renderBook,

  };

})();