(() => {
  const $ = (sel) => document.querySelector(sel);

  // If already logged in, skip straight to the right dashboard.
  const existing = AuthStore.getSession();
  if (existing) window.location.href = AuthStore.routeForRole(existing.role);

  // ---- tabs ----
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".auth-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      $(`#panel-${tab.dataset.tab}`).classList.add("active");
    });
  });

  // ---- forgot password ----
  function showPanel(id) {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".auth-panel").forEach(p => p.classList.remove("active"));
    $(`#panel-${id}`).classList.add("active");
  }
  $("#forgotLink").addEventListener("click", () => showPanel("forgot"));
  $("#backToLogin").addEventListener("click", () => showPanel("login"));

  $("#forgotForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#fpEmail").value.trim();
    const result = AuthStore.requestPasswordReset(email);
    const resultBox = $("#forgotResult");
    if (result.error) {
      $("#forgotError").textContent = result.error;
      resultBox.hidden = true;
      return;
    }
    $("#forgotError").textContent = "";
    resultBox.hidden = false;
    resultBox.innerHTML = `<strong>Temporary password issued</strong>
      <p class="small" style="margin:4px 0 0">In production this would be emailed to you. For this demo:</p>
      <div class="auth-demo-row"><span>New password</span><code>${result.tempPassword}</code></div>`;
    e.target.reset();
  });

  // ---- theme toggle ----
  $("#themeToggle").addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("buspal-theme", next);
  });

  // ---- login ----
  $("#loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#liEmail").value.trim();
    const password = $("#liPass").value;
    const result = AuthStore.login(email, password);
    if (result.error) { $("#loginError").textContent = result.error; return; }
    $("#loginError").textContent = "";
    window.location.href = AuthStore.routeForRole(result.account.role);
  });

  // ---- register (passenger only) ----
  Validate.attachPasswordMeter($("#rPass"), $("#rPassMeter"));

  Validate.attachPhoneMask($("#rPhone"));
  $("#rPhone").addEventListener("blur", () => {
    const v = $("#rPhone").value.trim();
    Validate.setFieldError($("#rPhone"), v && !Validate.isValidPhone(v) ? "Enter a valid mobile number, e.g. 077 123 4567" : "");
  });

  $("#registerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#rName").value.trim();
    const phone = $("#rPhone").value.trim();
    const email = $("#rEmail").value.trim();
    const pass = $("#rPass").value;
    const pass2 = $("#rPass2").value;

    if (!Validate.isValidPhone(phone)) {
      Validate.setFieldError($("#rPhone"), "Enter a valid mobile number, e.g. 077 123 4567");
      $("#registerError").textContent = "Please fix the highlighted field.";
      return;
    }
    Validate.setFieldError($("#rPhone"), "");
    if (!Validate.isValidEmail(email)) { $("#registerError").textContent = "Enter a valid email address."; return; }
    if (pass !== pass2) { $("#registerError").textContent = "Passwords don't match."; return; }
    if (pass.length < 6) { $("#registerError").textContent = "Password should be at least 6 characters."; return; }
    if (Validate.passwordStrength(pass).level === "weak") { $("#registerError").textContent = "That password is too weak — add a number, a symbol, or make it longer."; return; }

    const result = AuthStore.registerPassenger({ name, email, phone, password: pass });
    if (result.error) { $("#registerError").textContent = result.error; return; }
    $("#registerError").textContent = "";
    window.location.href = AuthStore.routeForRole("passenger");
  });

  // ---- operator staff access request (pending Owner approval) ----
  $("#showStaffRequestBtn").addEventListener("click", () => {
    const form = $("#staffRequestForm");
    form.hidden = !form.hidden;
    $("#showStaffRequestBtn").textContent = form.hidden ? "Request operator staff access →" : "Hide request form";
  });

  Validate.attachPhoneMask($("#srPhone"));
  $("#staffRequestForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#srName").value.trim();
    const phone = $("#srPhone").value.trim();
    const email = $("#srEmail").value.trim();
    const pass = $("#srPass").value;

    if (!Validate.isValidPhone(phone)) { $("#staffRequestError").textContent = "Enter a valid mobile number, e.g. 077 123 4567"; return; }
    if (!Validate.isValidEmail(email)) { $("#staffRequestError").textContent = "Enter a valid email address."; return; }
    if (pass.length < 6) { $("#staffRequestError").textContent = "Password should be at least 6 characters."; return; }

    const result = AuthStore.requestOperatorAccess({ name, email, phone, password: pass });
    if (result.error) { $("#staffRequestError").textContent = result.error; return; }
    $("#staffRequestError").textContent = "";
    $("#staffRequestForm").hidden = true;
    $("#showStaffRequestBtn").hidden = true;
    const resultBox = $("#staffRequestResult");
    resultBox.hidden = false;
    resultBox.innerHTML = `<strong>Request sent</strong><p class="small" style="margin:4px 0 0">An Owner needs to approve your request from the Team page before you can log in. You'll use the password you just chose.</p>`;
  });
})();
