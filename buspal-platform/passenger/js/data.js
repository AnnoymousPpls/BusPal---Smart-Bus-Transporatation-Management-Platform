/* ============================================================
   BusPal — Passenger Dashboard
   Mock data + API layer.

   Every function here returns a Promise, on purpose — so when the
   Spring Boot backend is ready, each function body just becomes a
   `fetch('/api/...')` call and nothing in app.js has to change.
   ============================================================ */

const BusPalAPI = (() => {

  // Pull identity from the real session (set by AuthStore before this script
  // loads) so bookings created here match up with what the shared store,
  // the operator dashboard, and the conductor view all see for this person.
  const session = window.__session || {};
  const CURRENT_USER = {
    id: session.id || "PSG-1042",
    name: session.name || "R. Kavishali",
    initials: (session.name || "R. Kavishali").split(" ").map(p => p[0]).join("").slice(0, 2).toUpperCase(),
    email: session.email || "kavishali@example.com",
    phone: "077 123 4567",
    nic: "200145601234",
    joined: "2025-11-02",
  };

  // Available trips a passenger can search & book
  let TRIPS = [
    {
      id: "T-101", from: "Colombo", to: "Kandy", date: "2026-08-02",
      depTime: "06:30", arrTime: "09:15", duration: "2h 45m",
      busType: "AC Luxury", plate: "BT-2214", price: 1250,
      seatsTotal: 51, seatsTaken: ["1","2","8","15","22","23","30","44"],
    },
    {
      id: "T-102", from: "Colombo", to: "Kandy", date: "2026-08-02",
      depTime: "08:00", arrTime: "10:40", duration: "2h 40m",
      busType: "Semi-Luxury", plate: "BT-1187", price: 850,
      seatsTotal: 49, seatsTaken: ["3","4","9","10","11","20","33"],
    },
    {
      id: "T-103", from: "Colombo", to: "Galle", date: "2026-08-02",
      depTime: "07:15", arrTime: "09:30", duration: "2h 15m",
      busType: "AC Luxury", plate: "BT-3390", price: 1100,
      seatsTotal: 37, seatsTaken: ["2","4","33","34","35","36"],
    },
    {
      id: "T-104", from: "Kandy", to: "Jaffna", date: "2026-08-03",
      depTime: "20:00", arrTime: "04:30", duration: "8h 30m",
      busType: "AC Sleeper", plate: "BT-4021", price: 2400,
      seatsTotal: 37, seatsTaken: ["1","2","3","5","6"],
    },
  ];

  // Passenger's bookings
  let BOOKINGS = [
    {
      id: "BK-88231", tripId: "T-101",
      pnr: "BP7X9K2", seats: ["B2"], status: "upcoming",
      bookedAt: "2026-07-29",
    },
    {
      id: "BK-87650", tripId: "T-103",
      pnr: "BP4M1J8", seats: ["C5", "C6"], status: "completed",
      bookedAt: "2026-07-10",
    },
  ];

  const delay = (v, ms = 250) => new Promise((res) => setTimeout(() => res(v), ms));

  function tripWithAvailability(t) {
    const taken = BusPalStore.takenSeats(t.from, t.to, t.date, t.depTime);
    return { ...t, seatsTaken: taken, seatsAvailable: t.seatsTotal - taken.length };
  }

  function bookingToUi(b) {
    return {
      id: b.id, pnr: b.pnr, seats: b.seats, status: b.status, bookedAt: b.bookedAt.slice(0, 10),
      trip: {
        id: `${b.from}-${b.to}-${b.date}-${b.depTime}`, from: b.from, to: b.to, date: b.date,
        depTime: b.depTime, arrTime: b.arrTime, plate: b.plate, busType: b.busType, price: b.price,
      },
    };
  }

  return {
    // ---- profile ----
    getProfile: () => delay({ ...CURRENT_USER }),
    updateProfile: (patch) => {
      Object.assign(CURRENT_USER, patch);
      return delay({ ...CURRENT_USER });
    },

    // ---- trip search ----
    searchTrips: ({ from, to, date } = {}) => {
      let results = TRIPS.map(tripWithAvailability);
      if (from) results = results.filter(t => t.from.toLowerCase().includes(from.toLowerCase()));
      if (to) results = results.filter(t => t.to.toLowerCase().includes(to.toLowerCase()));
      if (date) results = results.filter(t => t.date === date);
      return delay(results);
    },
    getTrip: (id) => delay(tripWithAvailability(TRIPS.find(t => t.id === id))),

    // ---- bookings (shared store — visible to the operator/conductor side too) ----
    getBookings: () => delay(BusPalStore.getBookingsForPassenger(CURRENT_USER.id).map(bookingToUi)),
    createBooking: ({ tripId, seats }) => {
      const trip = TRIPS.find(t => t.id === tripId);
      const booking = BusPalStore.createBooking({
        passengerId: CURRENT_USER.id, passengerName: CURRENT_USER.name, phone: CURRENT_USER.phone,
        from: trip.from, to: trip.to, date: trip.date, depTime: trip.depTime, arrTime: trip.arrTime,
        plate: trip.plate, busType: trip.busType, price: trip.price,
        pickupPoint: trip.from, seats, source: "self",
      });
      return delay(bookingToUi(booking));
    },
    cancelBooking: (bookingId) => delay(bookingToUi(BusPalStore.cancelBooking(bookingId))),

    // ---- live tracking ----
    getLiveTrip: () => {
      const myBookings = BusPalStore.getBookingsForPassenger(CURRENT_USER.id).filter(b => b.status === "upcoming");
      for (const b of myBookings) {
        const live = BusPalStore.findActiveLiveTrip(b.from, b.to, b.date, b.depTime);
        if (live) return delay({ ...live, bookingId: b.id, bookingPnr: b.pnr });
      }
      return delay(null);
    },

    // ---- feedback / complaints ----
    submitFeedback: (payload) => delay(BusPalStore.submitFeedback({
      type: payload.type, trip: payload.trip, message: payload.message,
      passengerId: CURRENT_USER.id, passengerName: CURRENT_USER.name,
    })),
    getMyFeedback: () => delay(BusPalStore.getFeedback().filter(f => f.passengerId === CURRENT_USER.id)),
    updateMyFeedback: (id, patch) => delay(BusPalStore.updateFeedback(id, patch)),
    deleteMyFeedback: (id) => delay(BusPalStore.deleteFeedback(id)),

    // ---- SOS ----
    triggerSOS: (payload) => delay(BusPalStore.triggerSOS({
      ...payload, passengerId: CURRENT_USER.id, passengerName: CURRENT_USER.name,
    }), 600),
    getMySOSAlerts: () => delay(BusPalStore.getSOSAlerts().filter(s => s.passengerId === CURRENT_USER.id)),

    // ---- emergency contacts (quick-dial from the SOS screen) ----
    getEmergencyContacts: () => delay(BusPalStore.getEmergencyContacts(CURRENT_USER.id)),
    addEmergencyContact: (contact) => delay(BusPalStore.addEmergencyContact(CURRENT_USER.id, contact)),
    removeEmergencyContact: (id) => delay(BusPalStore.removeEmergencyContact(CURRENT_USER.id, id)),
  };
})();
