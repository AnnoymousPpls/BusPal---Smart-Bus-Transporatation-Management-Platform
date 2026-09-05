/* ============================================================
   BusPal — Passenger Dashboard — Overview
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderOverview(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◈</div>Loading your overview…</div>`;
    const [bookings, profile, liveTrip] = await Promise.all([BusPalAPI.getBookings(), BusPalAPI.getProfile(), BusPalAPI.getLiveTrip()]);
    const upcoming = bookings.filter(b => b.status === "upcoming");
    const completed = bookings.filter(b => b.status === "completed");
    const next = upcoming[0];

    root.innerHTML = `
      <div class="bus-hero-wrap" id="busHeroWrap">
        <div class="bus-hero-media" id="busHeroMedia"></div>
        <div class="bus-hero-overlay"></div>
        <div class="bus-hero-caption">
          <span class="badge info">BT Express · Magnate</span>
          <h2>Colombo <span class="hc-arrow">⇄</span> Kandy <span class="hc-arrow">⇄</span> Jaffna</h2>
          <p class="muted small">Bus NC-9302 · AC Luxury · 340hp Cummins</p>
        </div>
        <div class="bus-hero-scroll-hint"><span>Scroll for your dashboard</span><span class="chev">⌄</span></div>
      </div>

      ${liveTrip ? `
        <div class="card card-pad kpi-clickable" data-go="tracking" style="border-color:rgba(74,168,255,.3)">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <span class="ticket-pulse" style="position:static"><span class="dot"></span> Live</span>
              <div>
                <div class="cell-strong">${esc(liveTrip.from)} → ${esc(liveTrip.to)}</div>
                <div class="muted small">Bus ${esc(liveTrip.busPlate || "TBA")} · ${liveTrip.stops.find(s => s.status === "current")?.name ? "Currently near " + esc(liveTrip.stops.find(s => s.status === "current").name) : ""}</div>
              </div>
            </div>
            <span class="badge info">ETA ${formatEta(liveTrip.etaMinutes)}</span>
          </div>
        </div>
      ` : ""}

      <div class="grid-2">
        <div class="card card-pad">
          <h3 style="margin-bottom:12px">Your next trip</h3>
          ${next ? boardingPassHTML(next, { compact: true }) : `
            <div class="empty">
              <div class="ico">▤</div>
              No upcoming trips yet.
              <div style="margin-top:12px"><button class="btn brand" id="goBook">Book a trip →</button></div>
            </div>`}
        </div>
        <div class="card card-pad" style="display:flex;flex-direction:column;gap:10px">
          <h3 style="margin-bottom:4px">Quick actions</h3>
          <button class="btn brand block" data-go="book">⌕ Search &amp; book a trip</button>
          <button class="btn block" data-go="tracking">◎ Track a live bus</button>
          <button class="btn block" data-go="support">✆ Send feedback</button>
          <button class="btn danger block" id="ovSOS">⚠ Emergency SOS</button>
        </div>
      </div>

      <div class="grid-4">
        <div class="stat-card chart-card">
          ${splitDonutSVG(upcoming.length, completed.length, "var(--brand)", "var(--brand-2)")}
          <div class="chart-card-text">
            <div class="k">${bookings.length}</div>
            <div class="l">
              <span class="chart-legend-dot" style="background:var(--brand)"></span>${upcoming.length} upcoming
              &nbsp;<span class="chart-legend-dot" style="background:var(--brand-2)"></span>${completed.length} done
            </div>
          </div>
        </div>
        <div class="stat-card"><div class="k">${upcoming.length}</div><div class="l">Upcoming trips</div></div>
        <div class="stat-card"><div class="k">${completed.length}</div><div class="l">Completed trips</div></div>
        <div class="stat-card"><div class="k">4.8★</div><div class="l">Your rated experience</div></div>
      </div>

      <div class="card card-pad">
        <h3 style="margin-bottom:12px">Recent bookings</h3>
        ${bookings.length ? bookings.slice(0, 3).map(bookingRowHTML).join("") : emptyHTML("No bookings yet.")}
      </div>
    `;

    $$("[data-go]", root).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
    root.querySelector("#goBook")?.addEventListener("click", () => go("book"));
    root.querySelector("#ovSOS")?.addEventListener("click", openSOSModal);
    bindBookingRowActions(root);
    setupBusHero(root);
  }

  // ---------- 3D scroll hero ----------
  function setupBusHero(root) {
    const media = root.querySelector("#busHeroMedia");
    if (!media) return;
    media.style.backgroundImage = `image-set(url("./assets/bus-hero.webp") type("image/webp"), url("./assets/bus-hero.jpg") type("image/jpeg"))`;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wrap = root.querySelector("#busHeroWrap");
    if (reduceMotion || !wrap) return;

    let ticking = false;
    function update() {
      ticking = false;
      const rect = wrap.getBoundingClientRect();
      const span = Math.max(rect.height * 0.85, 1);
      const progress = Math.min(Math.max(-rect.top / span, 0), 1);
      media.style.transform = `perspective(1400px) rotateX(${progress * -16}deg) scale(${1 - progress * 0.14}) translateY(${progress * -18}px)`;
      media.style.opacity = String(1 - progress * 0.85);
      wrap.style.setProperty("--hero-progress", progress.toFixed(3));
    }
    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    heroCleanup = () => window.removeEventListener("scroll", onScroll);
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

  ROUTES.overview = { title: "Overview", sub: "Welcome back — here's your travel snapshot.", render: renderOverview };
})();
