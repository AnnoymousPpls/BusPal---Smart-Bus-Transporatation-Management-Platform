/*
 * BusPal — Operator Live Tracking PDF Report
 *
 * IMPORTANT
 * - The Tracking page uses ONE button only: "Generate Report".
 * - Clicking it opens a PDF preview in a new browser tab.
 * - The browser PDF viewer provides the normal Download button.
 * - Nothing is downloaded automatically by BusPal.
 *
 * Expected call:
 *
 *   generateTrackingReport({
 *     trips,
 *     liveTrips
 *   });
 */

(() => {

  const C = {
    navy: [17, 58, 112],
    blue: [45, 105, 225],
    blueLight: [235, 243, 255],
    green: [22, 163, 74],
    red: [220, 38, 38],
    orange: [217, 119, 6],
    text: [35, 48, 65],
    muted: [91, 105, 126],
    border: [211, 220, 231],
    panel: [248, 250, 253],
    white: [255, 255, 255]
  };

  const P = {
    left: 16,
    right: 194,
    top: 16,
    bottom: 281,
    width: 210
  };

  /* =========================================================
     BASIC HELPERS
     ========================================================= */

  const arr = x => Array.isArray(x) ? x : [];

  const text = (x, fallback = "Unknown") =>
    x == null || String(x).trim() === ""
      ? fallback
      : String(x);

  const safeNumber = x => {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  };

  const status = x =>
    text(x, "unknown").toLowerCase().trim();

  const short = (x, n = 24) => {
    const s = text(x);
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };

  function dateText(value) {
    if (!value) return "—";

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return text(value, "—");
    }

    return d.toLocaleDateString("en-GB");
  }

  function formatClock(date) {
    if (!date) return "—";

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function parseTimeToMinutes(value) {

    if (value === null || value === undefined) {
      return null;
    }

    const s = String(value)
      .trim()
      .toUpperCase();

    if (!s) return null;

    const match = s.match(
      /^(\d{1,2})(?:[:.](\d{1,2}))?\s*(AM|PM)?$/
    );

    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2] || 0);
    const period = match[3];

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    if (minutes < 0 || minutes > 59) {
      return null;
    }

    if (period) {

      if (hours < 1 || hours > 12) {
        return null;
      }

      if (period === "AM" && hours === 12) {
        hours = 0;
      }

      if (period === "PM" && hours !== 12) {
        hours += 12;
      }

    } else {

      if (hours < 0 || hours > 23) {
        return null;
      }

    }

    return hours * 60 + minutes;
  }

  function createLocalDate(dateValue, timeValue) {

    if (!dateValue || !timeValue) {
      return null;
    }

    const parts = String(dateValue).trim().split("-");

    if (parts.length !== 3) {
      return null;
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);

    const timeMinutes = parseTimeToMinutes(timeValue);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      timeMinutes === null
    ) {
      return null;
    }

    const hours = Math.floor(timeMinutes / 60);
    const minutes = timeMinutes % 60;

    const d = new Date(
      year,
      month - 1,
      day,
      hours,
      minutes,
      0,
      0
    );

    return Number.isNaN(d.getTime()) ? null : d;
  }

  function getTripTiming(t) {

    const departureAt = createLocalDate(
      t.date,
      t.depTime
    );

    const etaMinutes = Math.max(
      0,
      safeNumber(t.etaMinutes)
    );

    if (!departureAt) {

      return {
        valid: false,
        departureAt: null,
        arrivalAt: null,
        etaMinutes,
        state: "unknown",
        remainingMinutes: null,
        elapsedMinutes: null,
        progress: 0
      };

    }

    const arrivalAt = new Date(
      departureAt.getTime() +
      etaMinutes * 60000
    );

    const now = new Date();

    let state = "ended";

    if (now.getTime() < departureAt.getTime()) {
      state = "upcoming";
    } else if (now.getTime() < arrivalAt.getTime()) {
      state = "live";
    }

    const remainingMinutes = Math.max(
      0,
      Math.ceil(
        (arrivalAt.getTime() - now.getTime()) / 60000
      )
    );

    const elapsedMinutes = Math.max(
      0,
      Math.floor(
        (now.getTime() - departureAt.getTime()) / 60000
      )
    );

    const total = Math.max(
      1,
      arrivalAt.getTime() - departureAt.getTime()
    );

    const progress = Math.min(
      1,
      Math.max(
        0,
        (now.getTime() - departureAt.getTime()) / total
      )
    );

    return {
      valid: true,
      departureAt,
      arrivalAt,
      etaMinutes,
      state,
      remainingMinutes,
      elapsedMinutes,
      progress
    };
  }

  function formatDuration(minutes) {

    const value = Math.max(
      0,
      Math.round(safeNumber(minutes))
    );

    const hours = Math.floor(value / 60);
    const mins = value % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }

    return `${mins}m`;
  }

  function stateLabel(state) {

    if (state === "live") return "LIVE";
    if (state === "upcoming") return "UPCOMING";
    if (state === "ended") return "COMPLETED";

    return "UNKNOWN";
  }

  function stateColor(state) {

    if (state === "live") return C.green;
    if (state === "upcoming") return C.orange;
    if (state === "ended") return C.muted;

    return C.muted;
  }

  /* =========================================================
     jsPDF LOADER
     ========================================================= */

  function loadJsPDF() {

    if (window.jspdf?.jsPDF) {
      return Promise.resolve(window.jspdf.jsPDF);
    }

    return new Promise((resolve, reject) => {

      const existing = document.querySelector(
        'script[data-buspal-tracking-jspdf="true"]'
      );

      if (existing) {

        if (window.jspdf?.jsPDF) {
          resolve(window.jspdf.jsPDF);
          return;
        }

        existing.addEventListener(
          "load",
          () => {
            window.jspdf?.jsPDF
              ? resolve(window.jspdf.jsPDF)
              : reject(new Error("jsPDF unavailable"));
          },
          { once: true }
        );

        existing.addEventListener(
          "error",
          () => reject(new Error("jsPDF failed to load")),
          { once: true }
        );

        return;
      }

      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js";

      script.async = true;
      script.dataset.buspalTrackingJspdf = "true";

      script.onload = () => {

        if (window.jspdf?.jsPDF) {
          resolve(window.jspdf.jsPDF);
        } else {
          reject(new Error("jsPDF unavailable"));
        }

      };

      script.onerror = () =>
        reject(new Error("Could not load jsPDF"));

      document.head.appendChild(script);
    });
  }

  /* =========================================================
     PDF DRAWING HELPERS
     ========================================================= */

  const fill = (doc, c) => doc.setFillColor(...c);
  const draw = (doc, c) => doc.setDrawColor(...c);
  const font = (doc, c) => doc.setTextColor(...c);

  function box(doc, x, y, w, h, filled = true) {

    doc.roundedRect(
      x,
      y,
      w,
      h,
      3,
      3,
      filled ? "FD" : "S"
    );
  }


  /* ---- BusPal logo for the PDF header (loaded once, safe if it fails) ---- */
  let LOGO_DATA = null;

  async function loadLogoData() {
    if (LOGO_DATA) return LOGO_DATA;
    try {
      const url = new URL("../shared/assets/logo.png", document.baseURI).href;
      const response = await fetch(url);
      if (!response.ok) throw new Error("logo " + response.status);
      const blob = await response.blob();
      LOGO_DATA = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("logo read failed"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn("BusPal logo could not be loaded for the PDF.", error);
      LOGO_DATA = null;
    }
    return LOGO_DATA;
  }

  function drawLogo(doc, x, y, size) {
    if (!LOGO_DATA) return false;
    try {
      doc.addImage(LOGO_DATA, "PNG", x, y, size, size);
      return true;
    } catch (error) {
      console.warn("BusPal logo could not be drawn.", error);
      return false;
    }
  }

  function header(doc, page, total) {

    fill(doc, C.blue);
    doc.rect(0, 0, 210, 3, "F");

    // logo first; text shifts right only when the logo really drew
    const logoShift = drawLogo(doc, P.left, 5, 9) ? 11 : 0;

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("BusPal", P.left + logoShift, 11);

    font(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(
      "Live Tracking Report",
      P.left + logoShift + 19,
      11
    );

    if (total) {
      doc.text(
        `Page ${page} of ${total}`,
        P.right,
        11,
        { align: "right" }
      );
    }
  }

  function footer(doc) {

    draw(doc, C.border);
    doc.setLineWidth(.25);
    doc.line(P.left, 286, P.right, 286);

    font(doc, C.muted);
    doc.setFontSize(6.8);
    doc.text(
      "BusPal • Smart Bus Transportation Platform",
      P.left,
      291
    );

    doc.text(
      "Generated automatically",
      P.right,
      291,
      { align: "right" }
    );
  }

  function title(doc, t, sub) {

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(t, P.left, 28);

    font(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(sub, P.left, 35);

    draw(doc, C.border);
    doc.line(P.left, 40, P.right, 40);
  }

  function reportDate(doc) {

    const d = new Date().toLocaleDateString(
      "en-GB",
      {
        day: "2-digit",
        month: "long",
        year: "numeric"
      }
    );

    fill(doc, C.blueLight);
    draw(doc, [190, 207, 232]);

    box(doc, 150, 16, 44, 22, true);

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text("REPORT DATE", 154, 23);

    font(doc, C.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(d, 154, 30);
  }

  function card(doc, x, y, w, value, label, color) {

    fill(doc, C.white);
    draw(doc, C.border);
    box(doc, x, y, w, 25, true);

    fill(doc, color);
    doc.roundedRect(
      x,
      y,
      2.2,
      25,
      1,
      1,
      "F"
    );

    font(doc, color);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(
      String(value),
      x + 6,
      y + 10
    );

    font(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      label,
      x + 6,
      y + 18
    );
  }

  function panel(
    doc,
    x,
    y,
    w,
    h,
    heading,
    sub
  ) {

    fill(doc, C.white);
    draw(doc, C.border);
    box(doc, x, y, w, h, true);

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      heading,
      x + 7,
      y + 10
    );

    font(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.text(
      sub,
      x + 7,
      y + 16
    );
  }

  /* =========================================================
     FINDINGS
     ========================================================= */

  function findings(active, upcoming, completed) {

    const out = [];

    out.push(
      `${active.length} trip${active.length === 1 ? "" : "s"} currently live.`
    );

    out.push(
      `${upcoming.length} upcoming tracked trip${upcoming.length === 1 ? "" : "s"}.`
    );

    out.push(
      `${completed.length} completed tracking record${completed.length === 1 ? "" : "s"}.`
    );

    if (active.length) {

      const live = active
        .map(t => ({
          t,
          timing: getTripTiming(t)
        }))
        .sort(
          (a, b) =>
            b.timing.progress -
            a.timing.progress
        );

      const mostProgressed = live[0];

      out.push(
        `${text(mostProgressed.t.from)} - ${text(mostProgressed.t.to)} is ${Math.round(mostProgressed.timing.progress * 100)}% through its ETA window.`
      );
    }

    return out;
  }

  function findingsBox(doc, items, y) {

    const h = 20 + items.length * 9;

    fill(doc, C.blueLight);
    draw(doc, [190, 207, 232]);

    box(
      doc,
      P.left,
      y,
      P.right - P.left,
      h,
      true
    );

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      "Key Findings",
      P.left + 7,
      y + 10
    );

    items.forEach((s, i) => {

      const yy = y + 19 + i * 9;

      fill(doc, C.blue);
      doc.circle(
        P.left + 8,
        yy - 2,
        1,
        "F"
      );

      font(doc, C.text);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);

      doc.text(
        short(s, 125),
        P.left + 13,
        yy
      );
    });
  }

  /* =========================================================
     STATUS DONUT
     ========================================================= */

  function donut(
    doc,
    data,
    x,
    y,
    w,
    h,
    heading,
    sub,
    palette
  ) {

    panel(
      doc,
      x,
      y,
      w,
      h,
      heading,
      sub
    );

    const total = data.reduce(
      (sum, item) =>
        sum + item.value,
      0
    );

    if (!total) {

      font(doc, C.muted);
      doc.setFontSize(8);

      doc.text(
        "No data available",
        x + w / 2,
        y + h / 2,
        { align: "center" }
      );

      return;
    }

    const cx = x + 55;
    const cy = y + 58;
    const r = 31;
    const inner = 17;

    let start = -Math.PI / 2;

    data.forEach((item, i) => {

      const angle =
        (item.value / total) *
        Math.PI *
        2;

      const steps =
        Math.max(
          8,
          Math.ceil(angle * 16)
        );

      fill(
        doc,
        palette[i % palette.length]
      );

      for (let j = 0; j < steps; j++) {

        const a1 =
          start +
          angle * j / steps;

        const a2 =
          start +
          angle * (j + 1) / steps;

        const x1 =
          cx +
          r *
          Math.cos(a1);

        const y1 =
          cy +
          r *
          Math.sin(a1);

        const x2 =
          cx +
          r *
          Math.cos(a2);

        const y2 =
          cy +
          r *
          Math.sin(a2);

        try {
          doc.triangle(
            cx,
            cy,
            x1,
            y1,
            x2,
            y2,
            "F"
          );
        } catch (_) {}
      }

      start += angle;
    });

    fill(doc, C.white);
    doc.circle(
      cx,
      cy,
      inner,
      "F"
    );

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(
      String(total),
      cx,
      cy + 2,
      { align: "center" }
    );

    font(doc, C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.text(
      "trips",
      cx,
      cy + 8,
      { align: "center" }
    );

    data.forEach((item, i) => {

      const ly =
        y + 43 + i * 12;

      fill(
        doc,
        palette[i % palette.length]
      );

      doc.rect(
        x + 105,
        ly - 3,
        4,
        4,
        "F"
      );

      font(doc, C.text);
      doc.setFontSize(6.5);
      doc.text(
        `${short(item.label, 25)} (${item.value})`,
        x + 112,
        ly
      );
    });
  }

  /* =========================================================
     BAR CHART
     ========================================================= */

  function bar(
    doc,
    data,
    x,
    y,
    w,
    h,
    heading,
    sub,
    color
  ) {

    panel(
      doc,
      x,
      y,
      w,
      h,
      heading,
      sub
    );

    if (!data.length) {

      font(doc, C.muted);
      doc.setFontSize(8);

      doc.text(
        "No data available",
        x + w / 2,
        y + h / 2,
        { align: "center" }
      );

      return;
    }

    const cx = x + 15;
    const cy = y + 27;
    const cw = w - 25;
    const ch = h - 43;

    const max = Math.max(
      1,
      ...data.map(
        d => d.value
      )
    );

    draw(doc, C.border);
    doc.setLineWidth(.2);

    for (let i = 0; i <= 4; i++) {

      const gy =
        cy +
        ch -
        ch * i / 4;

      doc.line(
        cx,
        gy,
        cx + cw,
        gy
      );

      font(doc, C.muted);
      doc.setFontSize(5.3);

      doc.text(
        String(
          Math.round(
            max * i / 4
          )
        ),
        cx - 2,
        gy + 2,
        { align: "right" }
      );
    }

    const gap = 7;

    const bw = Math.max(
      12,
      (
        cw -
        gap * (data.length - 1)
      ) / data.length
    );

    data.forEach((d, i) => {

      const bh =
        ch *
        d.value /
        max;

      const bx =
        cx +
        i * (bw + gap);

      const by =
        cy +
        ch -
        bh;

      fill(doc, color);

      doc.roundedRect(
        bx,
        by,
        bw,
        bh,
        1.5,
        1.5,
        "F"
      );

      font(doc, C.text);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);

      doc.text(
        String(d.value),
        bx + bw / 2,
        by - 3,
        { align: "center" }
      );

      font(doc, C.muted);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);

      doc.text(
        short(d.label, 16),
        bx + bw / 2,
        cy + ch + 9,
        {
          align: "center",
          maxWidth: bw + 12
        }
      );
    });
  }

  /* =========================================================
     TRACKING TABLE
     ========================================================= */

  function trackingRows(items) {

    return items.map(t => {

      const timing =
        getTripTiming(t);

      return {
        route:
          `${text(t.from)} - ${text(t.to)}`,
        date:
          text(t.date, "—"),
        departure:
          timing.valid
            ? formatClock(timing.departureAt)
            : text(t.depTime, "—"),
        arrival:
          timing.valid
            ? formatClock(timing.arrivalAt)
            : "—",
        bus:
          text(t.busPlate, "—"),
        driver:
          text(t.driverName, "—"),
        eta:
          formatDuration(t.etaMinutes),
        status:
          stateLabel(timing.state),
        visibility:
          t.visible === false
            ? "Hidden"
            : "Visible"
      };

    });
  }

  function table(
    doc,
    rows,
    startY
  ) {

    if (!rows.length) {

      font(doc, C.muted);
      doc.setFontSize(8);

      doc.text(
        "No tracking records available.",
        P.left,
        startY
      );

      return;
    }

    const heads = [
      "Route",
      "Date",
      "Dep.",
      "Arrival",
      "Bus",
      "Driver",
      "ETA",
      "Status"
    ];

    const widths = [
      40,
      23,
      20,
      24,
      21,
      25,
      17,
      20
    ];

    const total =
      widths.reduce(
        (a, b) => a + b,
        0
      );

    const rowHeight = 8;
    const x = P.left;

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(
      "Tracking Records",
      x,
      startY
    );

    let y = startY + 8;

    function drawHeader() {

      fill(doc, C.blue);

      doc.rect(
        x,
        y,
        total,
        8,
        "F"
      );

      let hx = x;

      heads.forEach((h, i) => {

        font(doc, C.white);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.2);

        doc.text(
          h,
          hx + 2,
          y + 5.2
        );

        hx += widths[i];
      });

      y += 8;
    }

    drawHeader();

    rows.forEach((r, index) => {

      if (y > 267) {

        footer(doc);
        doc.addPage();

        header(
          doc,
          doc.getNumberOfPages()
        );

        y = 24;
        drawHeader();
      }

      if (index % 2 === 0) {

        fill(doc, C.panel);

        doc.rect(
          x,
          y,
          total,
          rowHeight,
          "F"
        );
      }

      const values = [
        r.route,
        r.date,
        r.departure,
        r.arrival,
        r.bus,
        r.driver,
        r.eta,
        r.status
      ];

      let cx = x;

      values.forEach((value, i) => {

        draw(doc, C.border);
        doc.setLineWidth(.15);

        doc.rect(
          cx,
          y,
          widths[i],
          rowHeight,
          "S"
        );

        if (i === 7) {

          if (value === "LIVE") {
            font(doc, C.green);
          } else if (value === "UPCOMING") {
            font(doc, C.orange);
          } else {
            font(doc, C.muted);
          }

        } else {
          font(doc, C.text);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(4.8);

        doc.text(
          short(value, i === 0 ? 23 : 14),
          cx + 2,
          y + 5
        );

        cx += widths[i];
      });

      y += rowHeight;
    });
  }

  /* =========================================================
     LIVE PROGRESS TABLE
     ========================================================= */

  function progressTable(
    doc,
    active,
    startY
  ) {

    const rows = active.map(t => {

      const timing =
        getTripTiming(t);

      return [
        `${text(t.from)} - ${text(t.to)}`,
        text(t.busPlate, "—"),
        text(t.driverName, "—"),
        `${Math.round(timing.progress * 100)}%`,
        formatDuration(
          timing.elapsedMinutes
        ),
        formatDuration(
          timing.remainingMinutes
        )
      ];
    });

    const heads = [
      "Live trip",
      "Bus",
      "Driver",
      "Progress",
      "Elapsed",
      "Remaining"
    ];

    const widths = [
      53,
      25,
      32,
      22,
      25,
      25
    ];

    const total =
      widths.reduce(
        (a, b) => a + b,
        0
      );

    font(doc, C.navy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    doc.text(
      "Current Live Progress",
      P.left,
      startY
    );

    let y = startY + 8;

    fill(doc, C.blue);

    doc.rect(
      P.left,
      y,
      total,
      8,
      "F"
    );

    let hx = P.left;

    heads.forEach((h, i) => {

      font(doc, C.white);
      doc.setFontSize(5.6);

      doc.text(
        h,
        hx + 2,
        y + 5.2
      );

      hx += widths[i];
    });

    y += 8;

    rows.forEach((row, index) => {

      if (index % 2 === 0) {

        fill(doc, C.panel);

        doc.rect(
          P.left,
          y,
          total,
          8,
          "F"
        );
      }

      let cx = P.left;

      row.forEach((value, i) => {

        draw(doc, C.border);
        doc.setLineWidth(.15);

        doc.rect(
          cx,
          y,
          widths[i],
          8,
          "S"
        );

        font(
          doc,
          i === 3
            ? C.green
            : C.text
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(5.1);

        doc.text(
          short(value, 22),
          cx + 2,
          y + 5
        );

        cx += widths[i];
      });

      y += 8;
    });

    if (!rows.length) {

      font(doc, C.muted);
      doc.setFontSize(7);

      doc.text(
        "No trips are currently live.",
        P.left,
        y + 7
      );
    }
  }

  /* =========================================================
     OPEN PREVIEW WINDOW
     ========================================================= */

  function openPreviewWindow() {

    const previewWindow =
      window.open(
        "about:blank",
        "_blank"
      );

    if (!previewWindow) {

      if (typeof toast === "function") {
        toast(
          "Preview was blocked. Please allow pop-ups for BusPal."
        );
      }

      return null;
    }

    try {

      previewWindow.document.title =
        "BusPal Tracking Report Preview";

      previewWindow.document.body.innerHTML = `
        <div style="
          margin:0;
          height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          font-family:Arial,sans-serif;
          color:#5b697e;
          background:#f8fafd;
        ">
          Generating tracking report preview…
        </div>
      `;

    } catch (_) {}

    return previewWindow;
  }

  /* =========================================================
     MAIN REPORT GENERATOR
     ========================================================= */

  async function generateTrackingReport({
    trips = [],
    liveTrips = []
  } = {}) {

    trips = arr(trips);
    liveTrips = arr(liveTrips);

    /*
     * IMPORTANT:
     * Open the preview tab immediately, before awaiting jsPDF.
     */
    const previewWindow =
      openPreviewWindow();

    try {

      const jsPDF =
        await loadJsPDF();

      await loadLogoData();

      const doc =
        new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
          compress: true
        });

      /*
       * Build the report from the current tracking state.
       *
       * liveTrips contains active/upcoming/completed
       * tracking records.
       */

      const allTracking =
        liveTrips.length
          ? liveTrips
          : trips;

      const active =
        allTracking.filter(t => {

          if (t.status !== "in-progress") {
            return false;
          }

          return getTripTiming(t).state === "live";
        });

      const upcoming =
        allTracking.filter(t => {

          if (t.status !== "in-progress") {
            return false;
          }

          return getTripTiming(t).state === "upcoming";
        });

      const completed =
        allTracking.filter(
          t => t.status === "completed"
        );

      /*
       * Bus distribution.
       */

      const busMap = new Map();

      allTracking.forEach(t => {

        const bus =
          text(
            t.busPlate,
            "Bus TBA"
          );

        busMap.set(
          bus,
          (busMap.get(bus) || 0) + 1
        );
      });

      const byBus =
        [...busMap.entries()]
          .map(([label, value]) => ({
            label,
            value
          }))
          .sort(
            (a, b) =>
              b.value - a.value
          );

      /*
       * Status distribution.
       */

      const statusData = [
        {
          label: "Live",
          value: active.length
        },
        {
          label: "Upcoming",
          value: upcoming.length
        },
        {
          label: "Completed",
          value: completed.length
        }
      ].filter(x => x.value > 0);

      /* =====================================================
         PAGE 1
         ===================================================== */

      header(doc, 1);

      title(
        doc,
        "Live Tracking Report",
        "Summary of operator tracking activity and current trip status."
      );

      reportDate(doc);

      const cardWidth = 42.5;
      const gap = 3.5;
      const y = 48;

      card(
        doc,
        P.left,
        y,
        cardWidth,
        active.length,
        "Live trips",
        C.green
      );

      card(
        doc,
        P.left + cardWidth + gap,
        y,
        cardWidth,
        upcoming.length,
        "Upcoming",
        C.orange
      );

      card(
        doc,
        P.left + (cardWidth + gap) * 2,
        y,
        cardWidth,
        completed.length,
        "Completed",
        C.blue
      );

      card(
        doc,
        P.left + (cardWidth + gap) * 3,
        y,
        cardWidth,
        allTracking.length,
        "Total records",
        C.navy
      );

      findingsBox(
        doc,
        findings(
          active,
          upcoming,
          completed
        ),
        80
      );

      /*
       * Current live trips first.
       * This gives the report immediate operational value.
       */

      progressTable(
        doc,
        active,
        145
      );

      footer(doc);

      /* =====================================================
         PAGE 2
         ===================================================== */

      doc.addPage();

      header(
        doc,
        2
      );

      title(
        doc,
        "Tracking Analysis",
        "Trip status distribution and buses represented in the tracking records."
      );

      donut(
        doc,
        statusData,
        P.left,
        47,
        P.right - P.left,
        100,
        "Trip Status",
        "Current tracking records grouped by status.",
        [
          C.green,
          C.orange,
          C.blue
        ]
      );

      bar(
        doc,
        byBus.slice(0, 10),
        P.left,
        155,
        P.right - P.left,
        105,
        "Trips by Bus",
        "Number of tracking records associated with each bus.",
        C.blue
      );

      footer(doc);

      /* =====================================================
         PAGE 3
         ===================================================== */

      doc.addPage();

      header(
        doc,
        3
      );

      title(
        doc,
        "Tracking Records",
        "Detailed tracking information captured by the operator dashboard."
      );

      table(
        doc,
        trackingRows(allTracking),
        48
      );

      footer(doc);

      /* =====================================================
         PAGE NUMBERS
         ===================================================== */

      const pages =
        doc.getNumberOfPages();

      for (
        let i = 1;
        i <= pages;
        i++
      ) {

        doc.setPage(i);

        font(
          doc,
          C.muted
        );

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(6.5);

        doc.text(
          `Page ${i} of ${pages}`,
          P.right,
          291,
          { align: "right" }
        );
      }

      /* =====================================================
         PREVIEW
         ===================================================== */

      const blob =
        doc.output("blob");

      const url =
        URL.createObjectURL(blob);

      if (previewWindow) {

        try {

          previewWindow.location.href =
            url;

          previewWindow.focus();

        } catch (_) {

          window.open(
            url,
            "_blank"
          );
        }

        setTimeout(
          () => URL.revokeObjectURL(url),
          120000
        );

      } else {

        window.location.href =
          url;
      }

    } catch (error) {

      console.error(
        "Tracking report error:",
        error
      );

      if (previewWindow) {

        try {

          previewWindow.document.body.innerHTML = `
            <div style="
              padding:30px;
              font-family:Arial,sans-serif;
              color:#dc2626;
            ">
              <h2>Could not generate tracking report</h2>
              <p>${text(error?.message, "Unknown error")}</p>
              <p>Please close this tab and try again.</p>
            </div>
          `;

        } catch (_) {}
      }

      if (typeof toast === "function") {

        toast(
          "Could not generate the Tracking report."
        );
      }
    }
  }

  /*
   * ONLY PUBLIC FUNCTION NEEDED BY THE TRACKING PAGE.
   */
  window.generateTrackingReport =
    generateTrackingReport;

})();
