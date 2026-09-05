/* BusPal — Operator Dashboard
   Mock data + CRUD API layer. Every function returns a Promise —
   swap the bodies for real fetch() calls to the Spring Boot API
   later; nothing in app.js needs to change.*/

const OpsAPI = (() => {

  const delay = (v, ms = 220) => new Promise((res) => setTimeout(() => res(v), ms));
  const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // OPERATOR PROFILE 
  const OPERATOR = {
    name: "L. Prathap",
    company: "BT Express (Pvt) Ltd",
    email: "ops@btexpress.lk",
    phone: "077 010 1107",
    initials: "LP",
  };

  // BUSES 
  let BUSES = [
    { id: "BUS-01", plate: "NC-9302", model: "Magnate", type: "AC Luxury", capacity: 37, fuelType: "Diesel", odometer: 84210, status: "active", maintenanceIntervalKm: 10000, lastServiceOdometer: 75000 },
    { id: "BUS-02", plate: "BT-2214", model: "Zhongtong LCK6128H", type: "AC Luxury", capacity: 51, fuelType: "Diesel", odometer: 61340, status: "active", maintenanceIntervalKm: 10000, lastServiceOdometer: 55000 },
    { id: "BUS-03", plate: "BT-1187", model: "Ashok Leyland", type: "Semi-Luxury", capacity: 49, fuelType: "Diesel", odometer: 102870, status: "maintenance", maintenanceIntervalKm: 10000, lastServiceOdometer: 90000 },
    { id: "BUS-04", plate: "BT-4021", model: "Higer Sleeper", type: "AC Sleeper", capacity: 37, fuelType: "Diesel", odometer: 45010, status: "active", maintenanceIntervalKm: 15000, lastServiceOdometer: 40000 },
  ];

  // STAFF (drivers & conductors)
  let STAFF = [
    {
      id: "STF-01", name: "M. Fernando", role: "driver", phone: "071 234 5678",
      ntcLicense: "NTC-DRV-88231", drivingLicense: "B1204552", licenseExpiry: "2027-04-12",
      photo: null, photoVisible: true, status: "active",
    },
    {
      id: "STF-02", name: "S. Perera", role: "conductor", phone: "070 987 6543",
      ntcLicense: "NTC-CND-44120", drivingLicense: "", licenseExpiry: "",
      photo: null, photoVisible: true, status: "active",
    },
    {
      id: "STF-03", name: "K. Jayasuriya", role: "driver", phone: "077 555 2211",
      ntcLicense: "NTC-DRV-91002", drivingLicense: "B0987541", licenseExpiry: "2026-11-30",
      photo: null, photoVisible: false, status: "active",
    },
    {
      id: "STF-04", name: "R. Wickrama", role: "conductor", phone: "076 112 4499",
      ntcLicense: "NTC-CND-77841", drivingLicense: "", licenseExpiry: "",
      photo: null, photoVisible: true, status: "on-leave",
    },
  ];

  // ROUTES (with departures) 
  let ROUTES = [
    {
      id: "RT-01", from: "Colombo", to: "Kandy", distanceKm: 115, fare: 1250,
      visible: true,
      departures: [
        { id: "DEP-01", time: "06:30", busId: "BUS-01", driverId: "STF-01", conductorId: "STF-02" },
        { id: "DEP-02", time: "08:00", busId: "BUS-03", driverId: "STF-03", conductorId: "STF-04" },
      ],
    },
    {
      id: "RT-02", from: "Colombo", to: "Galle", distanceKm: 128, fare: 1100,
      visible: true,
      departures: [
        { id: "DEP-03", time: "07:15", busId: "BUS-02", driverId: "", conductorId: "" },
      ],
    },
    {
      id: "RT-03", from: "Kandy", to: "Jaffna", distanceKm: 265, fare: 2400,
      visible: false,
      departures: [
        { id: "DEP-04", time: "20:00", busId: "BUS-04", driverId: "", conductorId: "" },
      ],
    },
  ];

  // FUEL LOG 
  let FUEL_LOG = [
    { id: "FL-01", busId: "BUS-01", date: "2026-07-29", liters: 120, cost: 43200, odometer: 84210, station: "Ceypetco - Nittambuwa" },
    { id: "FL-02", busId: "BUS-02", date: "2026-07-27", liters: 95, cost: 34200, odometer: 61340, station: "Lanka IOC - Kadawatha" },
    { id: "FL-03", busId: "BUS-01", date: "2026-07-20", liters: 110, cost: 39600, odometer: 83010, station: "Ceypetco - Kegalle" },
    { id: "FL-04", busId: "BUS-04", date: "2026-07-18", liters: 140, cost: 50400, odometer: 45010, station: "Ceypetco - Anuradhapura" },
  ];

  let MAINTENANCE_LOG = [
    { id: "MT-01", busId: "BUS-01", date: "2026-06-15", odometer: 75000, note: "Full service — oil, filters, brakes" },
    { id: "MT-02", busId: "BUS-03", date: "2026-05-20", odometer: 90000, note: "Full service — oil, filters, brakes" },
    { id: "MT-03", busId: "BUS-02", date: "2026-06-28", odometer: 55000, note: "Routine service" },
    { id: "MT-04", busId: "BUS-04", date: "2026-06-10", odometer: 40000, note: "Routine service" },
  ];

  // FEEDBACK and SOS_ALERTS now live in the shared BusPalStore (shared/js/store.js)
  // so the operator side sees what passengers actually submit/trigger, instead of
  // its own disconnected mock copy.

  function busLabel(b) { return b ? `${b.plate} · ${b.model}` : "Unassigned"; }

  /** Highest odometer reading across a bus's maintenance log, falling back to its baseline lastServiceOdometer if no entries exist yet. */
  function computeLastService(bus) {
    const entries = MAINTENANCE_LOG.filter(m => m.busId === bus.id);
    if (!entries.length) return bus.lastServiceOdometer ?? 0;
    return Math.max(bus.lastServiceOdometer ?? 0, ...entries.map(e => e.odometer));
  }

  return {
    // profile 
    getOperator: () => delay({ ...OPERATOR }),

    // overview 
    getOverviewStats: () => delay({
      buses: BUSES.length,
      activeBuses: BUSES.filter(b => b.status === "active").length,
      routes: ROUTES.length,
      visibleRoutes: ROUTES.filter(r => r.visible).length,
      staff: STAFF.length,
      openFeedback: BusPalStore.getFeedback().filter(f => f.status === "open").length,
      openSOS: BusPalStore.getSOSAlerts().filter(s => s.status !== "resolved").length,
      fuelSpendMonth: FUEL_LOG.reduce((s, f) => s + f.cost, 0),
    }),

    // ---- buses CRUD ----
    getBuses: () => delay(BUSES.map(b => ({ ...b }))),
    createBus: (data) => { const bus = { id: uid("BUS"), status: "active", ...data }; BUSES = [bus, ...BUSES]; return delay(bus); },
    updateBus: (id, patch) => { BUSES = BUSES.map(b => b.id === id ? { ...b, ...patch } : b); return delay(BUSES.find(b => b.id === id)); },
    deleteBus: (id) => { BUSES = BUSES.filter(b => b.id !== id); return delay({ id }); },
    toggleBusStatus: (id) => {
      BUSES = BUSES.map(b => b.id === id ? { ...b, status: b.status === "active" ? "maintenance" : "active" } : b);
      return delay(BUSES.find(b => b.id === id));
    },

    // ---- staff CRUD ----
    getStaff: () => delay(STAFF.map(s => ({ ...s }))),
    createStaff: (data) => { const s = { id: uid("STF"), status: "active", photoVisible: true, photo: null, ...data }; STAFF = [s, ...STAFF]; return delay(s); },
    updateStaff: (id, patch) => { STAFF = STAFF.map(s => s.id === id ? { ...s, ...patch } : s); return delay(STAFF.find(s => s.id === id)); },
    deleteStaff: (id) => { STAFF = STAFF.filter(s => s.id !== id); return delay({ id }); },
    togglePhotoVisible: (id) => {
      STAFF = STAFF.map(s => s.id === id ? { ...s, photoVisible: !s.photoVisible } : s);
      return delay(STAFF.find(s => s.id === id));
    },

    // ---- routes CRUD ----
    getRoutes: () => delay(ROUTES.map(r => ({
      ...r,
      departures: r.departures.map(d => ({
        ...d,
        busLabel: busLabel(BUSES.find(b => b.id === d.busId)),
        driverName: STAFF.find(s => s.id === d.driverId)?.name || "",
        conductorName: STAFF.find(s => s.id === d.conductorId)?.name || "",
      })),
    }))),
    createRoute: (data) => { const r = { id: uid("RT"), visible: true, departures: [], ...data }; ROUTES = [r, ...ROUTES]; return delay(r); },
    updateRoute: (id, patch) => { ROUTES = ROUTES.map(r => r.id === id ? { ...r, ...patch } : r); return delay(ROUTES.find(r => r.id === id)); },
    deleteRoute: (id) => { ROUTES = ROUTES.filter(r => r.id !== id); return delay({ id }); },
    toggleRouteVisible: (id) => {
      ROUTES = ROUTES.map(r => r.id === id ? { ...r, visible: !r.visible } : r);
      return delay(ROUTES.find(r => r.id === id));
    },

    // ---- departures (schedule + assignment) ----
    addDeparture: (routeId, data) => {
      const dep = { id: uid("DEP"), busId: "", driverId: "", conductorId: "", ...data };
      ROUTES = ROUTES.map(r => r.id === routeId ? { ...r, departures: [...r.departures, dep] } : r);
      return delay(dep);
    },
    updateDeparture: (routeId, depId, patch) => {
      ROUTES = ROUTES.map(r => r.id !== routeId ? r : {
        ...r, departures: r.departures.map(d => d.id === depId ? { ...d, ...patch } : d),
      });
      return delay(ROUTES.find(r => r.id === routeId).departures.find(d => d.id === depId));
    },
    deleteDeparture: (routeId, depId) => {
      ROUTES = ROUTES.map(r => r.id !== routeId ? r : { ...r, departures: r.departures.filter(d => d.id !== depId) });
      return delay({ depId });
    },

    // ---- fuel management ----
    getFuelLog: () => delay(FUEL_LOG.map(f => ({ ...f, bus: BUSES.find(b => b.id === f.busId) }))
      .sort((a, b) => b.date.localeCompare(a.date))),
    addFuelEntry: (data) => {
      const entry = { id: uid("FL"), ...data };
      FUEL_LOG = [entry, ...FUEL_LOG];
      if (data.busId && data.odometer) {
        BUSES = BUSES.map(b => b.id === data.busId ? { ...b, odometer: Math.max(b.odometer, Number(data.odometer)) } : b);
      }
      return delay(entry);
    },
    updateFuelEntry: (id, data) => {
      FUEL_LOG = FUEL_LOG.map(f => f.id === id ? { ...f, ...data } : f);
      const updated = FUEL_LOG.find(f => f.id === id);
      if (updated.busId && updated.odometer) {
        BUSES = BUSES.map(b => b.id === updated.busId ? { ...b, odometer: Math.max(b.odometer, Number(updated.odometer)) } : b);
      }
      return delay(updated);
    },
    deleteFuelEntry: (id) => { FUEL_LOG = FUEL_LOG.filter(f => f.id !== id); return delay({ id }); },

    // ---- maintenance (km-based service due tracking) ----
    // Last-service odometer is derived from the maintenance log itself (the
    // highest logged odometer reading for that bus), not a separate field —
    // so editing or deleting a log entry correctly updates the status below,
    // instead of a stale bus.lastServiceOdometer drifting out of sync.
    getMaintenanceStatus: () => delay(BUSES.map(b => {
      const interval = b.maintenanceIntervalKm || 10000;
      const lastService = computeLastService(b);
      const kmSinceService = b.odometer - lastService;
      const kmUntilDue = interval - kmSinceService;
      let level = "ok";
      if (kmUntilDue <= 0) level = "overdue";
      else if (kmUntilDue <= 1000) level = "due-soon";
      return { ...b, interval, lastService, kmSinceService, kmUntilDue, level };
    })),
    updateMaintenanceInterval: (busId, intervalKm) => {
      BUSES = BUSES.map(b => b.id === busId ? { ...b, maintenanceIntervalKm: Number(intervalKm) || 10000 } : b);
      return delay(BUSES.find(b => b.id === busId));
    },
    getMaintenanceLog: (busId) => delay(
      MAINTENANCE_LOG.filter(m => !busId || m.busId === busId)
        .map(m => ({ ...m, bus: BUSES.find(b => b.id === m.busId) }))
        .sort((a, b) => b.date.localeCompare(a.date))
    ),
    addMaintenanceEntry: ({ busId, date, odometer, note }) => {
      const entry = { id: uid("MT"), busId, date: date || new Date().toISOString().slice(0, 10), odometer: Number(odometer) || 0, note: note || "Service logged" };
      MAINTENANCE_LOG = [entry, ...MAINTENANCE_LOG];
      return delay(entry);
    },
    updateMaintenanceEntry: (id, patch) => {
      MAINTENANCE_LOG = MAINTENANCE_LOG.map(m => m.id === id ? { ...m, ...patch, odometer: patch.odometer !== undefined ? Number(patch.odometer) || 0 : m.odometer } : m);
      return delay(MAINTENANCE_LOG.find(m => m.id === id));
    },
    deleteMaintenanceEntry: (id) => {
      MAINTENANCE_LOG = MAINTENANCE_LOG.filter(m => m.id !== id);
      return delay({ id });
    },

    // ---- send to / return from maintenance (ties bus status to the service log) ----
    sendToMaintenance: (busId, note) => {
      BUSES = BUSES.map(b => b.id === busId ? { ...b, status: "maintenance" } : b);
      const entry = { id: uid("MT"), busId, date: new Date().toISOString().slice(0, 10), odometer: BUSES.find(b => b.id === busId).odometer, note: note || "Sent for maintenance", type: "sent" };
      MAINTENANCE_LOG = [entry, ...MAINTENANCE_LOG];
      return delay(BUSES.find(b => b.id === busId));
    },
    returnToService: (busId, { date, odometer, note }) => {
      BUSES = BUSES.map(b => b.id === busId ? { ...b, status: "active" } : b);
      const entry = { id: uid("MT"), busId, date: date || new Date().toISOString().slice(0, 10), odometer: Number(odometer) || 0, note: note || "Returned to service", type: "returned" };
      MAINTENANCE_LOG = [entry, ...MAINTENANCE_LOG];
      return delay(BUSES.find(b => b.id === busId));
    },

    // ---- feedback / complaints / SOS ----
    getFeedback: () => delay(BusPalStore.getFeedback()),
    resolveFeedback: (id) => delay(BusPalStore.resolveFeedback(id)),
    deleteFeedback: (id) => delay(BusPalStore.deleteFeedback(id)),
    getSOSAlerts: () => delay(BusPalStore.getSOSAlerts()),
    resolveSOS: (id) => delay(BusPalStore.resolveSOS(id)),
    deleteSOS: (id) => delay(BusPalStore.deleteSOS(id)),

    // ---- conductor: seat manifest + counter booking for a specific trip instance ----
    // Trip instance = a Departure (route+time) pinned to a date, matched by value
    // against the shared booking store (see shared/js/store.js for why).
    getConductorTrips: () => delay(
      ROUTES.flatMap(r => r.departures.map(d => ({
        routeId: r.id, depId: d.id, from: r.from, to: r.to, time: d.time,
        busLabel: busLabel(BUSES.find(b => b.id === d.busId)),
        capacity: BUSES.find(b => b.id === d.busId)?.capacity || 40,
        driverName: STAFF.find(s => s.id === d.driverId)?.name || "",
        conductorName: STAFF.find(s => s.id === d.conductorId)?.name || "",
      })))
    ),
    getManifest: (from, to, date, depTime, capacity) => {
      const manifest = BusPalStore.getManifest(from, to, date, depTime);
      const takenSeats = manifest.flatMap(b => b.seats);
      return delay({ manifest, takenSeats, capacity: capacity || 40 });
    },
    counterBooking: ({ from, to, date, depTime, arrTime, plate, busType, price, pickupPoint, passengerName, phone, seats }) =>
      delay(BusPalStore.createBooking({
        passengerId: null, passengerName, phone,
        from, to, date, depTime, arrTime: arrTime || "", plate: plate || "", busType: busType || "",
        price: price || 0, pickupPoint: pickupPoint || from, seats, source: "counter",
      })),

    // ---- global bookings view (all passengers, all trips — for the operator's Bookings page) ----
    getAllBookings: () => delay(BusPalStore.getAllBookings().sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))),
    cancelAnyBooking: (id) => delay(BusPalStore.cancelBooking(id)),
    deleteBooking: (id) => delay(BusPalStore.deleteBooking(id)),

    // ---- conductor trip-code access (no separate login — see shared/js/store.js) ----
    getTripCode: (from, to, date, depTime, meta) => delay(BusPalStore.getOrCreateTripCode(from, to, date, depTime, meta)),

    // ---- live tracking (full CRUD — start/advance/end a trip's tracking session) ----
    getTrackableTrips: () => delay(
      ROUTES.flatMap(r => r.departures.map(d => ({
        routeId: r.id, depId: d.id, from: r.from, to: r.to, time: d.time,
        busPlate: BUSES.find(b => b.id === d.busId)?.plate || "TBA",
        driverName: STAFF.find(s => s.id === d.driverId)?.name || "",
        conductorName: STAFF.find(s => s.id === d.conductorId)?.name || "",
      })))
    ),
    getLiveTrips: () => delay(BusPalStore.getLiveTrips()),
    startLiveTrip: (data) => delay(BusPalStore.startLiveTrip(data)),
    updateLiveTrip: (id, patch) => delay(BusPalStore.updateLiveTrip(id, patch)),
    toggleLiveTripVisibility: (id) => delay(BusPalStore.toggleLiveTripVisibility(id)),
    advanceLiveTrip: (id) => delay(BusPalStore.advanceLiveTrip(id)),
    endLiveTrip: (id) => delay(BusPalStore.endLiveTrip(id)),
    deleteLiveTrip: (id) => delay(BusPalStore.deleteLiveTrip(id)),
  };
})();
