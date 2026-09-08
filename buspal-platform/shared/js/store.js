/* ============================================================
   BusPal — Shared Booking / Feedback / SOS Store (mock, client-side)

   Same pattern as shared/js/auth.js: localStorage stands in for the
   real backend so passenger, operator, and the conductor view all see
   consistent data within one browser, instead of each page holding
   its own private in-memory copy. Swap each function body for a real
   fetch() call later — shapes stay the same.

   Bookings are matched to a specific trip by (from, to, date, depTime)
   rather than a shared numeric ID, since the passenger side's trip
   listings and the operator side's Route/Departure records aren't
   unified into one id space yet — this is a deliberate bridge, not
   the final data model. Note it as a simplification in your report.
   ============================================================ */

const BusPalStore = (() => {
  const BOOKINGS_KEY = "buspal_bookings";
  const FEEDBACK_KEY = "buspal_feedback";
  const SOS_KEY = "buspal_sos";

  const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  }
  function write(key, list) { localStorage.setItem(key, JSON.stringify(list)); }

  function seedIfEmpty() {
    if (!read(BOOKINGS_KEY).length) {
      write(BOOKINGS_KEY, [
        {
          id: "BK-88231", passengerId: "ACC-P1", passengerName: "R. Kavishali", phone: "077 123 4567",
          from: "Colombo", to: "Kandy", date: "2026-08-02", depTime: "06:30", arrTime: "09:15",
          plate: "BT-2214", busType: "AC Luxury", price: 1250,
          pickupPoint: "Colombo", seats: ["8"], pnr: "BP7X9K2", status: "upcoming",
          bookedAt: "2026-07-29T10:00:00", source: "self",
        },
        {
          id: "BK-87650", passengerId: "ACC-P1", passengerName: "R. Kavishali", phone: "077 123 4567",
          from: "Colombo", to: "Galle", date: "2026-07-10", depTime: "07:15", arrTime: "09:30",
          plate: "BT-3390", busType: "AC Luxury", price: 1100,
          pickupPoint: "Colombo", seats: ["10", "11"], pnr: "BP4M1J8", status: "completed",
          bookedAt: "2026-07-08T09:00:00", source: "self",
        },
      ]);
    }
    if (!read(FEEDBACK_KEY).length) {
      write(FEEDBACK_KEY, [
        { id: "FB-01", type: "complaint", passengerId: "ACC-P1", passengerName: "R. Kavishali", trip: "Colombo → Kandy · BK-88231", message: "AC wasn't working well on the upper deck.", status: "open", createdAt: "2026-07-30T09:20:00" },
        { id: "FB-02", type: "feedback", passengerId: "ACC-P2", passengerName: "N. Silva", trip: "Colombo → Galle", message: "Driver was excellent, very smooth trip!", status: "closed", createdAt: "2026-07-28T14:05:00" },
      ]);
    }
    if (!read(SOS_KEY).length) {
      write(SOS_KEY, [
        { id: "SOS-01", passengerId: "ACC-P1", passengerName: "R. Kavishali", trip: "Colombo → Kandy · BK-88231", note: "Triggered from dashboard", status: "resolved", createdAt: "2026-07-25T18:40:00" },
      ]);
    }
  }

  // ---------------- bookings ----------------
  function getAllBookings() { return read(BOOKINGS_KEY); }

  function getBookingsForPassenger(passengerId) {
    return read(BOOKINGS_KEY).filter(b => b.passengerId === passengerId)
      .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt));
  }

  /** Seats already taken for a specific trip instance (excludes cancelled). */
  function takenSeats(from, to, date, depTime) {
    return read(BOOKINGS_KEY)
      .filter(b => b.from === from && b.to === to && b.date === date && b.depTime === depTime && b.status !== "cancelled")
      .flatMap(b => b.seats);
  }

  function getManifest(from, to, date, depTime) {
    return read(BOOKINGS_KEY)
      .filter(b => b.from === from && b.to === to && b.date === date && b.depTime === depTime && b.status !== "cancelled")
      .sort((a, b) => a.seats[0].localeCompare(b.seats[0]));
  }

  function createBooking(data) {
    const bookings = read(BOOKINGS_KEY);
    const booking = {
      id: uid("BK"), pnr: "BP" + Math.random().toString(36).slice(2, 8).toUpperCase(),
      status: "upcoming", bookedAt: new Date().toISOString(), source: "self",
      ...data,
    };
    bookings.push(booking);
    write(BOOKINGS_KEY, bookings);
    return booking;
  }

  function cancelBooking(id) {
    const bookings = read(BOOKINGS_KEY).map(b => b.id === id ? { ...b, status: "cancelled" } : b);
    write(BOOKINGS_KEY, bookings);
    return bookings.find(b => b.id === id);
  }

  /** True removal from the record — different from cancelBooking, which just flips status and keeps history. Frees the seat either way, since takenSeats() already excludes cancelled bookings and deleted ones obviously vanish entirely. */
  function deleteBooking(id) {
    write(BOOKINGS_KEY, read(BOOKINGS_KEY).filter(b => b.id !== id));
    return { id };
  }

  // ---------------- feedback ----------------
  function getFeedback() { return read(FEEDBACK_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  function submitFeedback(data) {
    const list = read(FEEDBACK_KEY);
    const entry = { id: uid("FB"), status: "open", createdAt: new Date().toISOString(), ...data };
    list.push(entry);
    write(FEEDBACK_KEY, list);
    return entry;
  }
  function resolveFeedback(id) {
    const list = read(FEEDBACK_KEY).map(f => f.id === id ? { ...f, status: "closed" } : f);
    write(FEEDBACK_KEY, list);
    return list.find(f => f.id === id);
  }
  function updateFeedback(id, patch) {
    const list = read(FEEDBACK_KEY).map(f => f.id === id ? { ...f, ...patch } : f);
    write(FEEDBACK_KEY, list);
    return list.find(f => f.id === id);
  }
  function deleteFeedback(id) {
    write(FEEDBACK_KEY, read(FEEDBACK_KEY).filter(f => f.id !== id));
    return { id };
  }

  // ---------------- SOS ----------------
  function getSOSAlerts() { return read(SOS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  function triggerSOS(data) {
    const list = read(SOS_KEY);
    const entry = { id: uid("SOS"), status: "open", createdAt: new Date().toISOString(), ...data };
    list.push(entry);
    write(SOS_KEY, list);
    return entry;
  }
  function resolveSOS(id) {
    const list = read(SOS_KEY).map(s => s.id === id ? { ...s, status: "resolved" } : s);
    write(SOS_KEY, list);
    return list.find(s => s.id === id);
  }
  function deleteSOS(id) {
    write(SOS_KEY, read(SOS_KEY).filter(s => s.id !== id));
    return { id };
  }

  /**
   * Auto-cleanup: removes feedback/SOS records older than 30 days —
   * but ONLY ones already closed/resolved. An open complaint or an
   * unresolved SOS alert never gets silently deleted just because
   * time passed; only the ones someone already dealt with age out,
   * so operators aren't drowning in old resolved records forever.
   * Runs once per store initialization (see seedIfEmpty's caller).
   */
  function purgeOldClosedEntries() {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const feedback = read(FEEDBACK_KEY).filter(f => !(f.status === "closed" && new Date(f.createdAt).getTime() < cutoff));
    write(FEEDBACK_KEY, feedback);

    const sos = read(SOS_KEY).filter(s => !(s.status === "resolved" && new Date(s.createdAt).getTime() < cutoff));
    write(SOS_KEY, sos);
  }

  // ---------------- conductor trip-access codes ----------------
  // No separate conductor login (by design — see shared/js/auth.js roles).
  // Instead: an owner/manager generates a short code scoped to ONE trip
  // instance, and hands it to whichever staff member is conducting that
  // trip. The standalone conductor/ page asks for this code and, if valid,
  // opens ONLY that trip's seat chart — no other dashboard access at all.
  const TRIP_CODES_KEY = "buspal_trip_codes";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 — avoids misreads

  function getOrCreateTripCode(from, to, date, depTime, meta = {}) {
    const codes = read(TRIP_CODES_KEY);
    const existing = codes.find(c => c.from === from && c.to === to && c.date === date && c.depTime === depTime);
    if (existing) { Object.assign(existing, meta); write(TRIP_CODES_KEY, codes); return existing; }
    let code;
    do {
      code = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    } while (codes.some(c => c.code === code));
    const entry = { code, from, to, date, depTime, createdAt: new Date().toISOString(), ...meta };
    codes.push(entry);
    write(TRIP_CODES_KEY, codes);
    return entry;
  }

  function getTripByCode(code) {
    return read(TRIP_CODES_KEY).find(c => c.code === String(code).toUpperCase().trim()) || null;
  }

  // ---------------- live tracking (operator-managed, passenger-read) ----------------
  // Full CRUD lives on the operator side (start a trip tracking, advance its
  // current stop/ETA as it progresses, end it); the passenger side only ever
  // reads whichever record matches their own upcoming booking's route+time.
  const LIVE_TRACKING_KEY = "buspal_live_tracking";

  function getLiveTrips() {
    return read(LIVE_TRACKING_KEY).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  function getActiveLiveTrips() {
    return getLiveTrips().filter(t => t.status === "in-progress");
  }

  /** Passenger-side lookup: is there an active, visible tracking session for this exact trip instance? */
  function findActiveLiveTrip(from, to, date, depTime) {
    return getActiveLiveTrips().find(t => t.visible !== false && t.from === from && t.to === to && t.date === date && t.depTime === depTime) || null;
  }

  function startLiveTrip(data) {
    const list = read(LIVE_TRACKING_KEY);
    const entry = {
      id: uid("LT"), status: "in-progress", currentStopIndex: 0, etaMinutes: 30, visible: true,
      updatedAt: new Date().toISOString(), ...data,
      stops: (data.stops || []).map((name, i) => ({ name, status: i === 0 ? "current" : "pending" })),
    };
    list.push(entry);
    write(LIVE_TRACKING_KEY, list);
    return entry;
  }

  function toggleLiveTripVisibility(id) {
    const list = read(LIVE_TRACKING_KEY).map(t => t.id === id ? { ...t, visible: t.visible === false, updatedAt: new Date().toISOString() } : t);
    write(LIVE_TRACKING_KEY, list);
    return list.find(t => t.id === id);
  }

  function updateLiveTrip(id, patch) {
    const list = read(LIVE_TRACKING_KEY).map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t);
    write(LIVE_TRACKING_KEY, list);
    return list.find(t => t.id === id);
  }

  /** Advances to the next stop, marking prior stops done and the new one current. Ends the trip automatically once the last stop is reached. */
  function advanceLiveTrip(id) {
    const list = read(LIVE_TRACKING_KEY);
    const trip = list.find(t => t.id === id);
    if (!trip) return null;
    const nextIndex = trip.currentStopIndex + 1;
    trip.stops = trip.stops.map((s, i) => ({
      ...s,
      status: i < nextIndex ? "done" : i === nextIndex ? "current" : "pending",
    }));
    trip.currentStopIndex = nextIndex;
    if (nextIndex >= trip.stops.length - 1) {
      trip.stops[trip.stops.length - 1].status = "done";
      trip.status = "completed";
    }
    trip.updatedAt = new Date().toISOString();
    write(LIVE_TRACKING_KEY, list);
    return trip;
  }

  function endLiveTrip(id) {
    return updateLiveTrip(id, { status: "completed" });
  }

  function deleteLiveTrip(id) {
    write(LIVE_TRACKING_KEY, read(LIVE_TRACKING_KEY).filter(t => t.id !== id));
    return { id };
  }

  // ---------------- bus photos ----------------
  // Bus records themselves live in the operator's own data.js (like
  // routes/staff), not in this shared store — but their photos need to
  // be readable from the passenger side too, so they live here, keyed
  // by plate number. Operator manages them from the Buses form; the
  // Book a Trip page reads them by the plate already on each trip.
  const BUS_PHOTOS_KEY = "buspal_bus_photos";

  function getBusPhotos(plate) {
    const all = read(BUS_PHOTOS_KEY);
    const rec = Array.isArray(all) ? all.find(p => p.plate === plate) : null;
    return rec ? rec.photos.filter(Boolean) : [];
  }

  function setBusPhotos(plate, photos) {
    let all = read(BUS_PHOTOS_KEY);
    if (!Array.isArray(all)) all = [];
    const idx = all.findIndex(p => p.plate === plate);
    const entry = { plate, photos: photos.filter(Boolean) };
    if (idx >= 0) all[idx] = entry; else all.push(entry);
    write(BUS_PHOTOS_KEY, all);
    return entry;
  }

  /** If a bus's plate is edited, carry its photos over to the new plate instead of orphaning them. */
  function renameBusPhotos(oldPlate, newPlate) {
    if (oldPlate === newPlate) return;
    const photos = getBusPhotos(oldPlate);
    if (!photos.length) return;
    setBusPhotos(newPlate, photos);
    write(BUS_PHOTOS_KEY, read(BUS_PHOTOS_KEY).filter(p => p.plate !== oldPlate));
  }

  // ---------------- SOS emergency contacts ----------------
  // Kept genuinely persistent (unlike the rest of the passenger profile,
  // which is currently in-memory only) since this is safety-relevant
  // data someone would reasonably expect to survive closing the tab.
  const EMERGENCY_CONTACTS_KEY = "buspal_emergency_contacts";

  function getEmergencyContacts(passengerId) {
    const all = read(EMERGENCY_CONTACTS_KEY);
    const rec = Array.isArray(all) ? all.find(c => c.passengerId === passengerId) : null;
    return rec ? rec.contacts : [];
  }

  function addEmergencyContact(passengerId, { name, phone }) {
    let all = read(EMERGENCY_CONTACTS_KEY);
    if (!Array.isArray(all)) all = [];
    let rec = all.find(c => c.passengerId === passengerId);
    if (!rec) { rec = { passengerId, contacts: [] }; all.push(rec); }
    const contact = { id: uid("EC"), name, phone };
    rec.contacts.push(contact);
    write(EMERGENCY_CONTACTS_KEY, all);
    return contact;
  }

  function removeEmergencyContact(passengerId, contactId) {
    const all = read(EMERGENCY_CONTACTS_KEY);
    const rec = Array.isArray(all) ? all.find(c => c.passengerId === passengerId) : null;
    if (rec) rec.contacts = rec.contacts.filter(c => c.id !== contactId);
    write(EMERGENCY_CONTACTS_KEY, all);
    return { id: contactId };
  }

  return {
    seedIfEmpty,
    getAllBookings, getBookingsForPassenger, takenSeats, getManifest, createBooking, cancelBooking, deleteBooking,
    getFeedback, submitFeedback, resolveFeedback, updateFeedback, deleteFeedback,
    getSOSAlerts, triggerSOS, resolveSOS, deleteSOS, purgeOldClosedEntries,
    getOrCreateTripCode, getTripByCode,
    getLiveTrips, getActiveLiveTrips, findActiveLiveTrip, startLiveTrip, updateLiveTrip, toggleLiveTripVisibility, advanceLiveTrip, endLiveTrip, deleteLiveTrip,
    getBusPhotos, setBusPhotos, renameBusPhotos,
    getEmergencyContacts, addEmergencyContact, removeEmergencyContact,
  };
})();

BusPalStore.seedIfEmpty();
BusPalStore.purgeOldClosedEntries();
