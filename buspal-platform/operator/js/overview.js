/* ============================================================
   BusPal — Operator Dashboard — Overview
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderOverview(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◈</div>Loading fleet data…</div>`;
    const [stats, staff, fuelLog, liveTrips, bookings] = await Promise.all([
      OpsAPI.getOverviewStats(), OpsAPI.getStaff(), OpsAPI.getFuelLog(), OpsAPI.getLiveTrips(), OpsAPI.getAllBookings(),
    ]);
    refreshSOSBadge();
    const drivers = staff.filter(s => s.role === "driver").length;
    const conductors = staff.filter(s => s.role === "conductor").length;
    const recentFuel = fuelLog.slice(0, 6).reverse().map(f => f.cost);
    const activeTrips = liveTrips.filter(t => t.status === "in-progress");

    const activeBookings = bookings.filter(b => b.status !== "cancelled");
    const totalCollection = activeBookings.reduce((sum, b) => sum + (b.price || 0) * b.seats.length, 0);
    const totalSeatsSold = activeBookings.reduce((sum, b) => sum + b.seats.length, 0);

    // Daily revenue trend for the mini chart — last 7 days that actually have bookings.
    const revenueByDay = {};
    activeBookings.forEach(b => {
      const day = (b.bookedAt || "").slice(0, 10);
      if (!day) return;
      revenueByDay[day] = (revenueByDay[day] || 0) + (b.price || 0) * b.seats.length;
    });
    const recentDays = Object.keys(revenueByDay).sort().slice(-7);
    const trendValues = recentDays.map(d => revenueByDay[d]);

    root.innerHTML = `
      <div class="revenue-hero kpi-clickable" data-go="bookings" title="Go to Bookings">
        <div>
          <div class="revenue-hero-label">Total collection</div>
          <div class="revenue-hero-amount">${fmtLKR(totalCollection)}</div>
          <div class="revenue-hero-sub">${totalSeatsSold} seat${totalSeatsSold === 1 ? "" : "s"} booked · ${activeBookings.length} booking${activeBookings.length === 1 ? "" : "s"}</div>
        </div>
        ${trendValues.length > 1 ? `
          <div class="revenue-hero-chart">
            ${miniBarsSVG(trendValues, "var(--brand-2)", 160, 52)}
            <div class="revenue-hero-chart-label">Last ${trendValues.length} active day${trendValues.length === 1 ? "" : "s"}</div>
          </div>
        ` : ""}
      </div>
      <div class="grid-4">
        <div class="stat-card chart-card kpi-clickable" data-go="buses" title="Go to Buses">
          ${donutSVG(stats.activeBuses, stats.buses, "var(--brand-2)")}
          <div class="chart-card-text"><div class="k">${stats.activeBuses}/${stats.buses}</div><div class="l">Active buses</div></div>
        </div>
        <div class="stat-card chart-card kpi-clickable" data-go="routes" title="Go to Routes & Schedules">
          ${donutSVG(stats.visibleRoutes, stats.routes, "var(--brand)")}
          <div class="chart-card-text"><div class="k">${stats.visibleRoutes}/${stats.routes}</div><div class="l">Visible routes</div></div>
        </div>
        <div class="stat-card chart-card kpi-clickable" data-go="staff" title="Go to Drivers & Conductors">
          ${splitDonutSVG(drivers, conductors, "var(--brand)", "var(--amber)")}
          <div class="chart-card-text">
            <div class="k">${stats.staff}</div>
            <div class="l">
              <span class="chart-legend-dot" style="background:var(--brand)"></span>${drivers} drivers
              &nbsp;<span class="chart-legend-dot" style="background:var(--amber)"></span>${conductors} conductors
            </div>
          </div>
        </div>
        <div class="stat-card chart-card chart-card-wide kpi-clickable" data-go="fuel" title="Go to Fuel Management">
          ${recentFuel.length ? miniBarsSVG(recentFuel, "var(--amber)") : `<div class="chart-donut" style="width:64px"></div>`}
          <div class="chart-card-text"><div class="k">${fmtLKR(stats.fuelSpendMonth)}</div><div class="l">Logged fuel spend · last ${recentFuel.length} entries</div></div>
        </div>
      </div>

      <div class="card card-pad kpi-clickable" data-go="tracking">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${activeTrips.length ? "12" : "0"}px">
          <h3>Live trips</h3>
          <span class="badge ${activeTrips.length ? "info" : "off"}">${activeTrips.length} in progress</span>
        </div>
        ${activeTrips.length ? `
          <div style="display:flex;flex-direction:column;gap:8px">
            ${activeTrips.slice(0, 3).map(t => `
              <div class="dep-row" style="grid-template-columns:1fr auto">
                <div>
                  <span class="cell-strong">${esc(t.from)} → ${esc(t.to)}</span>
                  <span class="cell-sub">${esc(t.busPlate || "Bus TBA")}</span>
                </div>
                <span class="muted small">ETA ${formatEta(t.etaMinutes)}</span>
              </div>
            `).join("")}
            ${activeTrips.length > 3 ? `<div class="muted small">+ ${activeTrips.length - 3} more — view all in Live Tracking</div>` : ""}
          </div>
        ` : `<p class="muted small" style="margin:0">No trips being tracked right now — start one from Live Tracking.</p>`}
      </div>

      <div class="grid-2">
        <div class="card card-pad">
          <h3 style="margin-bottom:12px">Needs attention</h3>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${stats.openSOS ? `<div class="stat-card kpi-clickable" data-go="feedback"><span class="pill open">⚠ ${stats.openSOS} SOS alert(s) unresolved</span><div class="l" style="margin-top:6px">Review immediately in Feedback &amp; SOS.</div></div>` : ""}
            ${stats.openFeedback ? `<div class="stat-card kpi-clickable" data-go="feedback"><span class="pill open">${stats.openFeedback} open complaint(s)</span><div class="l" style="margin-top:6px">Passengers are waiting on a response.</div></div>` : ""}
            ${(!stats.openSOS && !stats.openFeedback) ? emptyHTML("All clear — no open complaints or SOS alerts.") : ""}
          </div>
        </div>
        <div class="card card-pad" style="display:flex;flex-direction:column;gap:10px">
          <h3 style="margin-bottom:4px">Quick actions</h3>
          <button class="btn brand block" data-go="buses"><span class="btn-ico-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="10" rx="2"/><path d="M3 11h18"/><path d="M7 6v5M17 6v5"/><circle cx="7.5" cy="18" r="1.4"/><circle cx="16.5" cy="18" r="1.4"/></svg></span> Add a bus</button>
          <button class="btn block" data-go="routes">⌁ Add a route</button>
          <button class="btn block" data-go="staff">◐ Add driver / conductor</button>
          <button class="btn block" data-go="fuel"><span class="btn-ico-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14"/><path d="M4 21h10"/><path d="M14 10h2l3 3v5a1 1 0 0 1-1 1h-1"/><circle cx="17.5" cy="17" r="1.3"/><path d="M7 6v3h4V6"/></svg></span> Log fuel entry</button>
        </div>
      </div>
    `;
    $$("[data-go]", root).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  }


  // ---------- tiny inline SVG chart helpers (no library, matches plain-JS stack) ----------
  function donutSVG(value, total, colorVar, size = 64, stroke = 8) {
    const pct = total > 0 ? value / total : 0;
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="chart-donut">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--wa-08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colorVar}" stroke-width="${stroke}"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" stroke-linecap="round"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
  }
  function splitDonutSVG(a, b, colorA, colorB, size = 64, stroke = 8) {
    const total = a + b || 1;
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const aLen = c * (a / total);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="chart-donut">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--wa-08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colorA}" stroke-width="${stroke}"
        stroke-dasharray="${aLen} ${c - aLen}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colorB}" stroke-width="${stroke}"
        stroke-dasharray="${c - aLen} ${aLen}" stroke-dashoffset="${-aLen}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
  }
  function miniBarsSVG(values, colorVar, w = 96, h = 40) {
    const max = Math.max(...values, 1);
    const gap = 4, bw = (w - gap * (values.length - 1)) / values.length;
    const bars = values.map((v, i) => {
      const bh = Math.max(3, (v / max) * h);
      return `<rect x="${i * (bw + gap)}" y="${h - bh}" width="${bw}" height="${bh}" rx="2.5" fill="${colorVar}" opacity="${0.45 + 0.55 * ((i + 1) / values.length)}"/>`;
    }).join("");
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="chart-bars">${bars}</svg>`;
  }
  ROUTES_MAP.overview = { title: "Overview", sub: "Fleet snapshot for BT Express.", render: renderOverview };
})();
