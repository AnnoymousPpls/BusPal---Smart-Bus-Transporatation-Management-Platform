/* ============================================================
   BusPal — Operator Dashboard
   Real PHP + MySQL API layer.

   Keeps the existing OpsAPI function names so the existing
   operator pages do not need unnecessary rewrites.
   ============================================================ */

const OpsAPI = (() => {
  const API_BASE = "http://localhost/buspal-backend-php/api";

  async function request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = AuthStore.getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error) {
      console.error("OpsAPI connection error:", error);
      throw new Error(
        "Unable to connect to the BusPal server. Make sure WAMP and Apache are running."
      );
    }

    let body = null;

    try {
      body = await response.json();
    } catch {
      throw new Error(
        `Server returned an invalid response (HTTP ${response.status}).`
      );
    }

    if (!response.ok || body?.success === false) {
      throw new Error(
        body?.message ||
        body?.error ||
        `Request failed with status ${response.status}.`
      );
    }

    return body?.data ?? body;
  }

  function post(endpoint, payload) {
    return request(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

 function patchRequest(endpoint, payload) {
  return request(endpoint, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function uploadStaffPhoto(staffId, file) {
  const formData = new FormData();

  formData.append(
    "staffId",
    String(staffId)
  );

  formData.append(
    "photo",
    file
  );

  const headers = {};

  const token = AuthStore.getToken();

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  let response;

  try {
    response = await fetch(
      `${API_BASE}/staff/photos.php`,
      {
        method: "POST",
        headers,
        body: formData,
      }
    );
  } catch (error) {
    console.error(
      "Staff photo upload error:",
      error
    );

    throw new Error(
      "Unable to upload the staff photo."
    );
  }

  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Server returned an invalid response (HTTP ${response.status}).`
    );
  }

  if (
    !response.ok ||
    body?.success === false
  ) {
    throw new Error(
      body?.message ||
      body?.error ||
      `Photo upload failed (HTTP ${response.status}).`
    );
  }

  return body?.data ?? body;
}
  function remove(endpoint) {
    return request(endpoint, {
      method: "DELETE",
    });
  }

  function normaliseId(value) {
    return value == null || value === ""
      ? null
      : Number(value);
  }

  function normaliseBus(bus) {
    return {
      ...bus,
      id: normaliseId(bus.id),
      capacity: Number(bus.capacity || 0),
      odometer: Number(bus.odometer || 0),
      maintenanceIntervalKm: Number(
        bus.maintenanceIntervalKm ||
        bus.maintenance_interval_km ||
        10000
      ),
      photos: Array.isArray(bus.photos)
        ? bus.photos.map(photo => {
            if (typeof photo === "string") {
              return {
                id: null,
                path: photo,
              };
            }

            return {
              id: normaliseId(photo.id),
              path: photo.path || "",
            };
          })
        : [],
    };
  }

  function normaliseStaff(staff) {
  return {
    ...staff,

    // Always use numeric IDs in the frontend.
    id: normaliseId(staff.id),

    // Explicit frontend field names.
    name: staff.name ?? "",
    role: staff.role ?? "",
    phone: staff.phone ?? "",

    // PHP/MySQL may return either camelCase or snake_case.
    ntcLicense:
      staff.ntcLicense ??
      staff.ntc_license ??
      "",

    drivingLicense:
      staff.drivingLicense ??
      staff.driving_license ??
      "",

    licenseExpiry:
      staff.licenseExpiry ??
      staff.license_expiry ??
      "",

    photo: (() => {
  const path =
    staff.photo ??
    staff.photo_path ??
    null;

  if (!path) {
    return null;
  }

  if (
    path.startsWith("http://") ||
    path.startsWith("https://")
  ) {
    return path;
  }

  return `${API_BASE.replace("/api", "")}/${String(path).replace(/^\/+/, "")}`;
})(),

    photoVisible: Boolean(
      staff.photoVisible ??
      staff.photo_visible ??
      true
    ),

    status: staff.status ?? "active",
  };
}
  function normaliseRoute(route) {
  return {
    ...route,

    id: normaliseId(route.id),

    from: route.from ?? route.from_city ?? "",
    to: route.to ?? route.to_city ?? "",

    distanceKm: Number(
      route.distanceKm ??
      route.distance_km ??
      0
    ),

    fare: Number(route.fare || 0),

    visible: Boolean(route.visible),

    departures: Array.isArray(route.departures)
      ? route.departures.map(dep => ({
          ...dep,

          id: normaliseId(dep.id),

          busId: normaliseId(
            dep.busId ?? dep.bus_id
          ),

          driverId: normaliseId(
            dep.driverId ?? dep.driver_id
          ),

          conductorId: normaliseId(
            dep.conductorId ?? dep.conductor_id
          ),

          time: dep.time
            ? String(dep.time).slice(0, 5)
            : "",
        }))
      : [],
  };
}

  function normaliseFuel(entry) {
    return {
      ...entry,
      id: normaliseId(entry.id),
      busId: normaliseId(entry.busId),
      liters: Number(entry.liters || 0),
      cost: Number(entry.cost || 0),
      odometer: Number(entry.odometer || 0),
    };
  }

  function normaliseMaintenance(entry) {
    return {
      ...entry,
      id: normaliseId(entry.id),
      busId: normaliseId(entry.busId),
      odometer: Number(entry.odometer || 0),
    };
  }

  function normaliseBooking(booking) {
    return {
      ...booking,
      id: normaliseId(booking.id),
      price: Number(booking.price || 0),
      seats: Array.isArray(booking.seats)
        ? booking.seats.map(String)
        : [],
    };
  }

  function normaliseLiveTrip(trip) {
    return {
      ...trip,
      id: normaliseId(trip.id),
      etaMinutes: Number(trip.etaMinutes || 0),
      currentStopIndex: Number(
        trip.currentStopIndex || 0
      ),
      stops: Array.isArray(trip.stops)
        ? trip.stops
        : [],
    };
  }

  function formatBusLabel(bus) {
    return bus
      ? `${bus.plate} · ${bus.model}`
      : "Unassigned";
  }

  async function getBusesInternal() {
    const data = await request("/buses/index.php");

    return Array.isArray(data)
      ? data.map(normaliseBus)
      : [];
  }

  async function getStaffInternal() {
    const data = await request("/staff/index.php");

    return Array.isArray(data)
      ? data.map(normaliseStaff)
      : [];
  }

  async function getRoutesInternal() {
    const data = await request("/routes/index.php");

    return Array.isArray(data)
      ? data.map(normaliseRoute)
      : [];
  }

  return {

    // ==========================================================
    // OPERATOR PROFILE
    // ==========================================================

   getOperator: async () => {
  const session = AuthStore.getSession();

  let team = [];

  try {
    const data = await request("/auth/team.php");
    team = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Unable to load operator account:", error);
  }

  // Match the logged-in account by email first.
  const sessionEmail = String(
    session?.email || ""
  ).trim().toLowerCase();

  const account = team.find(
    a =>
      String(a.email || "")
        .trim()
        .toLowerCase() === sessionEmail
  ) || team.find(
    a =>
      Number(a.id) === Number(session?.id)
  );

  return {
    id:
      account?.id ??
      session?.id ??
      null,

    name:
      account?.name ||
      session?.name ||
      "Operator",

    company:
      "BT Express (Pvt) Ltd",

    email:
      account?.email ||
      session?.email ||
      "",

    phone:
      account?.phone ||
      session?.phone ||
      "",

    initials:
      (
        account?.name ||
        session?.name ||
        "Operator"
      )
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
  };
},

    // ==========================================================
    // OVERVIEW
    // ==========================================================

    getOverviewStats: async () => {
      const [
        buses,
        routes,
        staff,
        fuelLog,
        feedback,
        sos
      ] = await Promise.all([
        getBusesInternal(),
        getRoutesInternal(),
        getStaffInternal(),
        request("/fuel/index.php"),
        request("/feedback/index.php"),
        request("/sos/index.php"),
      ]);

      const fuel = Array.isArray(fuelLog)
        ? fuelLog.map(normaliseFuel)
        : [];

      const feedbackRows = Array.isArray(feedback)
        ? feedback
        : [];

      const sosRows = Array.isArray(sos)
        ? sos
        : [];

      const currentMonth = new Date()
        .toISOString()
        .slice(0, 7);

      const fuelSpendMonth = fuel
        .filter(entry =>
          String(entry.date || "").slice(0, 7) === currentMonth
        )
        .reduce(
          (sum, entry) => sum + Number(entry.cost || 0),
          0
        );

      return {
        buses: buses.length,
        activeBuses: buses.filter(
          bus => bus.status === "active"
        ).length,

        routes: routes.length,

        visibleRoutes: routes.filter(
          route => route.visible
        ).length,

        staff: staff.length,

        openFeedback: feedbackRows.filter(
          item => item.status === "open"
        ).length,

        openSOS: sosRows.filter(
          item => item.status !== "resolved"
        ).length,

        fuelSpendMonth,
      };
    },


    // ==========================================================
    // BUSES
    // ==========================================================

    getBuses: async () => {
      return getBusesInternal();
    },

    createBus: async data => {
      const result = await post(
        "/buses/index.php",
        data
      );

      return {
        ...data,
        id: normaliseId(result?.id),
        status: data.status || "active",
        capacity: Number(data.capacity || 0),
        odometer: Number(data.odometer || 0),
        maintenanceIntervalKm:
          Number(data.maintenanceIntervalKm || 10000),
        photos: [],
      };
    },

    updateBus: async (id, patch) => {
      const result = await patchRequest(
        "/buses/index.php",
        {
          id: Number(id),
          ...patch,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...patch,
      };
    },

    deleteBus: async id => {
      return remove(
        `/buses/index.php?id=${encodeURIComponent(id)}`
      );
    },

    toggleBusStatus: async id => {
      const buses = await getBusesInternal();

      const bus = buses.find(
        item => Number(item.id) === Number(id)
      );

      if (!bus) {
        throw new Error("Bus not found.");
      }

      const nextStatus =
        bus.status === "active"
          ? "maintenance"
          : "active";

      return OpsAPI.updateBus(
        id,
        { status: nextStatus }
      );
    },


    // ==========================================================
    // STAFF
    // ==========================================================

    getStaff: async () => {
      return getStaffInternal();
    },

    createStaff: async data => {
      const result = await post(
        "/staff/index.php",
        data
      );

      return {
        ...data,
        id: normaliseId(result?.id),
        status: data.status || "active",
        photoVisible:
          data.photoVisible !== false,
        photo: null,
      };
    },

    updateStaff: async (id, patch) => {
      const result = await patchRequest(
        "/staff/index.php",
        {
          id: Number(id),
          ...patch,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...patch,
      };
    },
    uploadStaffPhoto: async (staffId, file) => {
  return uploadStaffPhoto(
    Number(staffId),
    file
  );
},
deleteStaffPhoto: async (staffId) => {
  return remove(
    `/staff/photos.php?staffId=${encodeURIComponent(staffId)}`
  );
},
    deleteStaff: async id => {
      return remove(
        `/staff/index.php?id=${encodeURIComponent(id)}`
      );
    },

    togglePhotoVisible: async id => {
      const staff = await getStaffInternal();

      const person = staff.find(
        item => Number(item.id) === Number(id)
      );

      if (!person) {
        throw new Error("Staff member not found.");
      }

      return OpsAPI.updateStaff(
        id,
        {
          photoVisible: !person.photoVisible
        }
      );
    },


    // ==========================================================
    // ROUTES
    // ==========================================================

    getRoutes: async () => {
      return getRoutesInternal();
    },

    createRoute: async data => {
      const result = await post(
        "/routes/index.php",
        data
      );

      return {
        ...data,
        id: normaliseId(result?.id),
        visible:
          data.visible !== false,
        departures: [],
      };
    },

    updateRoute: async (id, patch) => {
      const result = await patchRequest(
        "/routes/index.php",
        {
          id: Number(id),
          ...patch,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...patch,
      };
    },

    deleteRoute: async id => {
      return remove(
        `/routes/index.php?id=${encodeURIComponent(id)}`
      );
    },

    toggleRouteVisible: async id => {
      const result = await patchRequest(
        "/routes/index.php",
        {
          id: Number(id),
          action: "toggle-visible",
        }
      );

      return result;
    },


    // ==========================================================
    // DEPARTURES
    // ==========================================================

    addDeparture: async (routeId, data) => {
      const result = await post(
        "/routes/departures.php",
        {
          routeId: Number(routeId),
          time: data.time,
        }
      );

      return {
        ...data,
        id: normaliseId(result?.id),
        busId: null,
        driverId: null,
        conductorId: null,
      };
    },

    updateDeparture: async (
      routeId,
      depId,
      patchData
    ) => {
      const result = await patchRequest(
        "/routes/departures.php",
        {
          id: Number(depId),
          ...patchData,
          busId:
            patchData.busId === ""
              ? null
              : patchData.busId,
          driverId:
            patchData.driverId === ""
              ? null
              : patchData.driverId,
          conductorId:
            patchData.conductorId === ""
              ? null
              : patchData.conductorId,
        }
      );

      return {
        id: Number(result?.id ?? depId),
        ...patchData,
      };
    },

    deleteDeparture: async (
      routeId,
      depId
    ) => {
      return remove(
        `/routes/departures.php?id=${encodeURIComponent(depId)}`
      );
    },


    // ==========================================================
    // FUEL
    // ==========================================================

    getFuelLog: async () => {
      const data = await request(
        "/fuel/index.php"
      );

      return Array.isArray(data)
        ? data
            .map(normaliseFuel)
            .sort(
              (a, b) =>
                String(b.date).localeCompare(
                  String(a.date)
                )
            )
        : [];
    },

    addFuelEntry: async data => {
      const result = await post(
        "/fuel/index.php",
        data
      );

      return {
        ...data,
        id: normaliseId(result?.id),
      };
    },

    updateFuelEntry: async (
      id,
      data
    ) => {
      const result = await patchRequest(
        "/fuel/index.php",
        {
          id: Number(id),
          ...data,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...data,
      };
    },

    deleteFuelEntry: async id => {
      return remove(
        `/fuel/index.php?id=${encodeURIComponent(id)}`
      );
    },


    // ==========================================================
    // MAINTENANCE
    // ==========================================================

    getMaintenanceStatus: async () => {
      const data = await request(
        "/maintenance/index.php?action=status"
      );

      return Array.isArray(data)
        ? data
        : [];
    },

    updateMaintenanceInterval: async (
      busId,
      intervalKm
    ) => {
      return post(
        "/maintenance/index.php?action=interval",
        {
          busId: Number(busId),
          intervalKm: Number(intervalKm),
        }
      );
    },

    getMaintenanceLog: async busId => {
      const endpoint =
        busId
          ? `/maintenance/index.php?busId=${encodeURIComponent(busId)}`
          : "/maintenance/index.php";

      const data = await request(endpoint);

      return Array.isArray(data)
        ? data.map(normaliseMaintenance)
        : [];
    },

    addMaintenanceEntry: async ({
      busId,
      date,
      odometer,
      note
    }) => {
      const result = await post(
        "/maintenance/index.php",
        {
          busId: Number(busId),
          date,
          odometer: Number(odometer || 0),
          note: note || "Service logged",
        }
      );

      return {
        id: normaliseId(result?.id),
        busId: Number(busId),
        date,
        odometer: Number(odometer || 0),
        note: note || "Service logged",
      };
    },

    updateMaintenanceEntry: async (
      id,
      patchData
    ) => {
      const result = await patchRequest(
        "/maintenance/index.php",
        {
          id: Number(id),
          ...patchData,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...patchData,
      };
    },

    deleteMaintenanceEntry: async id => {
      return remove(
        `/maintenance/index.php?id=${encodeURIComponent(id)}`
      );
    },

    sendToMaintenance: async (
      busId,
      note
    ) => {
      return post(
        "/maintenance/index.php?action=send",
        {
          busId: Number(busId),
          note: note || "Sent for maintenance",
        }
      );
    },

    returnToService: async (
      busId,
      {
        date,
        odometer,
        note
      }
    ) => {
      return post(
        "/maintenance/index.php?action=return",
        {
          busId: Number(busId),
          date,
          odometer: Number(odometer || 0),
          note: note || "Returned to service",
        }
      );
    },


    // ==========================================================
    // FEEDBACK
    // ==========================================================

    getFeedback: async () => {
      const data = await request(
        "/feedback/index.php"
      );

      return Array.isArray(data)
        ? data
        : [];
    },

    resolveFeedback: async id => {
      return patchRequest(
        "/feedback/index.php",
        {
          id: Number(id),
        }
      );
    },

    deleteFeedback: async id => {
      return remove(
        `/feedback/index.php?id=${encodeURIComponent(id)}`
      );
    },


    // ==========================================================
    // SOS
    // ==========================================================

    getSOSAlerts: async () => {
      const data = await request(
        "/sos/index.php"
      );

      return Array.isArray(data)
        ? data
        : [];
    },

    resolveSOS: async id => {
      return patchRequest(
        "/sos/index.php",
        {
          id: Number(id),
        }
      );
    },

    deleteSOS: async id => {
      return remove(
        `/sos/index.php?id=${encodeURIComponent(id)}`
      );
    },


    // ==========================================================
    // CONDUCTOR
    // ==========================================================

    getConductorTrips: async () => {
      const routes = await getRoutesInternal();
      const buses = await getBusesInternal();
      const staff = await getStaffInternal();

      const busMap = new Map(
        buses.map(bus => [
          Number(bus.id),
          bus
        ])
      );

      const staffMap = new Map(
        staff.map(person => [
          Number(person.id),
          person
        ])
      );

      return routes.flatMap(route =>
        route.departures.map(departure => {
          const bus = busMap.get(
            Number(departure.busId)
          );

          const driver =
            staffMap.get(
              Number(departure.driverId)
            );

          const conductor =
            staffMap.get(
              Number(departure.conductorId)
            );

          return {
            routeId: route.id,
            depId: departure.id,
            from: route.from,
            to: route.to,
            time: departure.time,

            busLabel: formatBusLabel(bus),

            capacity:
              Number(bus?.capacity || 40),

            driverName:
              driver?.name || "",

            conductorName:
              conductor?.name || "",
          };
        })
      );
    },

    /*
     * Uses the real trip-code GET endpoint.
     * The backend does not require conductor authentication
     * for this lookup.
     */
    getManifest: async (
      from,
      to,
      date,
      depTime,
      capacity
    ) => {
      /*
       * We need a trip code to access the conductor manifest.
       * Generate/reuse one through the authenticated operator
       * endpoint first.
       */
      const generated = await post(
        "/conductor/index.php?action=generate",
        {
          from,
          to,
          date,
          depTime,
          capacity:
            Number(capacity || 40),
        }
      );

      const code = generated?.code;

      if (!code) {
        throw new Error(
          "Unable to generate a trip code."
        );
      }

      const trip = await request(
        `/conductor/index.php?code=${encodeURIComponent(code)}`
      );

      const manifest =
        Array.isArray(trip?.manifest)
          ? trip.manifest
          : [];

      const takenSeats = manifest.flatMap(
        booking =>
          Array.isArray(booking.seats)
            ? booking.seats
            : []
      );

      return {
        ...trip,
        code,
        manifest,
        takenSeats,
        capacity:
          Number(trip?.capacity || capacity || 40),
      };
    },

    counterBooking: async ({
      from,
      to,
      date,
      depTime,
      arrTime,
      plate,
      busType,
      price,
      pickupPoint,
      passengerName,
      phone,
      seats,
      code,
    }) => {

      /*
       * Use the supplied code if the caller has one.
       * Otherwise generate/reuse a code for this trip.
       */
      let tripCode = code;

      if (!tripCode) {
        const generated = await post(
          "/conductor/index.php?action=generate",
          {
            from,
            to,
            date,
            depTime,
            capacity: 40,
            busLabel: plate || null,
          }
        );

        tripCode = generated?.code;
      }

      if (!tripCode) {
        throw new Error(
          "Unable to obtain a trip code."
        );
      }

      const result = await post(
        "/conductor/index.php?action=book",
        {
          code: tripCode,
          passengerName,
          phone,
          pickupPoint:
            pickupPoint || from,
          seats,
        }
      );

      return {
        ...result,
        pnr: result?.pnr,
      };
    },


    // ==========================================================
    // ADMIN / TEAM MANAGEMENT
    // ==========================================================

    getTeam: async () => {
      const data = await request("/auth/team.php");

      return Array.isArray(data)
        ? data.map(account => ({
            ...account,
            id: normaliseId(account.id),
            role: account.role || "manager",
            name: account.name || "",
            email: account.email || "",
            phone: account.phone || "",
            status: account.status || "active"
          }))
        : [];
    },

    addTeamMember: async ({
      name,
      email,
      phone,
      role,
      password
    }) => {
      const result = await post(
        "/auth/team.php",
        {
          name,
          email,
          phone: phone || "",
          role: role || "manager",
          ...(password ? { password } : {})
        }
      );

      return {
        ...result,
        id: normaliseId(result?.id)
      };
    },

  updateTeamMember: async (id, patchData = {}) => {

  const payload = {
    id: Number(id)
  };

  if (patchData.name !== undefined) {
    payload.name = patchData.name;
  }

  if (patchData.email !== undefined) {
    payload.email = patchData.email;
  }

  if (patchData.phone !== undefined) {
    payload.phone = patchData.phone;
  }

  /*
   * Only send role when the caller actually wants
   * to change the role.
   *
   * This prevents saving the owner's profile from
   * accidentally sending role = "manager".
   */
  if (patchData.role !== undefined) {
    payload.role = patchData.role;
  }

  return patchRequest(
    "/auth/team.php",
    payload
  );
},

    removeTeamMember: async id => {
      return remove(
        `/auth/team.php?id=${encodeURIComponent(id)}`
      );
    },

    resetTeamMemberPassword: async id => {
      return post(
        "/auth/reset-password.php",
        {
          id: Number(id)
        }
      );
    },

    getPendingRequests: async () => {
      const data = await request(
        "/auth/pending.php"
      );

      return Array.isArray(data)
        ? data.map(requestRow => ({
            ...requestRow,
            id: normaliseId(requestRow.id),
            name: requestRow.name || "",
            email: requestRow.email || "",
            phone: requestRow.phone || "",
            role: requestRow.role || "manager"
          }))
        : [];
    },

    approveRequest: async (id, role = "manager") => {
      return post(
        "/auth/pending.php",
        {
          id: Number(id),
          action: "approve",
          role
        }
      );
    },

    rejectRequest: async id => {
      return post(
        "/auth/pending.php",
        {
          id: Number(id),
          action: "reject"
        }
      );
    },

    // ==========================================================
    // ALL BOOKINGS
    // ==========================================================

    getAllBookings: async () => {
      const data = await request(
        "/bookings/index.php?scope=operator"
      );

      return Array.isArray(data)
        ? data.map(normaliseBooking)
        : [];
    },

    cancelAnyBooking: async id => {
      return patchRequest(
        "/bookings/index.php",
        {
          id: Number(id),
        }
      );
    },

    deleteBooking: async id => {
      return remove(
        `/bookings/index.php?id=${encodeURIComponent(id)}`
      );
    },


    // ==========================================================
    // TRIP CODES
    // ==========================================================

    getTripCode: async (
      from,
      to,
      date,
      depTime,
      meta = {}
    ) => {
      return post(
        "/conductor/index.php?action=generate",
        {
          from,
          to,
          date,
          depTime,

          capacity:
            Number(meta.capacity || 40),

          busLabel:
            meta.busLabel ||
            null,

          driverName:
            meta.driverName ||
            null,

          conductorName:
            meta.conductorName ||
            null,
        }
      );
    },


    // ==========================================================
    // LIVE TRACKING
    // ==========================================================

    getTrackableTrips: async () => {
  const routes = await getRoutesInternal();
  const buses = await getBusesInternal();
  const staff = await getStaffInternal();

  const busMap = new Map(
    buses.map(bus => [
      Number(bus.id),
      bus
    ])
  );

  const staffMap = new Map(
    staff.map(person => [
      Number(person.id),
      person
    ])
  );

  return routes.flatMap(route => {
    // PHP uses from_city / to_city.
    // Frontend normally uses from / to.
    const from =
      route.from ??
      route.from_city ??
      "";

    const to =
      route.to ??
      route.to_city ??
      "";

    const departures =
      Array.isArray(route.departures)
        ? route.departures
        : [];

    return departures.map(departure => {

      const bus =
        busMap.get(
          Number(
            departure.busId ??
            departure.bus_id
          )
        );

      const driver =
        staffMap.get(
          Number(
            departure.driverId ??
            departure.driver_id
          )
        );

      const conductor =
        staffMap.get(
          Number(
            departure.conductorId ??
            departure.conductor_id
          )
        );

      return {
        routeId: Number(route.id),
        depId: Number(departure.id),

        from,
        to,

        time: departure.time
          ? String(departure.time).slice(0, 5)
          : "",

        busPlate:
          bus?.plate ||
          "TBA",

        driverName:
          driver?.name ||
          "",

        conductorName:
          conductor?.name ||
          "",
      };
    });
  });
},
    getLiveTrips: async () => {
      const data = await request(
        "/tracking/index.php"
      );

      return Array.isArray(data)
        ? data.map(normaliseLiveTrip)
        : [];
    },

    startLiveTrip: async data => {
      const result = await post(
        "/tracking/index.php",
        data
      );

      return {
        id: normaliseId(result?.id),
        ...data,
      };
    },

    updateLiveTrip: async (
      id,
      patchData
    ) => {
      const result = await patchRequest(
        "/tracking/index.php",
        {
          id: Number(id),
          ...patchData,
        }
      );

      return {
        id: Number(result?.id ?? id),
        ...patchData,
      };
    },

    toggleLiveTripVisibility: async id => {
      return patchRequest(
        "/tracking/index.php?action=toggle-visible",
        {
          id: Number(id),
        }
      );
    },

    advanceLiveTrip: async id => {
      return patchRequest(
        "/tracking/index.php?action=advance",
        {
          id: Number(id),
        }
      );
    },

    /*
     * The PHP backend does not have a dedicated "end" action.
     * Its normal PATCH endpoint accepts status, so completing
     * the tracking session is represented as status=completed.
     */
    endLiveTrip: async id => {
      return patchRequest(
        "/tracking/index.php",
        {
          id: Number(id),
          status: "completed",
        }
      );
    },

    deleteLiveTrip: async id => {
      return remove(
        `/tracking/index.php?id=${encodeURIComponent(id)}`
      );
    },
  };
})();