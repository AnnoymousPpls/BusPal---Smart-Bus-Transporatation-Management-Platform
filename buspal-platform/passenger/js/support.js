/* ============================================================
   BusPal — Passenger Dashboard — Feedback & SOS
   openSOSModal() lives in core.js since Overview, Live Tracking, and
   boot.js's floating SOS button all need to call it too.
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderSupport(root) {
    root.innerHTML = `<div class="empty"><div class="ico">✆</div>Loading…</div>`;
    const [myFeedback, mySOS] = await Promise.all([BusPalAPI.getMyFeedback(), BusPalAPI.getMySOSAlerts()]);

    root.innerHTML = `
      <div class="grid-2">
        <div class="card card-pad">
          <h3 style="margin-bottom:12px">Feedback &amp; complaints</h3>
          <form id="feedbackForm" class="form-grid">
            <div class="field-v">
              <label for="fbType">Type</label>
              <select id="fbType">
                <option value="feedback">General feedback</option>
                <option value="complaint">Complaint</option>
              </select>
            </div>
            <div class="field-v">
              <label for="fbTrip">Related trip (optional)</label>
              <input type="text" id="fbTrip" placeholder="e.g. BK-88231 or Colombo → Kandy" />
            </div>
            <div class="field-v">
              <label for="fbMsg">Message</label>
              <textarea id="fbMsg" rows="4" placeholder="Tell us what happened…"></textarea>
              <div class="error" id="fbErr" style="color:var(--danger);font-size:13px"></div>
            </div>
            <button class="btn brand" type="submit">Submit</button>
          </form>
        </div>
        <div class="card card-pad" style="display:flex;flex-direction:column;gap:12px">
          <h3>Need help right now?</h3>
          <p class="muted small">Use SOS only for genuine emergencies during a trip. It alerts the operator and shares your live location.</p>
          <button class="btn danger block" id="supportSOS">⚠ Emergency SOS</button>
          <div class="stat-card" style="margin-top:6px">
            <div class="l">Support hotline</div>
            <div class="k" style="font-size:17px">+94 75 700 0085</div>
          </div>
          <div class="stat-card">
            <div class="l">Email</div>
            <div class="k" style="font-size:15px">support.buspal@lk</div>
          </div>
        </div>
      </div>

      <div class="card card-pad">
        <h3 style="margin-bottom:12px">Your feedback &amp; complaints</h3>
        <div id="myFeedbackWrap" style="display:flex;flex-direction:column;gap:10px"></div>
      </div>

      <div class="card card-pad">
        <h3 style="margin-bottom:12px">Your SOS history</h3>
        <div id="mySosWrap" style="display:flex;flex-direction:column;gap:10px"></div>
      </div>
    `;

    drawMyFeedback(root, myFeedback);
    drawMySOS(root, mySOS);

    $("#supportSOS", root).addEventListener("click", openSOSModal);
    $("#feedbackForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#fbMsg", root).value.trim();
      if (!msg) { $("#fbErr", root).textContent = "Please enter a message before submitting."; return; }
      $("#fbErr", root).textContent = "";
      await BusPalAPI.submitFeedback({
        type: $("#fbType", root).value,
        trip: $("#fbTrip", root).value.trim(),
        message: msg,
      });
      e.target.reset();
      toast("Thanks — your message was sent to BT Express.");
      go("support");
    });
  }

  function drawMyFeedback(root, items) {
    $("#myFeedbackWrap", root).innerHTML = items.length ? items.map(f => `
      <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="badge ${f.type === "complaint" ? "bad" : "ok"}">${esc(f.type)}</span>
            <span class="pill ${f.status === "open" ? "open" : "resolved"}">${f.status === "open" ? "awaiting response" : "resolved"}</span>
            ${f.trip ? `<span class="muted small">${esc(f.trip)}</span>` : ""}
          </div>
          <div>${esc(f.message)}</div>
        </div>
        ${f.status === "open" ? `
          <div style="display:flex;gap:6px">
            <button class="icon-btn" title="Edit" data-edit-fb="${f.id}">✎</button>
            <button class="icon-btn danger" title="Withdraw" data-del-fb="${f.id}">🗑</button>
          </div>
        ` : ""}
      </div>
    `).join("") : emptyHTML("You haven't sent any feedback yet.");

    $$("[data-edit-fb]", root).forEach(b => b.addEventListener("click", () => {
      const entry = items.find(f => f.id === b.dataset.editFb);
      openEditFeedbackForm(entry);
    }));
    $$("[data-del-fb]", root).forEach(b => b.addEventListener("click", () => {
      confirmAction("Withdraw this feedback? This can't be undone.", async () => {
        await BusPalAPI.deleteMyFeedback(b.dataset.delFb);
        toast("Withdrawn.");
        go("support");
      });
    }));
  }

  function openEditFeedbackForm(entry) {
    const body = openForm("Edit feedback", `
      <form id="editFbForm" class="form-grid">
        <div class="field-v">
          <label for="efMsg">Message</label>
          <textarea id="efMsg" rows="4">${esc(entry.message)}</textarea>
        </div>
        <button class="btn brand" type="submit">Save changes</button>
      </form>
    `);
    $("#editFbForm", body).addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = $("#efMsg", body).value.trim();
      if (!msg) { toast("Message can't be empty."); return; }
      await BusPalAPI.updateMyFeedback(entry.id, { message: msg });
      closeModal("formModal");
      toast("Feedback updated.");
      go("support");
    });
  }

  function drawMySOS(root, items) {
    $("#mySosWrap", root).innerHTML = items.length ? items.map(s => `
      <div class="card card-pad" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="pill ${s.status === "resolved" ? "resolved" : "open"}">${s.status === "resolved" ? "resolved" : "active"}</span>
            <span class="muted small">${new Date(s.createdAt).toLocaleString()}</span>
          </div>
          <div class="muted small">${esc(s.trip || "No trip reference")} · ${esc(s.note || "")}</div>
        </div>
      </div>
    `).join("") : emptyHTML("No SOS alerts sent — hopefully it stays that way.");
  }

  ROUTES.support = { title: "Feedback & SOS", sub: "Tell us how we're doing, or get help fast.", render: renderSupport };
})();
