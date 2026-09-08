/* ============================================================
   BusPal — Operator Dashboard — Settings
   Registers itself into the shared ROUTES_MAP (see core.js).
   ============================================================ */

(() => {
  async function renderProfile(root) {
    const op = await OpsAPI.getOperator();
    const session = window.__session;
    const isOwner = session?.role === "owner";

    root.innerHTML = `
      <div class="card card-pad">
        <h3 style="margin-bottom:4px">Your account</h3>
        <p class="muted small" style="margin-bottom:14px">Signed in as <strong style="color:var(--text)">${esc(session?.name || "")}</strong> · <span class="pill ${isOwner ? "active" : "info"}">${esc(session?.role || "")}</span></p>
        ${isOwner ? `
          <form id="opForm" class="form-grid">
            <div class="row-2">
              <div class="field-v"><label for="opCompany">Company</label><input type="text" id="opCompany" value="${esc(op.company)}" /></div>
              <div class="field-v"><label for="opName">Contact name</label><input type="text" id="opName" value="${esc(op.name)}" /></div>
            </div>
            <div class="row-2">
              <div class="field-v"><label for="opEmail">Company email</label><input type="email" id="opEmail" value="${esc(op.email)}" /></div>
              <div class="field-v"><label for="opPhone">Company phone</label><input type="tel" id="opPhone" value="${esc(op.phone)}" /></div>
            </div>
            <button class="btn brand" type="submit" style="width:fit-content">Save changes</button>
          </form>
        ` : `
          <div class="row-2">
            <div class="field-v"><label>Name</label><input type="text" value="${esc(session?.name || "")}" disabled /></div>
            <div class="field-v"><label>Email</label><input type="email" value="${esc(session?.email || "")}" disabled /></div>
          </div>
          <p class="muted small" style="margin-top:10px">Company settings and the admin team are managed by the account owner.</p>
        `}
      </div>

      ${isOwner ? `
      <div id="pendingRequestsWrap"></div>
      <div class="card card-pad">
        <div class="section-toolbar" style="margin-bottom:12px">
          <div>
            <h3>Team &amp; admin access</h3>
            <p class="muted small" style="margin-top:2px">Everyone here can sign in to this operator dashboard.</p>
          </div>
          <button class="btn brand" id="addAdminBtn">+ Add admin</button>
        </div>
        <div id="teamTableWrap"></div>
      </div>
      ` : ""}
    `;

    if (isOwner) {
      Validate.attachPhoneMask($("#opPhone", root));
      $("#opPhone", root).addEventListener("blur", () => {
        const v = $("#opPhone", root).value.trim();
        Validate.setFieldError($("#opPhone", root), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number, e.g. 077 010 1107" : "");
      });
      $("#opForm", root).addEventListener("submit", (e) => {
        e.preventDefault();
        const phone = $("#opPhone", root).value.trim();
        if (phone && !Validate.isValidPhone(phone)) {
          Validate.setFieldError($("#opPhone", root), "Enter a valid mobile number, e.g. 077 010 1107");
          toast("Please fix the highlighted field.");
          return;
        }
        toast("Operator details updated.");
      });
      drawTeamTable(root, session);
      $("#addAdminBtn", root).addEventListener("click", () => openAdminForm(root, session));
    }
  }

  function drawTeamTable(root, session) {
    const team = AuthStore.getTeam();
    const pending = AuthStore.getPendingRequests();

    $("#pendingRequestsWrap", root).innerHTML = pending.length ? `
      <div class="card card-pad" style="margin-bottom:16px;border-color:rgba(255,180,84,.35)">
        <h3 style="margin-bottom:10px">Pending access requests</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${pending.map(p => `
            <div class="dep-row" style="grid-template-columns:1fr auto auto">
              <div>
                <div class="cell-strong">${esc(p.name)}</div>
                <div class="cell-sub">${esc(p.email)} · ${esc(p.phone || "—")}</div>
              </div>
              <button class="btn sm brand" data-approve-req="${p.id}">Approve as Manager</button>
              <button class="btn sm danger" data-reject-req="${p.id}">Reject</button>
            </div>
          `).join("")}
        </div>
      </div>
    ` : "";
    $$("[data-approve-req]", root).forEach(b => b.addEventListener("click", () => {
      const p = pending.find(x => x.id === b.dataset.approveReq);
      confirmAction(`Approve <strong>${esc(p.name)}</strong> as a Manager? They'll be able to log in immediately with the password they chose.`, async () => {
        AuthStore.approveRequest(p.id, "manager");
        toast("Approved — they can now log in.");
        drawTeamTable(root, session);
      });
    }));
    $$("[data-reject-req]", root).forEach(b => b.addEventListener("click", () => {
      const p = pending.find(x => x.id === b.dataset.rejectReq);
      confirmAction(`Reject the access request from <strong>${esc(p.name)}</strong>? This deletes their request.`, async () => {
        AuthStore.rejectRequest(p.id);
        toast("Request rejected.");
        drawTeamTable(root, session);
      });
    }));

    $("#teamTableWrap", root).innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th></th></tr></thead>
          <tbody>
            ${team.map(a => `
              <tr>
                <td class="cell-strong">${esc(a.name)}${a.id === session.id ? ' <span class="muted small">(you)</span>' : ""}</td>
                <td class="cell-mono">${esc(a.email)}</td>
                <td class="cell-mono">${esc(a.phone || "—")}</td>
                <td><span class="pill ${a.role === "owner" ? "active" : "info"}">${a.role}</span></td>
                <td class="td-actions">
                  <button class="icon-btn" title="Reset password" data-reset-pw="${a.id}">🔑</button>
                  <button class="icon-btn" title="Edit" data-edit-admin="${a.id}">✎</button>
                  <button class="icon-btn danger" title="Remove" data-del-admin="${a.id}">🗑</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    $$("[data-reset-pw]", root).forEach(b => b.addEventListener("click", () => {
      const a = team.find(x => x.id === b.dataset.resetPw);
      confirmAction(`Reset the password for <strong>${esc(a.name)}</strong>? Their current password will stop working immediately.`, async () => {
        const result = AuthStore.resetTeamMemberPassword(a.id);
        toast(`Password reset. New temp password: ${result.tempPassword}`, 6000);
      });
    }));
    $$("[data-edit-admin]", root).forEach(b => b.addEventListener("click", () => openAdminForm(root, session, team.find(a => a.id === b.dataset.editAdmin))));
    $$("[data-del-admin]", root).forEach(b => b.addEventListener("click", () => {
      const a = team.find(x => x.id === b.dataset.delAdmin);
      confirmAction(`Remove <strong>${esc(a.name)}</strong> from the admin team? They'll immediately lose access.`, async () => {
        const result = AuthStore.removeTeamMember(a.id);
        if (result.error) { toast(result.error); return; }
        toast("Admin removed.");
        drawTeamTable(root, session);
      });
    }));
  }

  function openAdminForm(root, session, admin) {
    const isEdit = !!admin;
    const body = openForm(isEdit ? "Edit admin" : "Add admin", `
      <form id="adminForm" class="form-grid">
        <div class="row-2">
          <div class="field-v"><label for="afName">Full name</label><input type="text" id="afName" value="${esc(admin?.name || "")}" required /></div>
          <div class="field-v"><label for="afRole">Access level</label>
            <select id="afRole">
              <option value="manager" ${admin?.role === "manager" || !admin ? "selected" : ""}>Manager — operational access</option>
              <option value="owner" ${admin?.role === "owner" ? "selected" : ""}>Owner — full access incl. team</option>
            </select>
          </div>
        </div>
        <div class="row-2">
          <div class="field-v"><label for="afEmail">Email</label><input type="email" id="afEmail" value="${esc(admin?.email || "")}" ${isEdit ? "disabled" : "required"} /></div>
          <div class="field-v"><label for="afPhone">Phone</label><input type="tel" id="afPhone" value="${esc(admin?.phone || "")}" placeholder="07X XXX XXXX" /></div>
        </div>
        ${!isEdit ? `<div class="field-v">
          <label for="afPass">Temporary password</label>
          <input type="text" id="afPass" placeholder="Leave blank to auto-generate" />
          <div class="pw-strength-wrap" id="afPassMeter" hidden>
            <div class="pw-strength-track"><div class="pw-strength-fill" id="afPassFill"></div></div>
            <span class="pw-strength-label"></span>
          </div>
        </div>` : ""}
        <button class="btn brand" type="submit">${isEdit ? "Save changes" : "Add admin"}</button>
      </form>
    `);
    if (!isEdit) Validate.attachPasswordMeter($("#afPass", body), $("#afPassMeter", body));
    Validate.attachPhoneMask($("#afPhone", body));
    $("#afPhone", body).addEventListener("blur", () => {
      const v = $("#afPhone", body).value.trim();
      Validate.setFieldError($("#afPhone", body), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number, e.g. 077 123 4567" : "");
    });
    $("#adminForm", body).addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#afName", body).value.trim();
      const role = $("#afRole", body).value;
      const phone = $("#afPhone", body).value.trim();
      if (phone && !Validate.isValidPhone(phone)) {
        Validate.setFieldError($("#afPhone", body), "Enter a valid mobile number, e.g. 077 123 4567");
        toast("Please fix the highlighted field.");
        return;
      }
      if (isEdit) {
        AuthStore.updateTeamMember(admin.id, { name, role, phone });
        toast("Admin updated.");
      } else {
        const email = $("#afEmail", body).value.trim();
        const pass = $("#afPass", body).value.trim();
        if (pass && Validate.passwordStrength(pass).level === "weak") {
          toast("That temporary password is too weak — add a number, a symbol, or make it longer.");
          return;
        }
        const result = AuthStore.addTeamMember({ name, email, phone, role, password: pass || undefined });
        if (result.error) { toast(result.error); return; }
        toast(`Admin added. Temp password: ${result.account.password}`, 5000);
      }
      closeModal("formModal");
      drawTeamTable(root, session);
    });
  }
  ROUTES_MAP.profile = { title: 'Settings', sub: 'Operator account details.', render: renderProfile };
})();
