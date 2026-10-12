(() => {

  const $ = (sel) => document.querySelector(sel);


  /* ============================================================
     API CONFIG
     ============================================================ */

  const API_BASE =
    "http://localhost/buspal-backend-php/api";


  /* ============================================================
     REAL PHP REQUEST HELPER
     ============================================================ */

  async function apiRequest(
    endpoint,
    options = {}
  ) {

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };


    /*
     * The staff-request endpoint does not require
     * authentication, but including the token when available
     * is harmless and keeps this helper consistent.
     */

    try {

      if (
        typeof AuthStore !== "undefined" &&
        typeof AuthStore.getToken === "function"
      ) {

        const token =
          AuthStore.getToken();

        if (token) {
          headers.Authorization =
            `Bearer ${token}`;
        }
      }

    } catch (error) {

      console.warn(
        "Could not read authentication token:",
        error
      );

    }


    let response;


    try {

      response =
        await fetch(
          `${API_BASE}${endpoint}`,
          {
            ...options,
            headers
          }
        );

    } catch (error) {

      console.error(
        "BusPal API connection error:",
        error
      );

      throw new Error(
        "Unable to connect to the BusPal server. Make sure WAMP and Apache are running."
      );

    }


    let body;


    try {

      body =
        await response.json();

    } catch (error) {

      console.error(
        "Invalid server response:",
        error
      );

      throw new Error(
        `Server returned an invalid response (HTTP ${response.status}).`
      );

    }


    if (
      !response.ok ||
      body?.success === false
    ) {

      throw new Error(
        body?.message ||
        body?.error ||
        `Request failed with status ${response.status}.`
      );

    }


    return (
      body?.data ??
      body
    );

  }


  /* ============================================================
     ALREADY LOGGED IN
     ============================================================ */

  try {

    const existing =
      AuthStore.getSession();

    if (existing) {

      window.location.href =
        AuthStore.routeForRole(
          existing.role
        );

      return;

    }

  } catch (error) {

    console.warn(
      "Could not check existing session:",
      error
    );

  }


  /* ============================================================
     TABS
     ============================================================ */

  document
    .querySelectorAll(".auth-tab")
    .forEach(tab => {

      tab.addEventListener(
        "click",
        () => {

          document
            .querySelectorAll(".auth-tab")
            .forEach(t =>
              t.classList.remove("active")
            );


          document
            .querySelectorAll(".auth-panel")
            .forEach(panel =>
              panel.classList.remove("active")
            );


          tab.classList.add("active");


          const panel =
            $(
              `#panel-${tab.dataset.tab}`
            );


          if (panel) {
            panel.classList.add(
              "active"
            );
          }

        }
      );

    });
 /* ============================================================
   FORGOT PASSWORD
   ============================================================ */

const forgotLink = $("#forgotLink");
const backToLogin = $("#backToLogin");

const loginPanel = $("#panel-login");
const forgotPanel = $("#panel-forgot");

const forgotForm = $("#forgotForm");


// ============================================================
// OPEN FORGOT PASSWORD PANEL
// ============================================================

if (forgotLink) {
  forgotLink.addEventListener("click", () => {

    if (loginPanel) {
      loginPanel.classList.remove("active");
    }

    if (forgotPanel) {
      forgotPanel.classList.add("active");
    }

    // Copy the login email automatically
    const loginEmail = $("#liEmail");
    const forgotEmail = $("#fpEmail");

    if (
      loginEmail &&
      forgotEmail &&
      loginEmail.value.trim()
    ) {
      forgotEmail.value =
        loginEmail.value.trim();
    }

    // Clear previous messages
    const errorBox = $("#forgotError");
    const resultBox = $("#forgotResult");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if (resultBox) {
      resultBox.hidden = true;
      resultBox.innerHTML = "";
    }

  });
}


// ============================================================
// BACK TO LOGIN
// ============================================================

if (backToLogin) {
  backToLogin.addEventListener("click", () => {

    if (forgotPanel) {
      forgotPanel.classList.remove("active");
    }

    if (loginPanel) {
      loginPanel.classList.add("active");
    }

    // Clear messages
    const errorBox = $("#forgotError");
    const resultBox = $("#forgotResult");

    if (errorBox) {
      errorBox.textContent = "";
    }

    if (resultBox) {
      resultBox.hidden = true;
      resultBox.innerHTML = "";
    }

  });
}


// ============================================================
// SUBMIT PASSWORD RESET
// ============================================================

if (forgotForm) {

  forgotForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const emailInput = $("#fpEmail");
      const errorBox = $("#forgotError");
      const resultBox = $("#forgotResult");

      const email =
        emailInput
          ? emailInput.value.trim()
          : "";

      // Clear previous messages
      if (errorBox) {
        errorBox.textContent = "";
      }

      if (resultBox) {
        resultBox.hidden = true;
        resultBox.innerHTML = "";
      }


      // --------------------------------------------------------
      // Validate email
      // --------------------------------------------------------

      if (!email) {

        if (errorBox) {
          errorBox.textContent =
            "Please enter your email address.";
        }

        return;
      }


      if (
        typeof Validate !== "undefined" &&
        typeof Validate.isValidEmail === "function" &&
        !Validate.isValidEmail(email)
      ) {

        if (errorBox) {
          errorBox.textContent =
            "Enter a valid email address.";
        }

        return;
      }


      // --------------------------------------------------------
      // Disable button
      // --------------------------------------------------------

      const submitButton =
        forgotForm.querySelector(
          'button[type="submit"]'
        );

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending…";
      }


      // --------------------------------------------------------
      // Call PHP backend
      // --------------------------------------------------------

      try {

        const result =
          await AuthStore.requestPasswordReset(
            email
          );


        console.log(
          "Password reset response:",
          result
        );


        // ------------------------------------------------------
        // Backend returned an error
        // ------------------------------------------------------

        if (result && result.error) {

          if (errorBox) {
            errorBox.textContent =
              result.error;
          }

          return;
        }


        // ------------------------------------------------------
        // Success
        // ------------------------------------------------------

        if (resultBox) {

          resultBox.hidden = false;

          resultBox.innerHTML = `

            <strong>
              Password reset successful
            </strong>

            <p
              class="small"
              style="margin:6px 0 10px"
            >
              Your temporary password is:
            </p>

            <div
              class="auth-demo-row"
              style="margin-top:8px"
            >

              <span>
                New password
              </span>

              <code>
                ${result.tempPassword || "Not returned"}
              </code>

            </div>

            <p
              class="small muted"
              style="margin-top:10px"
            >
              Use this temporary password to
              log in to your BusPal account.
            </p>

          `;

        }


        // Clear email field
        forgotForm.reset();


      } catch (error) {

        console.error(
          "Password reset error:",
          error
        );


        if (errorBox) {

          errorBox.textContent =
            error.message ||
            "Unable to connect to the server.";

        }

      } finally {

        // Re-enable button
        if (submitButton) {

          submitButton.disabled = false;

          submitButton.textContent =
            "Send reset";

        }

      }

    }
  );

}


  /* ============================================================
     THEME
     ============================================================ */

  const themeToggle =
    $("#themeToggle");


  if (themeToggle) {

    themeToggle.addEventListener(
      "click",
      () => {

        const current =
          document.documentElement
            .getAttribute(
              "data-theme"
            ) === "light"
              ? "light"
              : "dark";


        const next =
          current === "light"
            ? "dark"
            : "light";


        document.documentElement
          .setAttribute(
            "data-theme",
            next
          );


        localStorage.setItem(
          "buspal-theme",
          next
        );

      }
    );

  }


  /* ============================================================
     LOGIN
     ============================================================ */

  const loginForm =
    $("#loginForm");


  if (loginForm) {

    loginForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const email =
          $("#liEmail")
            .value
            .trim();


        const password =
          $("#liPass")
            .value;


        $("#loginError")
          .textContent = "";


        try {

          const result =
            await AuthStore.login(
              email,
              password
            );


          if (result.error) {

            $("#loginError")
              .textContent =
              result.error;

            return;

          }


          window.location.href =
            AuthStore.routeForRole(
              result.account.role
            );


        } catch (error) {

          console.error(
            "Login error:",
            error
          );


          $("#loginError")
            .textContent =
            error.message ||
            "Unable to connect to the server.";

        }

      }
    );

  }


  /* ============================================================
     PASSENGER REGISTRATION
     ============================================================ */

  const registerForm =
    $("#registerForm");


  if (registerForm) {

    registerForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const name =
          $("#rName")
            .value
            .trim();


        const phone =
          $("#rPhone")
            .value
            .trim();


        const email =
          $("#rEmail")
            .value
            .trim();


        const pass =
          $("#rPass")
            .value;


        const pass2 =
          $("#rPass2")
            .value;


        $("#registerError")
          .textContent = "";


        if (
          !Validate.isValidPhone(
            phone
          )
        ) {

          Validate.setFieldError(
            $("#rPhone"),
            "Enter a valid mobile number, e.g. 077 123 4567"
          );


          $("#registerError")
            .textContent =
            "Please fix the highlighted field.";


          return;

        }


        Validate.setFieldError(
          $("#rPhone"),
          ""
        );


        if (
          !Validate.isValidEmail(
            email
          )
        ) {

          $("#registerError")
            .textContent =
            "Enter a valid email address.";

          return;

        }


        if (
          pass !== pass2
        ) {

          $("#registerError")
            .textContent =
            "Passwords don't match.";

          return;

        }


        if (
          pass.length < 6
        ) {

          $("#registerError")
            .textContent =
            "Password should be at least 6 characters.";

          return;

        }


        if (
          Validate.passwordStrength(
            pass
          ).level === "weak"
        ) {

          $("#registerError")
            .textContent =
            "That password is too weak — add a number, a symbol, or make it longer.";

          return;

        }


        try {

          const result =
            await AuthStore.registerPassenger({
              name,
              email,
              phone,
              password: pass
            });


          if (result.error) {

            $("#registerError")
              .textContent =
              result.error;

            return;

          }


          window.location.href =
            AuthStore.routeForRole(
              result.account.role
            );


        } catch (error) {

          console.error(
            "Registration error:",
            error
          );


          $("#registerError")
            .textContent =
            error.message ||
            "Unable to connect to the server.";

        }

      }
    );

  }


  /* ============================================================
     STAFF ACCESS REQUEST FORM
     ============================================================ */

  const showStaffRequestBtn =
    $("#showStaffRequestBtn");


  const staffRequestForm =
    $("#staffRequestForm");


  if (
    showStaffRequestBtn &&
    staffRequestForm
  ) {

    showStaffRequestBtn
      .addEventListener(
        "click",
        () => {

          staffRequestForm.hidden =
            !staffRequestForm.hidden;


          showStaffRequestBtn
            .textContent =
            staffRequestForm.hidden
              ? "Request operator staff access →"
              : "Hide request form";

        }
      );

  }


  /* ------------------------------------------------------------
     Phone mask
     ------------------------------------------------------------ */

  const staffPhone =
    $("#srPhone");


  if (staffPhone) {

    Validate.attachPhoneMask(
      staffPhone
    );


    staffPhone.addEventListener(
      "blur",
      () => {

        const value =
          staffPhone
            .value
            .trim();


        Validate.setFieldError(
          staffPhone,

          value &&
          !Validate.isValidPhone(
            value
          )

            ? "Enter a valid mobile number, e.g. 077 123 4567"

            : ""
        );

      }
    );

  }


  /* ------------------------------------------------------------
     STAFF REQUEST SUBMIT
     ------------------------------------------------------------ */

  if (staffRequestForm) {

    staffRequestForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();


        const name =
          $("#srName")
            .value
            .trim();


        const phone =
          $("#srPhone")
            .value
            .trim();


        const email =
          $("#srEmail")
            .value
            .trim();


        const password =
          $("#srPass")
            .value;


        const errorBox =
          $("#staffRequestError");


        const resultBox =
          $("#staffRequestResult");


        errorBox.textContent =
          "";


        resultBox.hidden =
          true;


        /* ------------------------------------------------------
           Validate name
           ------------------------------------------------------ */

        if (!name) {

          errorBox.textContent =
            "Full name is required.";

          return;

        }


        /* ------------------------------------------------------
           Validate phone
           ------------------------------------------------------ */

        if (
          !Validate.isValidPhone(
            phone
          )
        ) {

          Validate.setFieldError(
            $("#srPhone"),
            "Enter a valid mobile number, e.g. 077 123 4567"
          );


          errorBox.textContent =
            "Please fix the highlighted field.";

          return;

        }


        Validate.setFieldError(
          $("#srPhone"),
          ""
        );


        /* ------------------------------------------------------
           Validate email
           ------------------------------------------------------ */

        if (
          !Validate.isValidEmail(
            email
          )
        ) {

          errorBox.textContent =
            "Enter a valid email address.";

          return;

        }


        /* ------------------------------------------------------
           Validate password
           ------------------------------------------------------ */

        if (
          password.length < 6
        ) {

          errorBox.textContent =
            "Password should be at least 6 characters.";

          return;

        }


        if (
          Validate.passwordStrength(
            password
          ).level === "weak"
        ) {

          errorBox.textContent =
            "That password is too weak — add a number, a symbol, or make it longer.";

          return;

        }


        /* ------------------------------------------------------
           Disable button while submitting
           ------------------------------------------------------ */

        const submitButton =
          staffRequestForm.querySelector(
            'button[type="submit"]'
          );


        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            "Sending…";

        }


        try {

          /* ====================================================
             REAL PHP STAFF REQUEST
             ==================================================== */

          const result =
            await apiRequest(
              "/auth/request-access.php",
              {
                method: "POST",

                body:
                  JSON.stringify({
                    name,
                    email,
                    phone,
                    password
                  })
              }
            );


          console.log(
            "Staff request successful:",
            result
          );


          /* ----------------------------------------------------
             Success
             ---------------------------------------------------- */

          errorBox.textContent =
            "";


          staffRequestForm.hidden =
            true;


          if (
            showStaffRequestBtn
          ) {

            showStaffRequestBtn.hidden =
              true;

          }


          resultBox.hidden =
            false;


          resultBox.innerHTML = `

            <strong>
              Request sent
            </strong>

            <p
              class="small"
              style="margin:4px 0 0"
            >
              Your staff access request has
              been sent successfully.

              An Owner needs to approve your
              request from the Team page
              before you can log in.

              Use the password you just chose
              after approval.
            </p>

          `;


          staffRequestForm.reset();


        } catch (error) {

          console.error(
            "Staff access request error:",
            error
          );


          errorBox.textContent =
            error.message ||
            "Unable to send the staff access request.";


          resultBox.hidden =
            true;


        } finally {

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "Send request";

          }

        }

      }
    );

  }

})();