/* BusPal — Operator Dashboard — Feedback & SOS */

(() => {

  async function ensureFeedbackReportScript() {

    if (typeof window.generateFeedbackReport === "function") return;

    const existing = document.querySelector(
      'script[data-feedback-report="true"]'
    );

    if (existing) {

      await new Promise((resolve, reject) => {

        existing.addEventListener(
          "load",
          resolve,
          { once: true }
        );

        existing.addEventListener(
          "error",
          reject,
          { once: true }
        );

      });

      return;
    }

    const current = Array.from(document.scripts).find(
      s => /feedback\.js(?:\?|$)/i.test(s.src)
    );

    const src = current
      ? new URL("feedback-report.js", current.src).href
      : "feedback-report.js";

    await new Promise((resolve, reject) => {

      const script = document.createElement("script");

      script.src = src;
      script.async = true;
      script.dataset.feedbackReport = "true";

      script.onload = resolve;

      script.onerror = () =>
        reject(
          new Error("Could not load feedback-report.js")
        );

      document.head.appendChild(script);

    });

  }


  async function openFeedbackReport(feedback, sos) {

    try {

      await ensureFeedbackReportScript();

      if (
        typeof window.generateFeedbackReport !== "function"
      ) {
        throw new Error(
          "Report generator unavailable"
        );
      }

      await window.generateFeedbackReport({
        feedback,
        sos
      });

    } catch (error) {

      console.error(
        "Feedback report error:",
        error
      );

      toast(
        "Could not generate the Feedback & SOS report."
      );

    }

  }


  async function renderFeedback(root) {

    root.innerHTML = `
      <div class="empty">
        <div class="ico">✆</div>
        Loading…
      </div>
    `;


    const [feedback, sos] = await Promise.all([
      BusPalAPI.getFeedback(),
      BusPalAPI.getSOSAlerts()
    ]);


    refreshSOSBadge();


    root.innerHTML = `

      <p
        class="muted small"
        style="margin-bottom:4px"
      >
        Resolved feedback and SOS alerts older than 30 days
        are cleared out automatically — nothing open or
        unresolved ever gets removed on its own.
      </p>


      <!-- Generate Report Button -->

      <div
        style="
          display:flex;
          justify-content:flex-end;
          align-items:center;
          margin-bottom:16px;
        "
      >

        <button
          class="btn brand"
          id="generate-feedback-report"
        >
          ▣ Generate Report
        </button>

      </div>


      <!-- SOS Alerts -->

      <div class="card card-pad">

        <h3 style="margin-bottom:12px">
          SOS alerts
        </h3>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px
          "
        >

          ${
            sos.length
              ? sos.map(s => `

                <div
                  class="card card-pad"
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                    flex-wrap:wrap
                  "
                >

                  <div>

                    <div
                      style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        margin-bottom:4px
                      "
                    >

                      <strong>
                        ${esc(s.passengerName)}
                      </strong>

                      <span
                        class="pill ${
                          s.status === "resolved"
                            ? "resolved"
                            : "open"
                        }"
                      >
                        ${esc(s.status)}
                      </span>

                    </div>


                    <div class="muted small">
                      ${esc(s.trip)}
                      ·
                      ${esc(s.note)}
                      ·
                      ${new Date(
                        s.createdAt
                      ).toLocaleString()}
                    </div>

                  </div>


                  <div
                    style="
                      display:flex;
                      gap:8px
                    "
                  >

                    ${
                      s.status !== "resolved"
                        ? `
                          <button
                            class="btn sm brand"
                            data-resolve-sos="${esc(s.id)}"
                          >
                            Mark resolved
                          </button>
                        `
                        : ""
                    }


                    <button
                      class="icon-btn danger"
                      title="Delete"
                      data-del-sos="${esc(s.id)}"
                    >
                      🗑
                    </button>

                  </div>

                </div>

              `).join("")

              : emptyHTML(
                  "No SOS alerts on record."
                )
          }

        </div>

      </div>


      <!-- Feedback & Complaints -->

      <div class="card card-pad">

        <h3 style="margin-bottom:12px">
          Feedback &amp; complaints
        </h3>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:10px
          "
        >

          ${
            feedback.length
              ? feedback.map(f => `

                <div
                  class="card card-pad"
                  style="
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    gap:10px;
                    flex-wrap:wrap
                  "
                >

                  <div>

                    <div
                      style="
                        display:flex;
                        align-items:center;
                        gap:8px;
                        margin-bottom:4px
                      "
                    >

                      <strong>
                        ${esc(f.passengerName)}
                      </strong>


                      <span
                        class="badge ${
                          f.type === "complaint"
                            ? "bad"
                            : "ok"
                        }"
                      >
                        ${esc(f.type)}
                      </span>


                      <span
                        class="pill ${esc(f.status)}"
                      >
                        ${esc(f.status)}
                      </span>

                    </div>


                    <div class="muted small">
                      ${esc(f.trip)}
                    </div>


                    <div style="margin-top:6px">
                      ${esc(f.message)}
                    </div>

                  </div>


                  <div
                    style="
                      display:flex;
                      gap:8px
                    "
                  >

                    ${
                      f.status !== "closed"
                        ? `
                          <button
                            class="btn sm brand"
                            data-resolve-fb="${esc(f.id)}"
                          >
                            Mark resolved
                          </button>
                        `
                        : ""
                    }


                    <button
                      class="icon-btn danger"
                      title="Delete"
                      data-del-fb="${esc(f.id)}"
                    >
                      🗑
                    </button>

                  </div>

                </div>

              `).join("")

              : emptyHTML(
                  "No feedback yet."
                )
          }

        </div>

      </div>

    `;


    /* =========================================================
       GENERATE REPORT BUTTON
       ========================================================= */

    const reportButton =
      document.getElementById(
        "generate-feedback-report"
      );


    if (reportButton) {

      reportButton.addEventListener(
        "click",
        async () => {

          reportButton.disabled = true;

          reportButton.textContent =
            "Generating…";


          try {

            await openFeedbackReport(
              feedback,
              sos
            );

          } finally {

            reportButton.disabled = false;

            reportButton.textContent =
              "▣ Generate Report";

          }

        }
      );

    }


    /* =========================================================
       RESOLVE SOS
       ========================================================= */

    $$(
      '[data-resolve-sos]',
      root
    ).forEach(
      b =>
        b.addEventListener(
          "click",
          async () => {

            await BusPalAPI.resolveSOS(
              b.dataset.resolveSos
            );

            toast(
              "SOS marked resolved."
            );

            go("feedback");

          }
        )
    );


    /* =========================================================
       DELETE SOS
       ========================================================= */

    $$(
      '[data-del-sos]',
      root
    ).forEach(
      b =>
        b.addEventListener(
          "click",
          () => {

            confirmAction(
              "Delete this SOS record? This can't be undone.",
              async () => {

                await BusPalAPI.deleteSOS(
                  b.dataset.delSos
                );

                toast(
                  "SOS record deleted."
                );

                go("feedback");

              }
            );

          }
        )
    );


    /* =========================================================
       RESOLVE FEEDBACK
       ========================================================= */

    $$(
      '[data-resolve-fb]',
      root
    ).forEach(
      b =>
        b.addEventListener(
          "click",
          async () => {

            await BusPalAPI.resolveFeedback(
              b.dataset.resolveFb
            );

            toast(
              "Feedback marked resolved."
            );

            go("feedback");

          }
        )
    );


    /* =========================================================
       DELETE FEEDBACK
       ========================================================= */

    $$(
      '[data-del-fb]',
      root
    ).forEach(
      b =>
        b.addEventListener(
          "click",
          () => {

            confirmAction(
              "Delete this feedback record? This can't be undone.",
              async () => {

                await BusPalAPI.deleteFeedback(
                  b.dataset.delFb
                );

                toast(
                  "Feedback deleted."
                );

                go("feedback");

              }
            );

          }
        )
    );

  }


  ROUTES_MAP.feedback = {
    title: "Feedback & SOS",
    sub: "Respond to passenger feedback and emergency alerts.",
    render: renderFeedback
  };

})();