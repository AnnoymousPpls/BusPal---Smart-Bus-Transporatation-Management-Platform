/* ============================================================
   BusPal — Passenger API Layer

   Real PHP + MySQL backend.
   All server communication goes through the PHP API.

   The public trip-search endpoint does not require login.
   Protected endpoints use the JWT stored by AuthStore.
   ============================================================ */

const BusPalAPI = (() => {
  const API_BASE = "http://localhost/buspal-backend-php/api";

  function getSession() {
    return AuthStore.getSession() || {};
  }

  function getToken() {
    return AuthStore.getToken();
  }

  async function request(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = getToken();

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
      console.error("BusPal API connection error:", error);

      throw new Error(
        "Unable to connect to BusPal server. Make sure WAMP and Apache are running."
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

    if (!response.ok || body.success === false) {
      throw new Error(
        body.message || `Request failed with status ${response.status}.`
      );
    }

    return body.data;
  }

  function getCurrentUser() {
    const session = getSession();

    return {
      id: session.id ?? null,
      name: session.name ?? "",
      initials: (session.name || "")
        .split(/\s+/)
        .filter(Boolean)
        .map(part => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      email: session.email ?? "",
      phone: "",
      nic: "",
      joined: "",
    };
  }

  function bookingToUi(booking) {
    return {
      id: booking.id,
      pnr: booking.pnr,
      seats: Array.isArray(booking.seats) ? booking.seats : [],
      status: booking.status,
      bookedAt: booking.bookedAt || booking.date || "",

      trip: {
        id: `${booking.from}-${booking.to}-${booking.date}-${booking.depTime}`,
        from: booking.from,
        to: booking.to,
        date: booking.date,
        depTime: booking.depTime,
        arrTime: booking.arrTime || "",
        plate: booking.busPlate || "",
        busType: booking.busType || "",
        price: Number(booking.price || 0),
      },

      source: booking.source,
      passengerName: booking.passengerName,
      phone: booking.phone,
    };
  }

  return {
    // ----------------------------------------------------------
    // Profile
    // ----------------------------------------------------------

    getProfile: async () => {
      /*
       * There is currently no dedicated PHP profile GET endpoint.
       * Use the authenticated session for identity information.
       */
      return getCurrentUser();
    },

    updateProfile: async (patch) => {
      /*
       * There is currently no dedicated PHP profile endpoint.
       * Do not pretend this is saved to MySQL.
       *
       * For now, update only the local session object so the UI
       * remains functional. We will replace this when we add a
       * proper /auth/profile.php endpoint.
       */
      const session = getSession();
      const updated = {
        ...session,
        ...patch,
      };

      AuthStore.setSession({
        accountId: updated.id,
        role: updated.role,
        name: updated.name,
        email: updated.email,
      });

      return {
        ...getCurrentUser(),
        ...patch,
      };
    },

    // ----------------------------------------------------------
    // Trip search
    // ----------------------------------------------------------

    searchTrips: async ({ from, to, date } = {}) => {
      const params = new URLSearchParams();

      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (date) params.set("date", date);

      const query = params.toString();

      const trips = await request(
        `/bookings/index.php${query ? `?${query}` : ""}`
      );

      return trips.map(trip => ({
        ...trip,
        id: String(trip.departureId),
        seatsTotal: Number(trip.seatsTotal || 0),
        seatsAvailable: Number(trip.seatsAvailable || 0),
        seatsTaken: Array.isArray(trip.seatsTaken)
          ? trip.seatsTaken
          : [],
        price: Number(trip.price || 0),
      }));
    },

    getTrip: async (id) => {
      const trips = await request(
        `/bookings/index.php?scope=trips`
      );

      const trip = trips.find(
        item => String(item.departureId) === String(id)
      );

      if (!trip) {
        return null;
      }

      return {
        ...trip,
        id: String(trip.departureId),
        seatsTotal: Number(trip.seatsTotal || 0),
        seatsAvailable: Number(trip.seatsAvailable || 0),
        seatsTaken: Array.isArray(trip.seatsTaken)
          ? trip.seatsTaken
          : [],
        price: Number(trip.price || 0),
      };
    },

    // ----------------------------------------------------------
    // Bookings
    // ----------------------------------------------------------

    getBookings: async () => {
      const bookings = await request("/bookings/index.php");

      return Array.isArray(bookings)
        ? bookings.map(bookingToUi)
        : [];
    },

    createBooking: async ({ tripId, seats, travelDate }) => {
      if (!tripId) {
        throw new Error("Trip is required.");
      }

      if (!travelDate) {
        throw new Error("Travel date is required.");
      }

      if (!Array.isArray(seats) || seats.length === 0) {
        throw new Error("Please select at least one seat.");
      }

      const booking = await request("/bookings/index.php", {
        method: "POST",
        body: JSON.stringify({
          departureId: Number(tripId),
          travelDate,
          seats,
        }),
      });

      return bookingToUi(booking);
    },

    cancelBooking: async (bookingId) => {
      const result = await request("/bookings/index.php", {
        method: "PATCH",
        body: JSON.stringify({
          id: Number(bookingId),
        }),
      });

      /*
       * PHP returns { id } after cancellation, rather than the
       * full booking. Return a useful minimal object.
       */
      return {
        id: Number(result.id),
        status: "cancelled",
      };
    },

    // ----------------------------------------------------------
    // Live tracking
    // ----------------------------------------------------------

    getLiveTrip: async () => {
      return await request("/tracking/index.php");
    },

    // ----------------------------------------------------------
    // Feedback / complaints
    // ----------------------------------------------------------

    submitFeedback: async (payload) => {
      return await request("/feedback/index.php", {
        method: "POST",
        body: JSON.stringify({
          type: payload.type,
          trip: payload.trip,
          message: payload.message,
        }),
      });
    },

    getMyFeedback: async () => {
      return await request("/feedback/index.php");
    },

    updateMyFeedback: async (id, patch) => {
      return await request("/feedback/index.php", {
        method: "PATCH",
        body: JSON.stringify({
          id: Number(id),
          message: patch.message,
        }),
      });
    },

    deleteMyFeedback: async (id) => {
      return await request(
        `/feedback/index.php?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
    },

    // ----------------------------------------------------------
    // SOS
    // ----------------------------------------------------------

    triggerSOS: async (payload) => {
      return await request("/sos/index.php", {
        method: "POST",
        body: JSON.stringify({
          trip: payload.trip ?? payload.bookingId ?? null,
          note: payload.note ?? "",
        }),
      });
    },

    getMySOSAlerts: async () => {
      return await request("/sos/index.php");
    },

    // ----------------------------------------------------------
    // Emergency contacts
    // ----------------------------------------------------------

    getEmergencyContacts: async () => {
      return await request("/contacts/index.php");
    },

    addEmergencyContact: async (contact) => {
      return await request("/contacts/index.php", {
        method: "POST",
        body: JSON.stringify({
          name: contact.name,
          phone: contact.phone,
        }),
      });
    },

    removeEmergencyContact: async (id) => {
      return await request(
        `/contacts/index.php?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
    },
  };
})();