/* ============================================================
   BusPal — Passenger Dashboard — Profile
   Registers itself into the shared ROUTES map (see core.js).
   ============================================================ */

(() => {
  async function renderProfile(root) {
    root.innerHTML = `<div class="empty"><div class="ico">◐</div>Loading profile…</div>`;
    const [p, contacts] = await Promise.all([BusPalAPI.getProfile(), BusPalAPI.getEmergencyContacts()]);
    document.getElementById("avatarInitials").textContent = p.initials;
    root.innerHTML = `
      <div class="grid-2">
        <div class="card card-pad">
          <h3 style="margin-bottom:12px">Account details</h3>
          <form id="profileForm" class="form-grid">
            <div class="row-2">
              <div class="field-v"><label for="pName">Full name</label><input type="text" id="pName" value="${p.name}" /></div>
              <div class="field-v"><label for="pNic">NIC / Passport</label><input type="text" id="pNic" value="${p.nic}" /></div>
            </div>
            <div class="row-2">
              <div class="field-v"><label for="pEmail">Email</label><input type="email" id="pEmail" value="${p.email}" /></div>
              <div class="field-v"><label for="pPhone">Phone</label><input type="tel" id="pPhone" value="${p.phone}" /></div>
            </div>
            <button class="btn brand" type="submit" style="width:fit-content">Save changes</button>
          </form>
        </div>
        <div class="card card-pad">
          <h3 style="margin-bottom:12px">Change password</h3>
          <form id="pwForm" class="form-grid">
            <div class="field-v"><label for="pwCur">Current password</label><input type="password" id="pwCur" placeholder="••••••••" /></div>
            <div class="field-v">
              <label for="pwNew">New password</label>
              <input type="password" id="pwNew" placeholder="••••••••" />
              <div class="pw-strength-wrap" id="pwNewMeter" hidden>
                <div class="pw-strength-track"><div class="pw-strength-fill" id="pwNewFill"></div></div>
                <span class="pw-strength-label"></span>
              </div>
            </div>
            <button class="btn" type="submit" style="width:fit-content">Update password</button>
          </form>
          <hr style="border-color:rgba(255,255,255,.06);margin:18px 0" />
          <div class="muted small">Passenger ID <strong style="color:var(--text)">${p.id}</strong> · Member since ${p.joined}</div>
        </div>
      </div>

      <div class="card card-pad">
        <h3 style="margin-bottom:4px">Emergency contacts</h3>
        <p class="muted small" style="margin-bottom:12px">Shown as quick-dial buttons whenever you trigger SOS — so whoever's with you can reach someone you trust immediately.</p>
        <div id="contactsListWrap" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
        <form id="contactForm" class="row-3" style="align-items:flex-end">
          <div class="field-v"><label for="ecName">Name</label><input type="text" id="ecName" placeholder="e.g. Mum" required /></div>
          <div class="field-v"><label for="ecPhone">Phone</label><input type="tel" id="ecPhone" placeholder="07X XXX XXXX" required /></div>
          <button class="btn brand" type="submit">+ Add contact</button>
        </form>
      </div>
    `;
    drawContacts(root, contacts);
    Validate.attachPhoneMask($("#ecPhone", root));
    $("#contactForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#ecName", root).value.trim();
      const phone = $("#ecPhone", root).value.trim();
      if (!name) { toast("Enter a name."); return; }
      if (!Validate.isValidPhone(phone)) { toast("Enter a valid mobile number, e.g. 077 123 4567"); return; }
      await BusPalAPI.addEmergencyContact({ name, phone });
      e.target.reset();
      toast("Contact added.");
      go("profile");
    });
    Validate.attachPasswordMeter($("#pwNew", root), $("#pwNewMeter", root));

    Validate.attachPhoneMask($("#pPhone", root));
    $("#pPhone", root).addEventListener("blur", () => {
      const v = $("#pPhone", root).value.trim();
      Validate.setFieldError($("#pPhone", root), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number, e.g. 077 123 4567" : "");
    });
    $("#pNic", root).addEventListener("blur", () => {
      const v = $("#pNic", root).value.trim();
      Validate.setFieldError($("#pNic", root), v && !Validate.isValidNIC(v) ? "Enter a valid NIC (9 digits + V/X, or 12 digits)" : "");
    });

    $("#profileForm", root).addEventListener("submit", async (e) => {
      e.preventDefault();
      const phone = $("#pPhone", root).value.trim();
      const nic = $("#pNic", root).value.trim();
      const email = $("#pEmail", root).value.trim();
      let hasError = false;
      if (!Validate.isValidPhone(phone)) { Validate.setFieldError($("#pPhone", root), "Enter a valid mobile number, e.g. 077 123 4567"); hasError = true; }
      if (nic && !Validate.isValidNIC(nic)) { Validate.setFieldError($("#pNic", root), "Enter a valid NIC (9 digits + V/X, or 12 digits)"); hasError = true; }
      if (!Validate.isValidEmail(email)) { toast("Enter a valid email address."); hasError = true; }
      if (hasError) return;
      Validate.setFieldError($("#pPhone", root), "");
      Validate.setFieldError($("#pNic", root), "");
      await BusPalAPI.updateProfile({
        name: $("#pName", root).value.trim(), nic, email, phone,
      });
      toast("Profile updated.");
    });
    $("#pwForm", root).addEventListener("submit", (e) => {
      e.preventDefault();
      const cur = $("#pwCur", root).value;
      const next = $("#pwNew", root).value;
      if (!cur || !next) { toast("Fill in both password fields."); return; }
      if (Validate.passwordStrength(next).level === "weak") { toast("New password is too weak — add a number, a symbol, or make it longer."); return; }
      toast("Password updated (demo only).");
      e.target.reset();
      $("#pwNewMeter", root).hidden = true;
    });
  }

  function drawContacts(root, contacts) {
    $("#contactsListWrap", root).innerHTML = contacts.length ? contacts.map(c => `
      <div class="dep-row" style="grid-template-columns:1fr auto auto">
        <div class="cell-strong">${esc(c.name)}</div>
        <a class="btn sm" href="tel:${esc(c.phone)}">📞 ${esc(c.phone)}</a>
        <button class="icon-btn danger" title="Remove" data-del-contact="${c.id}">🗑</button>
      </div>
    `).join("") : emptyHTML("No emergency contacts added yet.");
    $$("[data-del-contact]", root).forEach(b => b.addEventListener("click", () => {
      confirmAction("Remove this emergency contact?", async () => {
        await BusPalAPI.removeEmergencyContact(b.dataset.delContact);
        toast("Contact removed.");
        go("profile");
      });
    }));
  }

  ROUTES.profile = { title: "Profile", sub: "Manage your account details.", render: renderProfile };
})();
