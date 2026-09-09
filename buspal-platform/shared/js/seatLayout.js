/* ============================================================
   BusPal — Shared Seat Layout Generator

   Matches BT Express's actual paper seat chart: sequential numbering
   down the coach, 2 seats + aisle + 2 seats per row, with a full-width
   back bench taking whatever seats don't fit evenly into rows of 4.

   Example (37 seats — verified against the real BT Express sheet):
     Row 1: 01 02 | 03 04
     Row 2: 05 06 | 07 08
     ...
     Row 8: 29 30 | 31 32
     Back : 33 34 35 36 37   (5-seat bench, no aisle)

   Works for any capacity, not just 37/49/51 — picks whichever back-row
   size (5, then 3, then others) divides the remaining seats evenly
   into rows of 4, so odd fleet sizes still lay out sensibly instead
   of erroring or leaving a lopsided last row.
   ============================================================ */

const SeatLayout = (() => {

  function generate(capacity) {
    capacity = Math.max(1, Number(capacity) || 40);

    let backRowSize = 0;
    let fullRows = 0;
    for (const candidate of [5, 3, 7, 1, 2, 4, 6]) {
      if (capacity > candidate && (capacity - candidate) % 4 === 0) {
        backRowSize = candidate;
        fullRows = (capacity - candidate) / 4;
        break;
      }
    }
    // Fallback for tiny/odd capacities nothing above evenly divides.
    if (fullRows === 0 && backRowSize === 0) {
      fullRows = Math.floor(capacity / 4);
      backRowSize = capacity - fullRows * 4;
    }

    const rows = [];
    let n = 1;
    for (let r = 0; r < fullRows; r++) {
      rows.push({ type: "pair", seats: [n, n + 1, n + 2, n + 3] });
      n += 4;
    }
    if (backRowSize > 0) {
      rows.push({ type: "bench", seats: Array.from({ length: backRowSize }, (_, i) => n + i) });
    }
    return rows;
  }

  /** Flat list of every seat number (as strings, matching how seat IDs are stored/compared elsewhere) for a given capacity. */
  function seatIds(capacity) {
    return generate(capacity).flatMap(row => row.seats).map(String);
  }

  return { generate, seatIds };
})();
