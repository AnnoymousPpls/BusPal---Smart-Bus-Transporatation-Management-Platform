/* =========================================================
   BusPal — Passenger Dashboard — Live Tracking
   FULL REPLACEMENT
   ---------------------------------------------------------
   - Shows passenger's upcoming / active booked trips.
   - Matches passenger booking to operator live trip.
   - Uses the same ETA-based bus movement as the operator page.
   - Bus starts at departure and reaches destination at ETA.
   - Uses Leaflet + OpenStreetMap.
   ========================================================= */

(() => {

  const MAP_HEIGHT = 400;
  const REFRESH_MS = 15000;
  const ANIMATION_MS = 1000;

  let selectedBookingId = null;
  let currentMap = null;
  let currentBusMarker = null;
  let currentCoordinates = [];
  let currentAnimationTimer = null;
  let refreshTimer = null;

  /* =======================================================
     HELPERS
     ======================================================= */

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function safeEsc(value) {
    if (typeof esc === "function") return esc(value);

    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getBookingId(booking) {
    return (
      booking?.id ||
      booking?.bookingId ||
      booking?.pnr ||
      booking?.bookingPnr ||
      ""
    );
  }

  function getBookingRoute(booking) {
    const trip = booking?.trip || booking || {};

    return {
      from:
        trip.from ||
        booking?.from ||
        "",

      to:
        trip.to ||
        booking?.to ||
        "",

      date:
        trip.date ||
        booking?.date ||
        "",

      depTime:
        trip.depTime ||
        trip.time ||
        booking?.depTime ||
        booking?.time ||
        ""
    };
  }

  function getLiveRoute(live) {
    return {
      from: live?.from || "",
      to: live?.to || "",
      date: live?.date || "",
      depTime:
        live?.depTime ||
        live?.time ||
        ""
    };
  }

  function sameDate(a, b) {
    if (!a || !b) return false;

    return (
      String(a).slice(0, 10) ===
      String(b).slice(0, 10)
    );
  }

  function parseTime(value) {
    if (value == null) return null;

    const text = String(value).trim().toUpperCase();

    const match =
      text.match(/^(\d{1,2})(?::|\.)(\d{1,2})(?:\s*(AM|PM))?$/) ||
      text.match(/^(\d{1,2})(?:\s*(AM|PM))$/);

    if (!match) return null;

    let h = Number(match[1]);
    const m = Number(match[2] || 0);
    const period = match[3];

    if (!Number.isFinite(h) || !Number.isFinite(m)) {
      return null;
    }

    if (m < 0 || m > 59) return null;

    if (period) {
      if (h < 1 || h > 12) return null;

      if (period === "AM" && h === 12) h = 0;
      if (period === "PM" && h !== 12) h += 12;
    } else if (h < 0 || h > 23) {
      return null;
    }

    return h * 60 + m;
  }

  function createLocalDate(dateValue, timeValue) {
    if (!dateValue || !timeValue) return null;

    const parts =
      String(dateValue)
        .slice(0, 10)
        .split("-");

    if (parts.length !== 3) return null;

    const y = Number(parts[0]);
    const mo = Number(parts[1]);
    const d = Number(parts[2]);
    const mins = parseTime(timeValue);

    if (![y, mo, d, mins].every(Number.isFinite)) {
      return null;
    }

    return new Date(
      y,
      mo - 1,
      d,
      Math.floor(mins / 60),
      mins % 60,
      0,
      0
    );
  }

  function getTiming(booking, live) {
    const route = getBookingRoute(booking);

    const departureAt = createLocalDate(
      route.date,
      route.depTime
    );

    const etaMinutes = Math.max(
      0,
      Number(live?.etaMinutes || 0)
    );

    if (!departureAt || etaMinutes <= 0) {
      return {
        valid: false,
        departureAt: null,
        arrivalAt: null,
        progress: 0,
        remainingMinutes: null,
        state: "unknown"
      };
    }

    const arrivalAt = new Date(
      departureAt.getTime() +
      etaMinutes * 60000
    );

    const now = Date.now();

    let state = "live";

    if (now < departureAt.getTime()) {
      state = "upcoming";
    } else if (now >= arrivalAt.getTime()) {
      state = "ended";
    }

    const elapsedMs = Math.max(
      0,
      Math.min(
        now - departureAt.getTime(),
        etaMinutes * 60000
      )
    );

    const progress = Math.max(
      0,
      Math.min(
        1,
        elapsedMs / (etaMinutes * 60000)
      )
    );

    return {
      valid: true,
      departureAt,
      arrivalAt,
      progress,
      remainingMinutes: Math.max(
        0,
        Math.ceil(
          (arrivalAt.getTime() - now) / 60000
        )
      ),
      state
    };
  }

  function formatDuration(minutes) {
    const value = Math.max(
      0,
      Math.round(Number(minutes || 0))
    );

    const h = Math.floor(value / 60);
    const m = value % 60;

    return h
      ? `${h}h ${m}m`
      : `${m}m`;
  }

  function formatClock(date) {
    if (!date) return "—";

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  /* =======================================================
     MATCH BOOKING TO LIVE TRIP
     ======================================================= */

  function bookingMatchesLiveTrip(booking, live) {
    if (!booking || !live) return false;

    const b = getBookingRoute(booking);
    const l = getLiveRoute(live);

    if (
      normalize(b.from) !==
      normalize(l.from)
    ) {
      return false;
    }

    if (
      normalize(b.to) !==
      normalize(l.to)
    ) {
      return false;
    }

    if (
      !sameDate(b.date, l.date)
    ) {
      return false;
    }

    const bookingTime = parseTime(b.depTime);
    const liveTime = parseTime(l.depTime);

    return (
      bookingTime !== null &&
      liveTime !== null &&
      bookingTime === liveTime
    );
  }

  /* =======================================================
     TRACKING EXPIRY
     ======================================================= */

  function getTrackingEndTime(booking, live) {
    if (!booking || !live) return null;

    if (live.trackingEndsAt) {
      const explicit = new Date(
        live.trackingEndsAt
      );

      if (!Number.isNaN(explicit.getTime())) {
        return explicit;
      }
    }

    const departure = createLocalDate(
      getBookingRoute(booking).date,
      getBookingRoute(booking).depTime
    );

    if (!departure) return null;

    const duration = Number(
      live.tripDurationMinutes
    );

    if (Number.isFinite(duration) && duration > 0) {
      return new Date(
        departure.getTime() +
        duration * 60000
      );
    }

    const eta = Number(
      live.etaMinutes
    );

    if (Number.isFinite(eta) && eta > 0) {
      return new Date(
        departure.getTime() +
        eta * 60000
      );
    }

    return null;
  }

  function isTrackableBooking(booking, live) {
     const effectiveStatus =
  typeof getBookingEffectiveStatus === "function"
    ? getBookingEffectiveStatus(booking)
    : normalize(booking?.status);


const validStatus = [
  "upcoming",
  "live"
].includes(effectiveStatus);


if (!validStatus) return false;

    const route = getBookingRoute(booking);

    if (!route.date || !route.depTime) {
      return false;
    }

    const departure = createLocalDate(
      route.date,
      route.depTime
    );

    if (!departure) return false;

    if (departure.getTime() > Date.now()) {
      return true;
    }

    if (!live) return false;

    if (!bookingMatchesLiveTrip(booking, live)) {
      return false;
    }

    const end = getTrackingEndTime(
      booking,
      live
    );

    return (
      end &&
      Date.now() <= end.getTime()
    );
  }

  /* =======================================================
     MAP
     ======================================================= */

  function destroyMap() {
    if (currentAnimationTimer) {
      clearInterval(currentAnimationTimer);
      currentAnimationTimer = null;
    }

    if (currentMap) {
      try {
        currentMap.remove();
      } catch (_) {}
    }

    currentMap = null;
    currentBusMarker = null;
    currentCoordinates = [];
  }

  function ensureLeaflet() {
    if (typeof L === "undefined") {
      throw new Error(
        "Leaflet is not loaded. Add Leaflet JS before tracking.js."
      );
    }
  }

  async function geocodePlace(place) {
    const clean = String(place || "").trim();

    if (!clean) return null;

    try {
      const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json" +
        "&limit=1" +
        "&countrycodes=lk" +
        "&q=" +
        encodeURIComponent(
          `${clean}, Sri Lanka`
        );

      const response = await fetch(url, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) return null;

      const data = await response.json();

      if (!Array.isArray(data) || !data.length) {
        return null;
      }

      return {
        name: clean,
        lat: Number(data[0].lat),
        lng: Number(data[0].lon)
      };

    } catch (error) {
      console.error(
        "[BusPal Passenger Tracking] Geocoding failed:",
        error
      );

      return null;
    }
  }

  function showMapMessage(
    element,
    title,
    message,
    icon = "🗺️"
  ) {
    if (!element) return;

    element.innerHTML = `
      <div style="
        height:100%;
        min-height:${MAP_HEIGHT}px;
        display:flex;
        align-items:center;
        justify-content:center;
        text-align:center;
        padding:30px;
        box-sizing:border-box;
        color:#64748b;
      ">
        <div>
          <div style="font-size:32px;margin-bottom:10px">
            ${icon}
          </div>

          <strong style="
            display:block;
            color:#334155;
            margin-bottom:6px;
          ">
            ${safeEsc(title)}
          </strong>

          <span>
            ${safeEsc(message)}
          </span>
        </div>
      </div>
    `;
  }

  function createBusIcon() {
    return L.divIcon({
      className: "buspal-passenger-bus-marker",
      html: `
        <div style="
          width:42px;
          height:42px;
          border-radius:50%;
          background:#f59e0b;
          border:4px solid white;
          box-shadow:0 4px 14px rgba(0,0,0,.28);
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:20px;
        ">🚌</div>
      `,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });
  }

  function getStopNames(live) {
    const allStops =
      Array.isArray(live?.stops)
        ? live.stops
        : [];

    let names = allStops
      .map(
        s =>
          typeof s === "string"
            ? s
            : s?.name
      )
      .map(
        x => String(x || "").trim()
      )
      .filter(Boolean)
      .filter(
        x =>
          ![
            "en route",
            "enroute",
            "in transit",
            "in-transit"
          ].includes(
            normalize(x)
          )
      );

    if (
      names.length < 2 &&
      live?.from &&
      live?.to
    ) {
      names = [
        live.from,
        live.to
      ];
    }

    return names;
  }

  function interpolatePosition(
    coordinates,
    progress
  ) {
    if (
      !Array.isArray(coordinates) ||
      coordinates.length < 2
    ) {
      return null;
    }

    const p = Math.max(
      0,
      Math.min(1, progress)
    );

    if (p >= 1) {
      return coordinates[
        coordinates.length - 1
      ];
    }

    const scaled =
      p * (coordinates.length - 1);

    const index = Math.min(
      coordinates.length - 2,
      Math.floor(scaled)
    );

    const localProgress =
      scaled - index;

    const a = coordinates[index];
    const b = coordinates[index + 1];

    return {
      lat:
        a.lat +
        (b.lat - a.lat) *
        localProgress,

      lng:
        a.lng +
        (b.lng - a.lng) *
        localProgress,

      name:
        `Between ${a.name} and ${b.name}`
    };
  }

  async function drawMap(
    booking,
    live,
    mapElement
  ) {
    destroyMap();

    if (!mapElement) return;

    if (!live) {
      showMapMessage(
        mapElement,
        "Live tracking hasn't started yet",
        "The operator has not started tracking this trip yet.",
        "🚌"
      );
      return;
    }

    try {
      ensureLeaflet();

      const stopNames =
        getStopNames(live);

      if (stopNames.length < 2) {
        showMapMessage(
          mapElement,
          "Route unavailable",
          "There are not enough locations for this trip.",
          "⚠️"
        );
        return;
      }

      mapElement.innerHTML = `
        <div style="
          height:100%;
          min-height:${MAP_HEIGHT}px;
          display:flex;
          align-items:center;
          justify-content:center;
          color:#64748b;
        ">
          Loading map…
        </div>
      `;

      const coordinates = [];

      for (const stopName of stopNames) {
        const point =
          await geocodePlace(stopName);

        if (point) {
          coordinates.push(point);
        }

        await new Promise(
          resolve => setTimeout(resolve, 250)
        );
      }

      if (coordinates.length < 2) {
        showMapMessage(
          mapElement,
          "Unable to display map",
          "OpenStreetMap could not locate enough trip locations.",
          "⚠️"
        );
        return;
      }

      mapElement.innerHTML = "";

      const map = L.map(
        mapElement,
        {
          zoomControl: true,
          scrollWheelZoom: true
        }
      );

      currentMap = map;
      currentCoordinates = coordinates;

      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        }
      ).addTo(map);

      const routePoints =
        coordinates.map(
          c => [c.lat, c.lng]
        );

      const routeLine =
        L.polyline(
          routePoints,
          {
            color: "#2563eb",
            weight: 5,
            opacity: 0.85,
            lineJoin: "round",
            lineCap: "round"
          }
        ).addTo(map);

      map.fitBounds(
        routeLine.getBounds(),
        {
          padding: [30, 30]
        }
      );

      coordinates.forEach(
        (point, index) => {
          const isStart =
            index === 0;

          const isEnd =
            index ===
            coordinates.length - 1;

          const marker =
            L.circleMarker(
              [
                point.lat,
                point.lng
              ],
              {
                radius: 8,
                color: "#fff",
                weight: 3,
                fillColor:
                  isStart
                    ? "#2563eb"
                    : isEnd
                      ? "#16a34a"
                      : "#64748b",
                fillOpacity: 1
              }
            ).addTo(map);

          marker.bindPopup(`
            <strong>
              ${safeEsc(point.name)}
            </strong><br>
            <span style="
              color:#64748b;
              font-size:12px;
            ">
              ${
                isStart
                  ? "Departure"
                  : isEnd
                    ? "Arrival"
                    : "Stop"
              }
            </span>
          `);
        }
      );

      const timing =
        getTiming(
          booking,
          live
        );

      const position =
        interpolatePosition(
          coordinates,
          timing.progress
        );

      if (position) {
        currentBusMarker =
          L.marker(
            [
              position.lat,
              position.lng
            ],
            {
              icon: createBusIcon(),
              zIndexOffset: 1000
            }
          ).addTo(map);

        currentBusMarker.bindPopup(`
          <strong>
            🚌 Bus current position
          </strong><br>
          <span style="
            color:#64748b;
            font-size:12px;
          ">
            ${safeEsc(
              timing.progress >= 1
                ? live.to
                : position.name
            )}
          </span>
        `);
      }

      setTimeout(() => {
        if (currentMap === map) {
          map.invalidateSize();
        }
      }, 100);

      startMapAnimation(
        booking,
        live
      );

    } catch (error) {
      console.error(
        "[BusPal Passenger Tracking] Map failed:",
        error
      );

      showMapMessage(
        mapElement,
        "Map unavailable",
        error?.message ||
        "Unable to display the map.",
        "⚠️"
      );
    }
  }

  function startMapAnimation(
    booking,
    live
  ) {
    if (currentAnimationTimer) {
      clearInterval(
        currentAnimationTimer
      );
    }

    currentAnimationTimer =
      setInterval(() => {
        if (
          !currentBusMarker ||
          !currentMap ||
          !currentCoordinates.length
        ) {
          return;
        }

        const timing =
          getTiming(
            booking,
            live
          );

        const position =
          interpolatePosition(
            currentCoordinates,
            timing.progress
          );

        if (!position) return;

        currentBusMarker.setLatLng([
          position.lat,
          position.lng
        ]);

        currentBusMarker.setPopupContent(`
          <strong>
            🚌 Bus current position
          </strong><br>
          <span style="
            color:#64748b;
            font-size:12px;
          ">
            ${safeEsc(
              timing.progress >= 1
                ? live.to
                : position.name
            )}
          </span>
        `);

        updateLiveProgressUI(
          timing,
          live
        );

        if (
          timing.state === "ended"
        ) {
          clearInterval(
            currentAnimationTimer
          );

          currentAnimationTimer = null;
        }

      }, ANIMATION_MS);
  }

  function updateLiveProgressUI(
    timing,
    live
  ) {
    const percent =
      Math.round(
        timing.progress * 100
      );

    const bar =
      document.getElementById(
        "passengerTrackingProgressBar"
      );

    if (bar) {
      bar.style.width =
        `${percent}%`;
    }

    const remaining =
      document.getElementById(
        "passengerTrackingRemaining"
      );

    if (remaining) {
      remaining.textContent =
        timing.state === "ended"
          ? "Arrived"
          : formatDuration(
              timing.remainingMinutes
            );
    }

    const eta =
      document.getElementById(
        "passengerTrackingEta"
      );

    if (eta) {
      eta.textContent =
        timing.state === "ended"
          ? "Arrived"
          : `ETA ${formatDuration(
              timing.remainingMinutes
            )}`;
    }
  }

  /* =======================================================
     LAYOUT CSS
     -------------------------------------------------------
     This fixes the compressed Trip Crew card.
     ======================================================= */

  function injectStyles() {
    if (
      document.getElementById(
        "buspal-passenger-tracking-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "buspal-passenger-tracking-styles";

    style.textContent = `
      .buspal-passenger-tracking-layout {
        display:grid !important;
        grid-template-columns:minmax(0,1fr) 280px !important;
        gap:20px !important;
        align-items:stretch !important;
      }

      .buspal-passenger-map-card {
        min-width:0 !important;
      }

      .buspal-passenger-crew-card {
        min-width:0 !important;
        width:100% !important;
        box-sizing:border-box !important;
      }

      .buspal-passenger-map {
        width:100%;
        height:${MAP_HEIGHT}px;
        border-radius:14px;
        overflow:hidden;
        background:#eef2f7;
      }

      .buspal-passenger-crew-card .btn {
        width:100%;
        box-sizing:border-box;
      }

      @media (max-width:900px) {
        .buspal-passenger-tracking-layout {
          grid-template-columns:1fr !important;
        }

        .buspal-passenger-crew-card {
          width:100% !important;
        }
      }

      .buspal-passenger-stat-grid {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin:0 0 12px;
      }

      .buspal-passenger-stat {
        padding:9px 10px;
        border-radius:10px;
        border:1px solid rgba(148,163,184,.25);
        background:rgba(248,250,252,.7);
      }

      .buspal-passenger-stat-label {
        font-size:11px;
        color:#64748b;
        margin-bottom:3px;
      }

      .buspal-passenger-stat-value {
        font-size:14px;
        font-weight:700;
        color:#0f172a;
      }

      .buspal-passenger-progress {
        height:7px;
        border-radius:99px;
        background:#e2e8f0;
        overflow:hidden;
        margin:0 0 14px;
      }

      .buspal-passenger-progress > div {
        height:100%;
        width:0%;
        border-radius:99px;
        background:#2563eb;
        transition:width 1s linear;
      }

      @media (max-width:650px) {
        .buspal-passenger-stat-grid {
          grid-template-columns:1fr;
        }

        .buspal-passenger-map {
          height:340px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  injectStyles();

  /* =======================================================
     SELECTED TRIP
     ======================================================= */

  async function showSelectedTrip(
    booking,
    live,
    root
  ) {
    destroyMap();

    const mapWrap =
      root.querySelector(
        "#liveMapWrap"
      );

    if (!mapWrap) return;

    if (!live) {
      root.querySelector(
        "#tripInfo"
      ).innerHTML = `
        <div>
          <strong>
            ${safeEsc(
              getBookingRoute(booking).from
            )}
            →
            ${safeEsc(
              getBookingRoute(booking).to
            )}
          </strong>
          <div class="muted small">
            Waiting for operator tracking
          </div>
        </div>

        <span class="badge info">
          Not live
        </span>
      `;

      root.querySelector(
        "#crewInfo"
      ).innerHTML = `
        <h3>Trip crew</h3>

        <div>
          <div class="muted small">Driver</div>
          <div>Not available yet</div>
        </div>

        <div>
          <div class="muted small">Conductor</div>
          <div>Not available yet</div>
        </div>

        <div>
          <div class="muted small">Your booking</div>
          <div>${safeEsc(
            getBookingId(booking)
          )}</div>
        </div>
      `;

      root.querySelector(
        "#routeProgress"
      ).innerHTML = "";

      mapWrap.innerHTML = `
        <div class="buspal-passenger-map"
          id="liveMap">
        </div>
      `;

      showMapMessage(
        root.querySelector("#liveMap"),
        "Live tracking hasn't started yet",
        "The operator has not started tracking this booked trip yet.",
        "🚌"
      );

      return;
    }

    if (
      !bookingMatchesLiveTrip(
        booking,
        live
      )
    ) {
      showMapMessage(
        mapWrap,
        "This trip is not being tracked",
        "The current operator trip does not match this booking.",
        "🔒"
      );
      return;
    }

    /*
     * IMPORTANT:
     * The operator dashboard only shows the live map after
     * the scheduled departure time.
     *
     * The passenger page must use the exact same rule.
     * A live-trip API record may exist before departure because
     * the trip has already been scheduled for tracking.
     * That does NOT mean the passenger should see the map yet.
     */
    const timing =
      getTiming(
        booking,
        live
      );

    if (
      timing.valid &&
      timing.state === "upcoming"
    ) {
      const departureText =
        formatClock(timing.departureAt);

      root.querySelector(
        "#tripInfo"
      ).innerHTML = `
        <div>
          <strong>
            ${safeEsc(live.from)}
            →
            ${safeEsc(live.to)}
          </strong>

          <div class="muted small">
            Bus ${safeEsc(
              live.busPlate || "TBA"
            )}
          </div>
        </div>

        <span class="badge info">
          Starts ${safeEsc(departureText)}
        </span>
      `;

      root.querySelector(
        "#crewInfo"
      ).innerHTML = `
        <h3>Trip crew</h3>

        <div>
          <div class="muted small">Driver</div>
          <div>${safeEsc(
            live.driverName ||
            "Not assigned yet"
          )}</div>
        </div>

        <div>
          <div class="muted small">Conductor</div>
          <div>${safeEsc(
            live.conductorName ||
            "Not assigned yet"
          )}</div>
        </div>

        <div>
          <div class="muted small">Your booking</div>
          <div>${safeEsc(
            live.bookingPnr ||
            getBookingId(booking)
          )}</div>
        </div>
      `;

      root.querySelector(
        "#routeProgress"
      ).innerHTML = "";

      mapWrap.innerHTML = `
        <div
          id="liveMap"
          class="buspal-passenger-map"
        ></div>
      `;

      showMapMessage(
        root.querySelector("#liveMap"),
        "Live tracking has not started yet",
        `Tracking starts at ${departureText}.`,
        "🕐"
      );

      return;
    }

    const trackingEnd =
      getTrackingEndTime(
        booking,
        live
      );

    if (
      trackingEnd &&
      Date.now() > trackingEnd.getTime()
    ) {
      showMapMessage(
        mapWrap,
        "Trip tracking has ended",
        "The expected arrival time has passed.",
        "🏁"
      );
      return;
    }

    root.querySelector(
      "#tripInfo"
    ).innerHTML = `
      <div>
        <strong>
          ${safeEsc(live.from)}
          →
          ${safeEsc(live.to)}
        </strong>

        <div class="muted small">
          Bus ${safeEsc(
            live.busPlate || "TBA"
          )}
        </div>
      </div>

      <span
        class="badge info"
        id="passengerTrackingEta"
      >
        ETA ${formatDuration(
          timing.remainingMinutes
        )}
      </span>
    `;

    root.querySelector(
      "#crewInfo"
    ).innerHTML = `
      <h3>Trip crew</h3>

      <div>
        <div class="muted small">Driver</div>
        <div>${safeEsc(
          live.driverName ||
          "Not assigned yet"
        )}</div>
      </div>

      <div>
        <div class="muted small">Conductor</div>
        <div>${safeEsc(
          live.conductorName ||
          "Not assigned yet"
        )}</div>
      </div>

      <div>
        <div class="muted small">Your booking</div>
        <div>${safeEsc(
          live.bookingPnr ||
          getBookingId(booking)
        )}</div>
      </div>
    `;

    const stopObjects =
      Array.isArray(live.stops)
        ? live.stops
        : [];

    root.querySelector(
      "#routeProgress"
    ).innerHTML =
      stopObjects
        .map(stop => {
          const name =
            typeof stop === "string"
              ? stop
              : stop?.name;

          const status =
            typeof stop === "object"
              ? stop?.status || ""
              : "";

          return `
            <div class="rp-stop ${safeEsc(status)}">
              <div class="rp-line"></div>
              <div class="rp-dot"></div>
              <div class="rp-label">
                ${safeEsc(name)}
              </div>
            </div>
          `;
        })
        .join("");

    mapWrap.innerHTML = `
      <div
        id="liveMap"
        class="buspal-passenger-map"
      ></div>

      <div class="buspal-passenger-progress">
        <div
          id="passengerTrackingProgressBar"
          style="width:${Math.round(
            timing.progress * 100
          )}%"
        ></div>
      </div>
    `;

    await drawMap(
      booking,
      live,
      root.querySelector(
        "#liveMap"
      )
    );
  }

  /* =======================================================
     MAIN RENDER
     ======================================================= */

  async function renderTracking(root) {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }

    destroyMap();

    root.innerHTML = `
      <div class="empty">
        <div class="ico">◎</div>
        Loading your booked trips…
      </div>
    `;

    try {
      const bookings =
        await BusPalAPI.getBookings();

      console.log("BOOKINGS:", bookings);

      let live = null;

      try {
        live =
          await BusPalAPI.getLiveTrip();
          console.log("LIVE TRIP:", live);
      } catch (error) {
        console.error(
          "[BusPal Passenger Tracking] Live trip failed:",
          error
        );
      }
     
      
      const trackable =
        Array.isArray(bookings)
          ? bookings.filter(
              booking =>
                isTrackableBooking(
                  booking,
                  live
                )
            )
          : [];

      if (!trackable.length) {
        root.innerHTML =
          emptyHTML(
            "No upcoming or active trips to track — search and book a trip first."
          );
        return;
      }

      const selectedStillExists =
        trackable.some(
          booking =>
            String(
              getBookingId(booking)
            ) ===
            String(
              selectedBookingId
            )
        );

      if (!selectedStillExists) {
        selectedBookingId =
          getBookingId(
            trackable[0]
          );
      }

      root.innerHTML = `
        <div
          class="card card-pad"
          style="margin-bottom:20px"
        >
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:20px;
            flex-wrap:wrap;
          ">

            <div>
              <h3 style="margin-bottom:4px">
                Your live trips
              </h3>

              <p
                class="muted small"
                style="margin:0"
              >
                Select one of your booked trips to view its ETA-based live bus location.
              </p>
            </div>

            <div style="
              min-width:300px;
              flex:1;
              max-width:560px;
            ">
              <label
                for="liveTripSelector"
                class="muted small"
                style="
                  display:block;
                  margin-bottom:6px;
                "
              >
                Select trip
              </label>

              <select
                id="liveTripSelector"
                style="width:100%"
              >
                ${trackable.map(
                  booking => {
                    const route =
                      getBookingRoute(
                        booking
                      );

                    const id =
                      getBookingId(
                        booking
                      );

                    return `
                      <option
                        value="${safeEsc(id)}"
                        ${
                          String(id) ===
                          String(selectedBookingId)
                            ? "selected"
                            : ""
                        }
                      >
                        ${safeEsc(
                          route.from
                        )}
                        →
                        ${safeEsc(
                          route.to
                        )}
                        ·
                        ${safeEsc(
                          route.date
                        )}
                        ·
                        ${safeEsc(
                          route.depTime
                        )}
                      </option>
                    `;
                  }
                ).join("")}
              </select>
            </div>
          </div>
        </div>

        <div
          class="buspal-passenger-tracking-layout"
        >
          <div
            class="card card-pad buspal-passenger-map-card"
          >
            <div
              id="tripInfo"
              style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:12px;
                margin-bottom:12px;
              "
            ></div>

            <div id="liveMapWrap">
              <div
                id="liveMap"
                class="buspal-passenger-map"
              ></div>
            </div>

            <div
              class="route-progress"
              id="routeProgress"
              style="margin-top:16px"
            ></div>
          </div>

          <div
            class="card card-pad buspal-passenger-crew-card"
            style="
              display:flex;
              flex-direction:column;
              gap:14px;
            "
          >
            <div id="crewInfo"></div>

            <hr
              style="
                border-color:rgba(148,163,184,.25);
                width:100%;
              "
            />

            <button
              class="btn danger block"
              id="trkSOS"
            >
              ⚠ Emergency SOS
            </button>

            <button
              class="btn block"
              data-go="support"
            >
              ⊘ Report an issue with this trip
            </button>
          </div>
        </div>
      `;

      const selector =
        root.querySelector(
          "#liveTripSelector"
        );

      selector.addEventListener(
        "change",
        async () => {
          selectedBookingId =
            selector.value;

          await loadSelectedBooking();
        }
      );

      root.querySelector(
        "#trkSOS"
      ).addEventListener(
        "click",
        openSOSModal
      );

      $$(
        "[data-go]",
        root
      ).forEach(
        button => {
          button.addEventListener(
            "click",
            () =>
              go(
                button.dataset.go
              )
          );
        }
      );

      async function loadSelectedBooking() {
        const booking =
          trackable.find(
            b =>
              String(
                getBookingId(b)
              ) ===
              String(
                selectedBookingId
              )
          );

        if (!booking) return;

        await showSelectedTrip(
          booking,
          live,
          root
        );
      }

      await loadSelectedBooking();

      refreshTimer =
        setTimeout(
          () => {
            const hash =
              window.location.hash || "";

            if (
              !hash ||
              hash.includes("tracking")
            ) {
              renderTracking(root).catch(
                error =>
                  console.error(
                    "[BusPal Passenger Tracking] Auto refresh failed:",
                    error
                  )
              );
            }
          },
          REFRESH_MS
        );

    } catch (error) {
      console.error(
        "[BusPal Passenger Tracking] Failed:",
        error
      );

      root.innerHTML = `
        <div class="empty">
          <div class="ico">⚠</div>
          <strong style="
            display:block;
            margin-bottom:6px;
            color:var(--text);
          ">
            Unable to load live tracking
          </strong>
          <span>
            ${safeEsc(
              error?.message ||
              "Please refresh the page and try again."
            )}
          </span>
        </div>
      `;
    }
  }

  /* =======================================================
     ROUTE REGISTRATION
     ======================================================= */

  if (typeof ROUTES !== "undefined") {
    ROUTES.tracking = {
      title: "Live Tracking",
      sub: "Follow your booked bus in real time.",
      render: renderTracking
    };
  }

})();
