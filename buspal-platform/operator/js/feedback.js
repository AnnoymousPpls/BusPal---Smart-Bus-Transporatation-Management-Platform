/* ============================================================
   BusPal — Operator Dashboard — Feedback & SOS
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderFeedback(root) {
    root.innerHTML = `<div class="empty"><div class="ico">✆</div>Loading…</div>`;
    const [feedback, sos] = await Promise.all([OpsAPI.getFeedback(), OpsAPI.getSOSAlerts()]);
    refreshSOSBadge();
    root.innerHTML = `
      <p class="muted small" style="margin-bottom:4px">Resolved feedback and SOS alerts older than 30 days are cleared out automatically — nothing open or unresolved ever gets removed on its own.</p>
      <div class="card card-pad">
        <h3 style="margin-bottom:12px">SOS alerts</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${sos.length ? sos.map(s => `
            <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><strong>${esc(s.passengerName)}</strong><span class="pill ${s.status === "resolved" ? "resolved" : "open"}">${s.status}</span></div>
                <div class="muted small">${esc(s.trip)} · ${esc(s.note)} · ${new Date(s.createdAt).toLocaleString()}</div>
              </div>
              <div style="display:flex;gap:8px">
                ${s.status !== "resolved" ? `<button class="btn sm brand" data-resolve-sos="${s.id}">Mark resolved</button>` : ""}
                <button class="icon-btn danger" title="Delete" data-del-sos="${s.id}">🗑</button>
              </div>
            </div>
          `).join("") : emptyHTML("No SOS alerts on record.")}
        </div>
      </div>

      <div class="card card-pad">
        <h3 style="margin-bottom:12px">Feedback &amp; complaints</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${feedback.length ? feedback.map(f => `
            <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <strong>${esc(f.passengerName)}</strong>
                  <span class="badge ${f.type === "complaint" ? "bad" : "ok"}">${f.type}</span>
                  <span class="pill ${f.status}">${f.status}</span>
                </div>
                <div class="muted small">${esc(f.trip)}</div>
                <div style="margin-top:6px">${esc(f.message)}</div>
              </div>
              <div style="display:flex;gap:8px">
                ${f.status !== "closed" ? `<button class="btn sm brand" data-resolve-fb="${f.id}">Mark resolved</button>` : ""}
                <button class="icon-btn danger" title="Delete" data-del-fb="${f.id}">🗑</button>
              </div>
            </div>
          `).join("") : emptyHTML("No feedback yet.")}
        </div>
      </div>
    `;
    $$("[data-resolve-sos]", root).forEach(b => b.addEventListener("click", async () => {
      await OpsAPI.resolveSOS(b.dataset.resolveSos);
      toast("SOS marked resolved.");
      go("feedback");
    }));
    $$("[data-del-sos]", root).forEach(b => b.addEventListener("click", () => {
      confirmAction("Delete this SOS record? This can't be undone.", async () => {
        await OpsAPI.deleteSOS(b.dataset.delSos);
        toast("SOS record deleted.");
        go("feedback");
      });
    }));
    $$("[data-resolve-fb]", root).forEach(b => b.addEventListener("click", async () => {
      await OpsAPI.resolveFeedback(b.dataset.resolveFb);
      toast("Feedback marked resolved.");
      go("feedback");
    }));
    $$("[data-del-fb]", root).forEach(b => b.addEventListener("click", () => {
      confirmAction("Delete this feedback record? This can't be undone.", async () => {
        await OpsAPI.deleteFeedback(b.dataset.delFb);
        toast("Feedback deleted.");
        go("feedback");
      });
    }));
  }
  ROUTES_MAP.feedback = { title: 'Feedback & SOS', sub: 'Respond to passenger feedback and emergency alerts.', render: renderFeedback };
})();
