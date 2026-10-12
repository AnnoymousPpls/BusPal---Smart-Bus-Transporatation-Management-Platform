/* =========================================================
   BusPal — Operator Dashboard — Live Tracking
   =========================================================

   LIVE TRACKING LOGIC

   A trip is considered LIVE only when:

      departureDate + departureTime
                <=
      current time
                <
      departureDate + departureTime + ETA

   Example:

      Departure : 11:00
      ETA       : 2h 45m
      Arrival   : 13:45

      10:59  -> UPCOMING
      11:00  -> LIVE
      13:44  -> LIVE
      13:45  -> FINISHED

   Leaflet
   OpenStreetMap
   ========================================================= */

(() => {

  /* =========================================================
     MODAL / LEAFLET LAYERING FIX
     ========================================================= */

  function ensureTrackingModalLayerFix() {

    if (document.getElementById("buspal-tracking-layer-fix")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "buspal-tracking-layer-fix";

    style.textContent = `

      .live-tracking-map,
      .live-tracking-map .leaflet-container {
        position: relative !important;
        z-index: 1 !important;
      }

      .live-tracking-map .leaflet-pane,
      .live-tracking-map .leaflet-top,
      .live-tracking-map .leaflet-bottom,
      .live-tracking-map .leaflet-control {
        z-index: 2 !important;
      }

      #formModal {
        position: fixed !important;
        z-index: 99999 !important;
      }

      #formModal .modal,
      #formModal .modal-dialog,
      #formModal .modal-content,
      #formModal form {
        position: relative;
        z-index: 100000 !important;
      }

      .tracking-time-box {
        margin-top: 8px;
        padding: 9px 12px;
        border-radius: 10px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        display: inline-flex;
        gap: 14px;
        align-items: center;
        flex-wrap: wrap;
      }

      .tracking-time-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .tracking-time-label {
        font-size: 11px;
        color: #64748b;
      }

      .tracking-time-value {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
      }

      .tracking-status-upcoming {
        background: #fff7ed !important;
        color: #c2410c !important;
      }

      .tracking-status-live {
        background: #dcfce7 !important;
        color: #15803d !important;
      }

      .tracking-status-ended {
        background: #f1f5f9 !important;
        color: #64748b !important;
      }

      .tracking-countdown {
        font-size: 12px;
        font-weight: 600;
        color: #2563eb;
      }

      /* =====================================================
         OPERATOR TRACKING UI
         Match the compact reference interface while keeping
         the automatic ETA-based moving bus marker.
         ===================================================== */

      .tracking-time-box {
        display: flex !important;
        width: fit-content !important;
        max-width: 100%;
        margin-top: 10px !important;
        padding: 10px 14px !important;
        gap: 18px !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        box-sizing: border-box;
      }

      .tracking-time-item {
        min-width: 72px;
      }

      .tracking-time-label {
        font-size: 11px !important;
        line-height: 1.2;
      }

      .tracking-time-value {
        font-size: 13px !important;
        line-height: 1.25;
      }

      .tracking-time-item:last-child .tracking-countdown {
        font-size: 13px;
        font-weight: 700;
      }

      .buspal-bus-marker {
        background: transparent !important;
        border: 0 !important;
      }

      .buspal-bus-marker > div {
        transition: transform .15s linear;
      }

      .buspal-auto-note {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #64748b;
        font-size: 12px;
      }

      .buspal-auto-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #16a34a;
        box-shadow: 0 0 0 3px rgba(22,163,74,.12);
      }

    `;

    document.head.appendChild(style);
  }

  ensureTrackingModalLayerFix();


  /* =========================================================
     TIME HELPERS
     ========================================================= */

  function parseTimeToMinutes(value) {

    if (value === null || value === undefined) {
      return null;
    }

    let text = String(value)
      .trim()
      .toUpperCase();

    if (!text) {
      return null;
    }

    /*
     * Supports:
     *
     * 11:00
     * 11:00 AM
     * 11:00 PM
     * 11.00
     * 11
     */

    const match = text.match(
      /^(\d{1,2})(?:[:.](\d{1,2}))?\s*(AM|PM)?$/
    );

    if (!match) {
      return null;
    }

    let hours = Number(match[1]);

    let minutes = Number(match[2] || 0);

    const period = match[3];

    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes)
    ) {
      return null;
    }

    if (minutes < 0 || minutes > 59) {
      return null;
    }

    if (period) {

      if (hours < 1 || hours > 12) {
        return null;
      }

      if (period === "AM") {

        if (hours === 12) {
          hours = 0;
        }

      } else if (period === "PM") {

        if (hours !== 12) {
          hours += 12;
        }

      }

    } else {

      if (hours < 0 || hours > 23) {
        return null;
      }

    }

    return hours * 60 + minutes;
  }


  /* =========================================================
     CREATE LOCAL DATE FROM DATE + TIME
     ========================================================= */

  function createLocalDate(dateValue, timeValue) {

    if (!dateValue || !timeValue) {
      return null;
    }

    const dateText = String(dateValue).trim();

    const parts = dateText.split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    ) {
      return null;
    }

    const timeMinutes =
      parseTimeToMinutes(timeValue);

    if (timeMinutes === null) {
      return null;
    }

    const hours =
      Math.floor(timeMinutes / 60);

    const minutes =
      timeMinutes % 60;

    /*
     * IMPORTANT:
     *
     * We intentionally use the Date constructor with
     * numeric components instead of:
     *
     * new Date("2026-09-25")
     *
     * because date-only ISO strings are interpreted as UTC.
     *
     * This keeps the BusPal trip time as local browser time.
     */

    const result =
      new Date(
        year,
        month - 1,
        day,
        hours,
        minutes,
        0,
        0
      );

    if (
      Number.isNaN(
        result.getTime()
      )
    ) {
      return null;
    }

    return result;
  }


  /* =========================================================
     GET TRIP TIME INFORMATION
     ========================================================= */

  function getTripTiming(t) {

    const departureAt =
      createLocalDate(
        t.date,
        t.depTime
      );

    const etaMinutes =
      Math.max(
        0,
        Number(
          t.etaMinutes || 0
        )
      );

    if (!departureAt) {

      return {
        valid: false,
        departureAt: null,
        arrivalAt: null,
        etaMinutes,
        state: "unknown",
        remainingMinutes: null,
        elapsedMinutes: null
      };

    }

    const arrivalAt =
      new Date(
        departureAt.getTime() +
        etaMinutes * 60 * 1000
      );

    const now =
      new Date();

    let state;

    if (
      now.getTime() <
      departureAt.getTime()
    ) {

      state = "upcoming";

    } else if (
      now.getTime() <
      arrivalAt.getTime()
    ) {

      state = "live";

    } else {

      state = "ended";

    }

    const remainingMinutes =
      Math.max(
        0,
        Math.ceil(
          (
            arrivalAt.getTime() -
            now.getTime()
          ) /
          60000
        )
      );

    const elapsedMinutes =
      Math.max(
        0,
        Math.floor(
          (
            now.getTime() -
            departureAt.getTime()
          ) /
          60000
        )
      );

    return {

      valid: true,

      departureAt,

      arrivalAt,

      etaMinutes,

      state,

      remainingMinutes,

      elapsedMinutes

    };

  }


  /* =========================================================
     FORMAT TIME
     ========================================================= */

  function formatClock(date) {

    if (!date) {
      return "—";
    }

    return date.toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  }


  /* =========================================================
     FORMAT DATE
     ========================================================= */

  function formatDateForDisplay(date) {

    if (!date) {
      return "—";
    }

    return date.toLocaleDateString(
      [],
      {
        year: "numeric",
        month: "short",
        day: "numeric"
      }
    );

  }


  /* =========================================================
     FORMAT DURATION
     ========================================================= */

  function formatDuration(minutes) {

    const value =
      Math.max(
        0,
        Number(minutes || 0)
      );

    const hours =
      Math.floor(
        value / 60
      );

    const mins =
      value % 60;

    if (hours > 0) {

      return `${hours}h ${mins}m`;

    }

    return `${mins}m`;

  }


  /* =========================================================
     FORMAT ETA
     ========================================================= */

  function formatEta(minutes) {

    return formatDuration(
      minutes
    );

  }


  /* =========================================================
     ESCAPE HTML
     ========================================================= */

  function safeEsc(value) {

    if (
      typeof esc === "function"
    ) {
      return esc(value);
    }

    return String(
      value ?? ""
    )
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );

  }


  /* =========================================================
     OPENSTREETMAP GEOCODING
     ========================================================= */

  async function geocodeOSM(place) {

    const cleanPlace =
      String(
        place || ""
      ).trim();

    if (!cleanPlace) {
      return null;
    }

    try {

      const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=json" +
        "&limit=1" +
        "&countrycodes=lk" +
        "&q=" +
        encodeURIComponent(
          `${cleanPlace}, Sri Lanka`
        );

      const response =
        await fetch(
          url,
          {
            headers: {
              "Accept":
                "application/json"
            }
          }
        );

      if (!response.ok) {

        throw new Error(
          `Geocoding request failed: ${response.status}`
        );

      }

      const results =
        await response.json();

      if (
        !Array.isArray(results) ||
        results.length === 0
      ) {

        console.warn(
          "[BusPal Maps] Could not locate:",
          cleanPlace
        );

        return null;

      }

      return {

        name:
          cleanPlace,

        lat:
          Number(
            results[0].lat
          ),

        lng:
          Number(
            results[0].lon
          ),

        displayName:
          results[0].display_name

      };

    } catch (error) {

      console.error(
        "[BusPal Maps] Geocoding error:",
        cleanPlace,
        error
      );

      return null;

    }

  }


  /* =========================================================
     MAP ERROR
     ========================================================= */

  function showMapError(
    mapElement,
    message
  ) {

    mapElement.innerHTML = `

      <div
        style="
          height:100%;
          display:flex;
          align-items:center;
          justify-content:center;
          text-align:center;
          padding:25px;
          color:#64748b;
          font-size:14px;
          line-height:1.6;
          box-sizing:border-box;
        "
      >

        <div>

          <div
            style="
              font-size:30px;
              margin-bottom:8px;
            "
          >
            🗺️
          </div>

          <strong
            style="
              display:block;
              margin-bottom:5px;
              color:#334155;
            "
          >
            Unable to display route
          </strong>

          <span>
            ${safeEsc(message)}
          </span>

        </div>

      </div>

    `;

  }


  /* =========================================================
     CHECK LEAFLET
     ========================================================= */

  function ensureLeaflet() {

    if (
      typeof L === "undefined"
    ) {

      throw new Error(
        "Leaflet has not been loaded. Add Leaflet CSS and JS before tracking.js."
      );

    }

  }


  /* =========================================================
     CREATE MAP FOR ONE TRIP
     ========================================================= */

  async function initializeTripMap(t) {

    const mapElement =
      document.getElementById(
        `live-map-${t.id}`
      );

    if (!mapElement) {
      return;
    }

    try {

      ensureLeaflet();


      /* -----------------------------------------------------
         GET ALL STOPS
         ----------------------------------------------------- */

      const allStops =
        Array.isArray(
          t.stops
        )
          ? t.stops
          : [];


      const stopNames =
        allStops

          .map(
            s =>
              typeof s === "string"
                ? s
                : s?.name
          )

          .map(
            name =>
              String(
                name || ""
              ).trim()
          )

          .filter(Boolean)

          .filter(
            name =>
              ![
                "en route",
                "enroute",
                "in transit",
                "in-transit"
              ].includes(
                name.toLowerCase()
              )
          );


      if (
        stopNames.length < 2
      ) {

        showMapError(
          mapElement,
          "At least two real locations are required."
        );

        return;

      }


      mapElement.innerHTML = `

        <div
          style="
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#64748b;
            font-size:14px;
          "
        >
          Locating trip stops…
        </div>

      `;


      /* -----------------------------------------------------
         GEOCODE STOPS
         ----------------------------------------------------- */

      const coordinates = [];

      for (
        const stopName of stopNames
      ) {

        const result =
          await geocodeOSM(
            stopName
          );

        if (result) {

          coordinates.push(
            result
          );

        }

        await new Promise(
          resolve =>
            setTimeout(
              resolve,
              250
            )
        );

      }


      if (
        coordinates.length < 2
      ) {

        showMapError(
          mapElement,
          "Could not locate enough trip stops. Check the stop names."
        );

        return;

      }


      /* -----------------------------------------------------
         CREATE MAP
         ----------------------------------------------------- */

      if (typeof mapElement.__buspalBusAnimation === "function") {
        mapElement.__buspalBusAnimation();
        mapElement.__buspalBusAnimation = null;
      }

      if (mapElement.__buspalMap) {
        try {
          mapElement.__buspalMap.remove();
        } catch (error) {
          console.warn("[BusPal Maps] Could not remove old map:", error);
        }
        mapElement.__buspalMap = null;
      }

      mapElement.innerHTML = "";

      const map =
        L.map(
          mapElement,
          {
            zoomControl: true,
            scrollWheelZoom: true
          }
        );


      /* -----------------------------------------------------
         OPENSTREETMAP
         ----------------------------------------------------- */

      L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {
          maxZoom: 19,

          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'

        }

      ).addTo(map);


      /* -----------------------------------------------------
         ROUTE
         ----------------------------------------------------- */

      const routePoints =
        coordinates.map(
          item => [
            item.lat,
            item.lng
          ]
        );


      const routeLine =
        L.polyline(
          routePoints,
          {
            color:
              "#2563eb",

            weight:
              5,

            opacity:
              0.85,

            lineJoin:
              "round",

            lineCap:
              "round"
          }
        ).addTo(map);


      map.fitBounds(
        routeLine.getBounds(),
        {
          padding:
            [35, 35]
        }
      );


      /* -----------------------------------------------------
         STOP MARKERS
         ----------------------------------------------------- */

      coordinates.forEach(
        (
          item,
          index
        ) => {

          const isStart =
            index === 0;

          const isEnd =
            index ===
            coordinates.length - 1;

          let markerColor =
            "#64748b";

          if (isStart) {
            markerColor =
              "#2563eb";
          }

          if (isEnd) {
            markerColor =
              "#16a34a";
          }

          const marker =
            L.circleMarker(

              [
                item.lat,
                item.lng
              ],

              {

                radius:
                  9,

                color:
                  "#ffffff",

                weight:
                  3,

                fillColor:
                  markerColor,

                fillOpacity:
                  1

              }

            ).addTo(map);


          let label =
            "Stop";

          if (isStart) {
            label =
              "Starting point";
          }
          else if (isEnd) {
            label =
              "Destination";
          }


          marker.bindPopup(`

            <div
              style="
                min-width:150px;
                line-height:1.5;
              "
            >

              <strong>
                ${safeEsc(item.name)}
              </strong>

              <br>

              <span
                style="
                  color:#64748b;
                  font-size:12px;
                "
              >
                ${label}
              </span>

            </div>

          `);

        }
      );


      /* =====================================================
         FIND CURRENT STOP
         ===================================================== */

      let currentStopIndex =
        allStops.findIndex(

          s =>

            typeof s === "object" &&
            s !== null &&

            (
              s.status === "current" ||
              s.status === "in-progress"
            )

        );


      if (
        currentStopIndex < 0
      ) {

        currentStopIndex =
          0;

      }


      const currentStopName =

        typeof allStops[
          currentStopIndex
        ] === "string"

          ? allStops[
              currentStopIndex
            ]

          : allStops[
              currentStopIndex
            ]?.name;


      let busCoordinateIndex =
        0;


      if (
        currentStopName
      ) {

        const foundIndex =
          coordinates.findIndex(

            item =>

              item.name
                .toLowerCase() ===

              String(
                currentStopName
              )
                .toLowerCase()

          );


        if (
          foundIndex >= 0
        ) {

          busCoordinateIndex =
            foundIndex;

        }

      }


      /* =====================================================
         BUS ICON + ETA-BASED MOVEMENT
         ===================================================== */

      const busIcon =
        L.divIcon({

          className:
            "buspal-bus-marker",

          html: `

            <div
              style="
                width:42px;
                height:42px;
                border-radius:50%;
                background:#f59e0b;
                border:3px solid #ffffff;
                box-shadow:0 4px 12px rgba(0,0,0,.25);
                display:flex;
                align-items:center;
                justify-content:center;
                font-size:20px;
              "
            >
              🚌
            </div>

          `,

          iconSize:
            [42, 42],

          iconAnchor:
            [21, 21]

        });


      const busStartPosition =
        coordinates[0];

      const busEndPosition =
        coordinates[
          coordinates.length - 1
        ];


      if (busStartPosition) {

        const busMarker =
          L.marker(

            [
              busStartPosition.lat,
              busStartPosition.lng
            ],

            {
              icon:
                busIcon,

              zIndexOffset:
                1000
            }

          ).addTo(map);


        busMarker.bindPopup(`

          <div
            style="
              min-width:170px;
              line-height:1.5;
            "
          >

            <strong>
              🚌 Bus current position
            </strong>

            <br>

            <span
              id="buspal-bus-popup-place-${t.id}"
              style="
                color:#64748b;
                font-size:12px;
              "
            >
              ${safeEsc(busStartPosition.name)}
            </span>

          </div>

        `);


        /*
         * The bus position is calculated from the real clock,
         * not from the 30-second page refresh.
         *
         * 0%   = departure / first stop
         * 100% = expected arrival / final stop
         *
         * This makes the marker move continuously and ensures
         * that it reaches the destination exactly when ETA ends.
         */

        const routeLatLngs =
          coordinates.map(
            point => [
              point.lat,
              point.lng
            ]
          );


        function getBusPositionAtTime(nowMs) {

          const departureAt =
            createLocalDate(
              t.date,
              t.depTime
            );

          const etaMinutes =
            Math.max(
              1,
              Number(
                t.etaMinutes || 1
              )
            );

          if (!departureAt) {
            return {
              lat: busStartPosition.lat,
              lng: busStartPosition.lng,
              progress: 0,
              segmentIndex: 0
            };
          }

          const arrivalMs =
            departureAt.getTime() +
            etaMinutes * 60000;

          const totalDuration =
            Math.max(
              1,
              arrivalMs -
              departureAt.getTime()
            );

          const progress =
            Math.min(
              1,
              Math.max(
                0,
                (
                  nowMs -
                  departureAt.getTime()
                ) /
                totalDuration
              )
            );

          if (progress >= 1) {
            return {
              lat: busEndPosition.lat,
              lng: busEndPosition.lng,
              progress: 1,
              segmentIndex:
                Math.max(
                  0,
                  routeLatLngs.length - 2
                )
            };
          }

          if (progress <= 0) {
            return {
              lat: busStartPosition.lat,
              lng: busStartPosition.lng,
              progress: 0,
              segmentIndex: 0
            };
          }

          const segmentCount =
            Math.max(
              1,
              routeLatLngs.length - 1
            );

          const scaledProgress =
            progress * segmentCount;

          const segmentIndex =
            Math.min(
              segmentCount - 1,
              Math.floor(
                scaledProgress
              )
            );

          const localProgress =
            scaledProgress -
            segmentIndex;

          const a =
            routeLatLngs[
              segmentIndex
            ];

          const b =
            routeLatLngs[
              segmentIndex + 1
            ];

          return {
            lat:
              a[0] +
              (b[0] - a[0]) *
              localProgress,
            lng:
              a[1] +
              (b[1] - a[1]) *
              localProgress,
            progress,
            segmentIndex
          };

        }


        let animationFrame =
          null;


        function updateBusMarker() {

          const position =
            getBusPositionAtTime(
              Date.now()
            );

          busMarker.setLatLng([
            position.lat,
            position.lng
          ]);

          /*
           * Keep the map's current view stable. The marker moves,
           * but the map does not constantly re-center or zoom.
           */

          animationFrame =
            requestAnimationFrame(
              updateBusMarker
            );

        }


        updateBusMarker();


        mapElement.__buspalBusMarker =
          busMarker;

        mapElement.__buspalBusAnimation =
          () => {

            if (animationFrame) {
              cancelAnimationFrame(
                animationFrame
              );
            }

          };

        mapElement.__buspalGetBusPosition =
          getBusPositionAtTime;

      }


      mapElement.__buspalMap =
        map;

      mapElement.__buspalCoordinates =
        coordinates;

      mapElement.__buspalRoutePoints =
        routePoints;

      console.log(
        "[BusPal Maps] Map initialized:",
        `${t.from} → ${t.to}`,
        coordinates
      );


    } catch (error) {

      console.error(
        "[BusPal Maps] Initialization failed:",
        error
      );

      showMapError(
        mapElement,
        error?.message ||
        "Unable to display the map."
      );

    }

  }


  /* =========================================================
     INITIALIZE MAPS
     ========================================================= */

  function initializeAllMaps(
    active
  ) {

    if (
      !Array.isArray(active) ||
      !active.length
    ) {

      return;

    }

    requestAnimationFrame(
      () => {

        active.forEach(
          t => {

            initializeTripMap(
              t
            );

          }
        );

      }
    );

  }


  /* =========================================================
     AUTO-FINISH EXPIRED TRIPS
     ========================================================= */

  async function finishExpiredTrips(
    liveTrips
  ) {

    if (
      !Array.isArray(liveTrips)
    ) {
      return false;
    }

    const expired =
      liveTrips.filter(
        t => {

          if (
            t.status !==
            "in-progress"
          ) {
            return false;
          }

          const timing =
            getTripTiming(t);

          return (
            timing.valid &&
            timing.state ===
            "ended"
          );

        }
      );


    if (
      !expired.length
    ) {

      return false;

    }


    let changed =
      false;


    for (
      const trip of expired
    ) {

      try {

        await BusPalAPI.endLiveTrip(
          trip.id
        );

        changed =
          true;

        console.log(
          "[BusPal Tracking] Automatically ended expired trip:",
          trip.id
        );

      } catch (error) {

        console.error(
          "[BusPal Tracking] Could not automatically end expired trip:",
          trip.id,
          error
        );

      }

    }


    return changed;

  }


  /* =========================================================
     RENDER TRACKING PAGE
     ========================================================= */

  async function renderTracking(
    root
  ) {

    root.innerHTML = `

      <div class="empty">

        <div class="ico">
          ◎
        </div>

        Loading…

      </div>

    `;


    let [
      trips,
      liveTrips
    ] = await Promise.all([

      BusPalAPI.getTrackableTrips(),

      BusPalAPI.getLiveTrips()

    ]);


    /* =======================================================
       AUTOMATICALLY FINISH TRIPS AFTER ARRIVAL TIME
       ======================================================= */

    const expiredTripsFinished =
      await finishExpiredTrips(
        liveTrips
      );


    /*
     * Reload live trips after automatically
     * ending expired trips.
     */

    if (
      expiredTripsFinished
    ) {

      liveTrips =
        await BusPalAPI.getLiveTrips();

    }


    /* =======================================================
       ONLY ACTUALLY LIVE TRIPS
       ======================================================= */

    const active =
      liveTrips.filter(
        t => {

          if (
            t.status !==
            "in-progress"
          ) {
            return false;
          }

          const timing =
            getTripTiming(t);

          /*
           * This is the important change.
           *
           * status = in-progress alone
           * is NOT enough.
           */

          return (
            timing.valid &&
            timing.state ===
            "live"
          );

        }
      );


    /* =======================================================
       UPCOMING TRACKING
       ======================================================= */

    const upcoming =
      liveTrips.filter(
        t => {

          if (
            t.status !==
            "in-progress"
          ) {
            return false;
          }

          const timing =
            getTripTiming(t);

          return (
            timing.valid &&
            timing.state ===
            "upcoming"
          );

        }
      );


    root.innerHTML = `

      <div
        class="section-toolbar"
      >

        <div>

          <h3
            style="
              margin-bottom:2px
            "
          >
            Live Tracking
          </h3>

          <p
            class="muted small"
            style="
              margin-top:2px
            "
          >
            A trip becomes live at its departure time and automatically ends when departure time + ETA is reached.
          </p>

        </div>

        <div
          style="
            display:flex;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
          "
        >

          <button
            class="btn"
            id="generateTrackingReportBtn"
            type="button"
          >
            ▣ Generate Report
          </button>

          <button
            class="btn brand"
            id="startTrackingBtn"
            type="button"
          >
            + Start tracking a trip
          </button>

        </div>

      </div>


      <!-- ===================================================
           LIVE TRIPS
           =================================================== -->

      <h3
        style="
          margin-bottom:10px
        "
      >
        Currently live
      </h3>

      <div
        id="activeListWrap"
        style="
          display:flex;
          flex-direction:column;
          gap:14px;
          margin-bottom:22px
        "
      ></div>


      <!-- ===================================================
           UPCOMING
           =================================================== -->

      <h3
        style="
          margin-bottom:10px
        "
      >
        Upcoming tracking
      </h3>

      <div
        id="upcomingListWrap"
        style="
          display:flex;
          flex-direction:column;
          gap:14px;
          margin-bottom:22px
        "
      ></div>


      <!-- ===================================================
           COMPLETED
           =================================================== -->

      <h3
        style="
          margin-bottom:10px
        "
      >
        Recently completed
      </h3>

      <div
        id="completedListWrap"
      ></div>

    `;


    /* =======================================================
       DRAW
       ======================================================= */

    function draw() {

      /* -----------------------------------------------------
         ACTIVE
         ----------------------------------------------------- */

      $(
        "#activeListWrap",
        root
      ).innerHTML =

        active.length

          ? active
              .map(
                t =>
                  trackingCardHTML(
                    t
                  )
              )
              .join("")

          : emptyHTML(
              "No trips are currently live."
            );


      /* -----------------------------------------------------
         UPCOMING
         ----------------------------------------------------- */

      $(
        "#upcomingListWrap",
        root
      ).innerHTML =

        upcoming.length

          ? upcoming
              .map(
                t =>
                  trackingCardHTML(
                    t,
                    true
                  )
              )
              .join("")

          : emptyHTML(
              "No upcoming tracked trips."
            );


      bindCardActions();


      /* -----------------------------------------------------
         COMPLETED
         ----------------------------------------------------- */

      const completed =
        liveTrips

          .filter(
            t =>
              t.status ===
              "completed"
          )

          .slice(
            0,
            6
          );


      $(
        "#completedListWrap",
        root
      ).innerHTML =

        completed.length

          ? `

            <div
              class="table-wrap"
            >

              <table
                class="data-table"
              >

                <thead>

                  <tr>

                    <th>
                      Route
                    </th>

                    <th>
                      Date
                    </th>

                    <th>
                      Departure
                    </th>

                    <th>
                      Arrival
                    </th>

                    <th>
                      Bus
                    </th>

                    <th>
                    </th>

                  </tr>

                </thead>

                <tbody>

                  ${completed
                    .map(
                      t => {

                        const timing =
                          getTripTiming(
                            t
                          );

                        return `

                          <tr>

                            <td
                              class="cell-strong"
                            >

                              ${safeEsc(
                                t.from
                              )}

                              →

                              ${safeEsc(
                                t.to
                              )}

                            </td>


                            <td
                              class="cell-mono"
                            >

                              ${safeEsc(
                                t.date
                              )}

                            </td>


                            <td>

                              ${
                                timing.valid
                                  ? formatClock(
                                      timing.departureAt
                                    )
                                  : safeEsc(
                                      t.depTime
                                    )
                              }

                            </td>


                            <td>

                              ${
                                timing.valid
                                  ? formatClock(
                                      timing.arrivalAt
                                    )
                                  : "—"
                              }

                            </td>


                            <td>

                              ${safeEsc(
                                t.busPlate ||
                                "—"
                              )}

                            </td>


                            <td
                              class="td-actions"
                            >

                              <button
                                class="icon-btn danger"
                                title="Delete record"
                                data-del-live="${t.id}"
                              >
                                🗑
                              </button>

                            </td>

                          </tr>

                        `;

                      }
                    )
                    .join("")}

                </tbody>

              </table>

            </div>

          `

          : emptyHTML(
              "No completed trips yet."
            );


      /* -----------------------------------------------------
         DELETE COMPLETED TRIP
         ----------------------------------------------------- */

      $$(
        "[data-del-live]",
        root
      ).forEach(

        b =>

          b.addEventListener(
            "click",
            () => {

              confirmAction(

                "Delete this tracking record?",

                async () => {

                  await BusPalAPI.deleteLiveTrip(
                    b.dataset.delLive
                  );

                  toast(
                    "Record deleted."
                  );

                  go(
                    "tracking"
                  );

                }

              );

            }

          )

      );

    }


    /* =======================================================
       TRACKING CARD
       ======================================================= */

    function trackingCardHTML(
      t,
      isUpcoming = false
    ) {

      const stops =
        Array.isArray(
          t.stops
        )
          ? t.stops
          : [];


      const doneCount =
        stops.filter(

          s =>

            s &&
            typeof s === "object" &&
            s.status === "done"

        ).length;


      const visible =
        t.visible !== false;


      const timing =
        getTripTiming(
          t
        );


      let state =
        timing.state;


      let stateText =
        "Tracking";


      let stateClass =
        "tracking-status-live";


      if (
        state ===
        "upcoming"
      ) {

        stateText =
          "Starts at departure";

        stateClass =
          "tracking-status-upcoming";

      }
      else if (
        state ===
        "live"
      ) {

        stateText =
          "LIVE NOW";

        stateClass =
          "tracking-status-live";

      }
      else if (
        state ===
        "ended"
      ) {

        stateText =
          "Trip finished";

        stateClass =
          "tracking-status-ended";

      }


      return `

        <div
          class="card card-pad buspal-tracking-card"
        >


          <!-- HEADER -->

          <div
            style="
              display:flex;
              justify-content:space-between;
              align-items:flex-start;
              flex-wrap:wrap;
              gap:10px;
              margin-bottom:12px
            "
          >

            <div>

              <div
                class="route-title"
              >

                ${safeEsc(
                  t.from
                )}

                <span
                  class="hc-arrow"
                >
                  →
                </span>

                ${safeEsc(
                  t.to
                )}

                <span
                  class="pill ${stateClass}"
                >
                  ${stateText}
                </span>

              </div>


              <div
                class="route-meta"
              >

                ${safeEsc(
                  t.date
                )}

                ·

                ${safeEsc(
                  t.depTime
                )}

                ·

                ${safeEsc(
                  t.busPlate ||
                  "Bus TBA"
                )}

                ${
                  t.driverName

                    ? " · Driver " +
                      safeEsc(
                        t.driverName
                      )

                    : ""
                }

              </div>


              ${
                timing.valid

                  ? `

                    <div
                      class="tracking-time-box"
                    >

                      <div
                        class="tracking-time-item"
                      >

                        <span
                          class="tracking-time-label"
                        >
                          Departure
                        </span>

                        <span
                          class="tracking-time-value"
                        >
                          ${formatClock(
                            timing.departureAt
                          )}
                        </span>

                      </div>


                      <div
                        class="tracking-time-item"
                      >

                        <span
                          class="tracking-time-label"
                        >
                          ETA
                        </span>

                        <span
                          class="tracking-time-value"
                        >
                          ${formatEta(
                            timing.etaMinutes
                          )}
                        </span>

                      </div>


                      <div
                        class="tracking-time-item"
                      >

                        <span
                          class="tracking-time-label"
                        >
                          Expected arrival
                        </span>

                        <span
                          class="tracking-time-value"
                        >
                          ${formatClock(
                            timing.arrivalAt
                          )}
                        </span>

                      </div>


                      ${
                        state ===
                        "live"

                          ? `

                            <div
                              class="tracking-time-item"
                            >

                              <span
                                class="tracking-time-label"
                              >
                                Remaining
                              </span>

                              <span
                                class="tracking-countdown"
                              >
                                ${formatDuration(
                                  timing.remainingMinutes
                                )}
                              </span>

                            </div>

                          `

                          : ""

                      }

                    </div>

                  `

                  : ""

              }

            </div>


            <div
              style="
                display:flex;
                align-items:center;
                gap:10px
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
                  data-toggle-visible="${t.id}"
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


              ${
                state ===
                "live"

                  ? `

                    <span
                      class="badge info"
                    >
                      LIVE · ${formatEta(
                        timing.remainingMinutes
                      )}
                    </span>

                  `

                  : state ===
                    "upcoming"

                    ? `

                      <span
                        class="badge info"
                      >
                        Starts ${formatClock(
                          timing.departureAt
                        )}
                      </span>

                    `

                    : ""

              }

            </div>

          </div>


          <!-- MAP -->

          ${
            state ===
            "live"

              ? `

                <div
                  class="live-tracking-map"
                  id="live-map-${t.id}"
                >

                  <div
                    style="
                      height:100%;
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      color:#64748b;
                      font-size:14px;
                    "
                  >
                    Loading map…
                  </div>

                </div>

              `

              : `

                <div
                  class="live-tracking-map"
                  style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    text-align:center;
                    color:#64748b;
                    background:#f8fafc;
                  "
                >

                  <div>

                    <div
                      style="
                        font-size:30px;
                        margin-bottom:8px;
                      "
                    >
                      ${
                        state ===
                        "upcoming"
                          ? "🕐"
                          : "🏁"
                      }
                    </div>

                    <strong
                      style="
                        display:block;
                        color:#334155;
                        margin-bottom:5px;
                      "
                    >

                      ${
                        state ===
                        "upcoming"

                          ? "Live tracking has not started yet"

                          : "Live tracking has ended"

                      }

                    </strong>

                    <span>

                      ${
                        state ===
                        "upcoming"

                          ? `Tracking starts at ${formatClock(
                              timing.departureAt
                            )}.`

                          : `Tracking ended at ${formatClock(
                              timing.arrivalAt
                            )}.`

                      }

                    </span>

                  </div>

                </div>

              `


          }


          <!-- ETA + ACTIONS -->

          <div
            class="section-toolbar"
            style="
              margin-top:14px
            "
          >


            <div
              class="filters"
              style="
                align-items:center
              "
            >

              <span
                class="muted small"
              >
                ETA:
              </span>


              <input
                class="filter-input"
                type="number"
                min="0"
                placeholder="hrs"
                style="width:64px"
                value="${Math.floor(
                  Number(
                    t.etaMinutes || 0
                  ) / 60
                )}"
                data-eta-hours="${t.id}"
              />


              <input
                class="filter-input"
                type="number"
                min="0"
                max="59"
                placeholder="min"
                style="width:64px"
                value="${
                  Number(
                    t.etaMinutes || 0
                  ) % 60
                }"
                data-eta-mins="${t.id}"
              />


              <button
                class="btn sm"
                data-save-eta="${t.id}"
              >
                Update ETA
              </button>

            </div>


            <div
              style="
                display:flex;
                gap:8px
              "
            >

              ${
                state ===
                "live"

                  ? `

                    <span
                      class="buspal-auto-note"
                      style="align-self:center"
                    >
                      <span class="buspal-auto-dot"></span>
                      Bus position follows ETA automatically
                    </span>

                  `

                  : state ===
                    "upcoming"

                    ? `

                      <span
                        class="muted small"
                        style="align-self:center"
                      >
                        Waiting for departure
                      </span>

                    `

                    : `

                      <span
                        class="muted small"
                        style="align-self:center"
                      >
                        Trip completed
                      </span>

                    `

              }


              ${
                state ===
                "live"

                  ? `

                    <button
                      class="btn sm danger"
                      data-end="${t.id}"
                    >
                      End trip
                    </button>

                  `

                  : ""

              }

            </div>

          </div>

        </div>

      `;

    }


    /* =======================================================
       CARD ACTIONS
       ======================================================= */

    function bindCardActions() {


      /* -----------------------------------------------------
         END TRIP
         ----------------------------------------------------- */

      $$(
        "[data-end]",
        root
      ).forEach(

        b =>

          b.addEventListener(
            "click",
            () => {

              confirmAction(

                "End tracking for this trip? Passengers will stop seeing live progress.",

                async () => {

                  await BusPalAPI.endLiveTrip(
                    b.dataset.end
                  );

                  toast(
                    "Trip tracking ended."
                  );

                  go(
                    "tracking"
                  );

                }

              );

            }

          )

      );


      /* -----------------------------------------------------
         UPDATE ETA
         ----------------------------------------------------- */

      $$(
        "[data-save-eta]",
        root
      ).forEach(

        b =>

          b.addEventListener(
            "click",
            async () => {

              const id =
                b.dataset.saveEta;


              const hrs =
                Number(
                  $(
                    `[data-eta-hours="${id}"]`,
                    root
                  ).value
                ) || 0;


              const mins =
                Number(
                  $(
                    `[data-eta-mins="${id}"]`,
                    root
                  ).value
                ) || 0;


              if (
                hrs < 0 ||
                mins < 0 ||
                mins > 59
              ) {

                toast(
                  "Enter a valid ETA."
                );

                return;

              }


              const etaMinutes =
                Math.max(
                  0,
                  hrs * 60 + mins
                );


              await BusPalAPI.updateLiveTrip(

                id,

                {
                  etaMinutes
                }

              );


              toast(
                "ETA updated."
              );


              go(
                "tracking"
              );

            }

          )

      );


      /* -----------------------------------------------------
         PASSENGER VISIBILITY
         ----------------------------------------------------- */

      $$(
        "[data-toggle-visible]",
        root
      ).forEach(

        el =>

          el.addEventListener(
            "change",
            async () => {

              await BusPalAPI.toggleLiveTripVisibility(
                el.dataset.toggleVisible
              );

              toast(
                "Visibility updated."
              );

              go(
                "tracking"
              );

            }

          )

      );

    }


    /* =======================================================
       START TRACKING BUTTON
       ======================================================= */

    /* =======================================================
       GENERATE TRACKING REPORT
       ======================================================= */

    const reportButton = $(
      "#generateTrackingReportBtn",
      root
    );

    if (reportButton) {

      reportButton.addEventListener(
        "click",
        async () => {

          try {

            if (
              typeof window.generateTrackingReport !==
              "function"
            ) {
              throw new Error(
                "Tracking report generator is not loaded."
              );
            }

            reportButton.disabled = true;
            reportButton.textContent =
              "Generating Report…";

            await window.generateTrackingReport({
              trips,
              liveTrips
            });

          } catch (error) {

            console.error(
              "[BusPal Tracking] Report generation failed:",
              error
            );

            if (typeof toast === "function") {
              toast(
                "Could not generate the Tracking report."
              );
            }

          } finally {

            reportButton.disabled = false;
            reportButton.textContent =
              "▣ Generate Report";

          }

        }
      );

    }


    /* =======================================================
       START TRACKING BUTTON
       ======================================================= */

    $(
      "#startTrackingBtn",
      root
    ).addEventListener(
      "click",
      () =>
        openStartTrackingForm(
          trips
        )
    );


    draw();


    /* =======================================================
       ONLY INITIALIZE MAPS FOR ACTUALLY LIVE TRIPS
       ======================================================= */

    initializeAllMaps(
      active
    );


    /* =======================================================
       ROUTES & SCHEDULES SHORTCUT
       ======================================================= */

    if (
      window.__pendingTrackTrip
    ) {

      const pending =
        window.__pendingTrackTrip;

      window.__pendingTrackTrip =
        null;


      const idx =
        trips.findIndex(

          t =>

            t.routeId ===
              pending.routeId &&

            t.depId ===
              pending.depId

        );


      if (
        idx >= 0
      ) {

        openStartTrackingForm(
          trips,
          idx
        );

      }

    }


    /* =======================================================
       AUTO REFRESH
       ======================================================= */

    /*
     * Re-render every 30 seconds.
     *
     * This means:
     *
     * 10:59 -> upcoming
     * 11:00 -> live
     * 13:45 -> automatically completed
     *
     * without the operator manually refreshing.
     */

    if (
      window.__buspalTrackingTimer
    ) {

      clearInterval(
        window.__buspalTrackingTimer
      );

    }


    window.__buspalTrackingTimer =
      setInterval(
        async () => {

          /*
           * Only refresh if this page is
           * still the tracking page.
           */

          const currentHash =
            window.location.hash || "";

          if (
            currentHash &&
            !currentHash.includes(
              "tracking"
            )
          ) {

            return;

          }

          try {

            await renderTracking(
              root
            );

          } catch (error) {

            console.error(
              "[BusPal Tracking] Auto refresh failed:",
              error
            );

          }

        },
        30000
      );

  }


  /* =========================================================
     START TRACKING FORM
     ========================================================= */

  function openStartTrackingForm(
    trips,
    preselectIndex
  ) {

    if (
      !trips.length
    ) {

      toast(
        "Add a route with departures first, under Routes & Schedules."
      );

      return;

    }


    const body =
      openForm(

        "Start tracking a trip",

        `

          <form
            id="startTrackingForm"
            class="form-grid"
          >

            <div
              class="field-v"
            >

              <label
                for="ltTrip"
              >
                Trip
              </label>

              <select
                id="ltTrip"
              >

                ${trips
                  .map(
                    (
                      t,
                      i
                    ) => `

                      <option
                        value="${i}"
                        ${
                          preselectIndex === i
                            ? "selected"
                            : ""
                        }
                      >

                        ${safeEsc(
                          t.from
                        )}

                        →

                        ${safeEsc(
                          t.to
                        )}

                        ·

                        ${safeEsc(
                          t.time
                        )}

                        (${safeEsc(
                          t.busPlate ||
                          "Bus TBA"
                        )})

                      </option>

                    `
                  )
                  .join("")}

              </select>

            </div>


            <div
              class="field-v"
            >

              <label
                for="ltDate"
              >
                Travel date
              </label>

              <input
                type="date"
                id="ltDate"
                value="${
                  new Date()
                    .toISOString()
                    .slice(
                      0,
                      10
                    )
                }"
              />

            </div>


            <div
              class="field-v"
            >

              <label>
                Initial ETA
              </label>

              <div
                class="row-2"
              >

                <input
                  type="text"
                  inputmode="numeric"
                  id="ltEtaHrs"
                  placeholder="Hours"
                  value="2"
                />

                <input
                  type="text"
                  inputmode="numeric"
                  id="ltEtaMins"
                  placeholder="Minutes"
                  value="45"
                />

              </div>

              <span
                class="field-hint"
              >
                ETA is the trip duration from departure. Expected arrival = departure time + ETA.
              </span>

            </div>


            <div
              class="field-v"
            >

              <label
                for="ltStops"
              >
                Stops (comma-separated, in order)
              </label>

              <input
                type="text"
                id="ltStops"
                placeholder="Colombo Fort, Kadawatha, Kegalle, Kandy"
              />

              <span
                class="field-hint"
              >
                First stop starts as "current", last stop is the destination.
              </span>

            </div>


            <button
              class="btn brand"
              type="submit"
            >
              Start tracking
            </button>

          </form>

        `

      );


    /* -------------------------------------------------------
       MODAL ABOVE LEAFLET
       ------------------------------------------------------- */

    requestAnimationFrame(
      () => {

        const modal =
          document.getElementById(
            "formModal"
          );

        if (modal) {

          modal.style.setProperty(
            "position",
            "fixed",
            "important"
          );

          modal.style.setProperty(
            "z-index",
            "99999",
            "important"
          );

        }

        if (
          modal?.parentElement
        ) {

          modal.parentElement.style.setProperty(
            "z-index",
            "99998",
            "important"
          );

        }

      }
    );


    /* =======================================================
       DEFAULT STOPS
       ======================================================= */

    function fillDefaultStops() {

      const selectedTrip =
        trips[
          Number(
            $(
              "#ltTrip",
              body
            ).value
          )
        ];


      if (
        !selectedTrip
      ) {

        return;

      }


      $(
        "#ltStops",
        body
      ).value =

        `${selectedTrip.from}, En route, ${selectedTrip.to}`;

    }


    $(
      "#ltTrip",
      body
    ).addEventListener(
      "change",
      fillDefaultStops
    );


    fillDefaultStops();


    /* =======================================================
       SUBMIT
       ======================================================= */

    $(
      "#startTrackingForm",
      body
    ).addEventListener(

      "submit",

      async e => {

        e.preventDefault();


        const selectedTrip =
          trips[
            Number(
              $(
                "#ltTrip",
                body
              ).value
            )
          ];


        if (
          !selectedTrip
        ) {

          toast(
            "Please select a trip."
          );

          return;

        }


        const stops =
          $(
            "#ltStops",
            body
          )
            .value
            .split(",")

            .map(
              s =>
                s.trim()
            )

            .filter(Boolean);


        if (
          stops.length < 2
        ) {

          toast(
            "Enter at least a start and end stop."
          );

          return;

        }


        const hrs =
          Number(
            $(
              "#ltEtaHrs",
              body
            ).value
          ) || 0;


        const mins =
          Number(
            $(
              "#ltEtaMins",
              body
            ).value
          ) || 0;


        if (
          hrs < 0 ||
          mins < 0 ||
          mins > 59
        ) {

          toast(
            "Enter a valid ETA."
          );

          return;

        }


        const etaMinutes =
          hrs * 60 +
          mins;


        if (
          etaMinutes <= 0
        ) {

          toast(
            "ETA must be greater than 0 minutes."
          );

          return;

        }


        await BusPalAPI.startLiveTrip({

          from:
            selectedTrip.from,

          to:
            selectedTrip.to,

          date:
            $(
              "#ltDate",
              body
            ).value,

          depTime:
            selectedTrip.time,

          busPlate:
            selectedTrip.busPlate,

          driverName:
            selectedTrip.driverName,

          conductorName:
            selectedTrip.conductorName,

          etaMinutes:
            etaMinutes,

          stops

        });


        closeModal(
          "formModal"
        );


        toast(
          "Tracking scheduled. It will become live at the departure time."
        );


        go(
          "tracking"
        );

      }

    );

  }


  /* =========================================================
     ROUTE REGISTRATION
     ========================================================= */

  ROUTES_MAP.tracking = {

    title:
      "Live Tracking",

    sub:
      "Live tracking starts at departure time and ends automatically at departure time + ETA.",

    render:
      renderTracking

  };

})();