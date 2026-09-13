/* ============================================================
   BusPal — Operator Dashboard — Settings
   Real PHP + MySQL
   ============================================================ */

(() => {

  /* ==========================================================
     RENDER SETTINGS
     ========================================================== */

  async function renderProfile(root) {

    root.innerHTML = `
      <div class="empty">
        <div class="ico">⚙</div>
        Loading settings…
      </div>
    `;

    let session = null;
    let operator = null;

    try {

      session = AuthStore.getSession();

      operator = await OpsAPI.getOperator();

    } catch (error) {

      console.error(
        "Settings load error:",
        error
      );

      root.innerHTML = emptyHTML(
        error.message ||
        "Unable to load settings."
      );

      return;
    }


    const isOwner =
      session?.role === "owner";


    root.innerHTML = `

      <!-- ====================================================
           YOUR ACCOUNT
           ==================================================== -->

      <div class="card card-pad">

        <h3 style="margin-bottom:4px">
          Your account
        </h3>

        <p
          class="muted small"
          style="margin-bottom:14px"
        >

          Signed in as

          <strong style="color:var(--text)">
            ${esc(
              operator?.name ||
              session?.name ||
              "Operator"
            )}
          </strong>

          ·

          <span
            class="
              pill
              ${
                isOwner
                  ? "active"
                  : "info"
              }
            "
          >
            ${esc(
              session?.role ||
              "operator"
            )}
          </span>

        </p>


        <form
          id="opForm"
          class="form-grid"
        >

          <div class="row-2">

            <div class="field-v">

              <label for="opCompany">
                Company
              </label>

              <input
                type="text"
                id="opCompany"
                value="BT Express (Pvt) Ltd"
              />

            </div>


            <div class="field-v">

              <label for="opName">
                Contact name
              </label>

              <input
                type="text"
                id="opName"
                value="${esc(
                  operator?.name ||
                  ""
                )}"
                required
              />

            </div>

          </div>


          <div class="row-2">

            <div class="field-v">

              <label for="opEmail">
                Company email
              </label>

              <input
                type="email"
                id="opEmail"
                value="${esc(
                  operator?.email ||
                  ""
                )}"
                required
              />

            </div>


            <div class="field-v">

              <label for="opPhone">
                Company phone
              </label>

              <input
                type="tel"
                id="opPhone"
                value="${esc(
                  operator?.phone ||
                  ""
                )}"
                placeholder="077 XXX XXXX"
              />

            </div>

          </div>


          <button
            class="btn brand"
            type="submit"
            id="saveProfileBtn"
            style="width:fit-content"
          >
            Save changes
          </button>

        </form>

      </div>


      <!-- ====================================================
           TEAM
           ==================================================== -->

      ${
        isOwner
          ? `

            <div
              id="pendingRequestsWrap"
            ></div>


            <div
              class="card card-pad"
            >

              <div
                class="section-toolbar"
                style="margin-bottom:12px"
              >

                <div>

                  <h3>
                    Team &amp; admin access
                  </h3>

                  <p
                    class="muted small"
                    style="margin-top:2px"
                  >
                    Everyone here can sign in to
                    this operator dashboard.
                  </p>

                </div>


                <button
                  class="btn brand"
                  id="addAdminBtn"
                  type="button"
                >
                  + Add admin
                </button>

              </div>


              <div
                id="teamTableWrap"
              >
                <div class="empty">
                  <div class="ico">♙</div>
                  Loading team…
                </div>
              </div>

            </div>

          `
          : ""
      }

    `;


    /* ==========================================================
       PHONE VALIDATION
       ========================================================== */

    Validate.attachPhoneMask(
      $("#opPhone", root)
    );


    $("#opPhone", root)
      .addEventListener(
        "blur",
        () => {

          const value =
            $("#opPhone", root)
              .value
              .trim();


          Validate.setFieldError(
            $("#opPhone", root),

            value &&
            !Validate.isValidPhone(
              value
            )

              ? "Enter a valid mobile number, e.g. 077 010 1107"

              : ""
          );

        }
      );


    /* ==========================================================
       SAVE OWNER ACCOUNT
       ========================================================== */

    $("#opForm", root)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          if (!isOwner) {

            toast(
              "Only the owner can edit account details."
            );

            return;
          }


          const id =
            Number(
              operator?.id ||
              session?.id ||
              0
            );


          const name =
            $("#opName", root)
              .value
              .trim();


          const email =
            $("#opEmail", root)
              .value
              .trim();


          const phone =
            $("#opPhone", root)
              .value
              .trim();


          if (!id) {

            toast(
              "Unable to identify your account."
            );

            return;
          }


          if (!name) {

            toast(
              "Contact name is required."
            );

            return;
          }


          if (!email) {

            toast(
              "Company email is required."
            );

            return;
          }


          if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              email
            )
          ) {

            toast(
              "Enter a valid email address."
            );

            return;
          }


          if (
            phone &&
            !Validate.isValidPhone(
              phone
            )
          ) {

            Validate.setFieldError(
              $("#opPhone", root),

              "Enter a valid mobile number, e.g. 077 010 1107"
            );

            toast(
              "Please fix the highlighted field."
            );

            return;
          }


          const saveButton =
            $("#saveProfileBtn", root);


          saveButton.disabled = true;

          saveButton.textContent =
            "Saving…";


          try {

            await OpsAPI.updateTeamMember(
              id,
              {
                name,
                email,
                phone
              }
            );


            /* ----------------------------------------------
               Update the in-memory operator object.
               No full Settings-page redraw is necessary.
               ---------------------------------------------- */

            operator.id =
              id;

            operator.name =
              name;

            operator.email =
              email;

            operator.phone =
              phone;


            toast(
              "Account details saved successfully."
            );


            /* ----------------------------------------------
               Keep the current values visible.
               ---------------------------------------------- */

            $("#opName", root).value =
              name;

            $("#opEmail", root).value =
              email;

            $("#opPhone", root).value =
              phone;


          } catch (error) {

            console.error(
              "Profile update error:",
              error
            );


            toast(
              error.message ||
              "Unable to save account details."
            );

          } finally {

            saveButton.disabled =
              false;

            saveButton.textContent =
              "Save changes";

          }

        }
      );


    /* ==========================================================
       OWNER TEAM
       ========================================================== */

    if (isOwner) {

      $("#addAdminBtn", root)
        .addEventListener(
          "click",
          () => {

            openAdminForm(
              root,
              null
            );

          }
        );


      await drawTeamTable(
        root
      );

    }

  }


  /* ==========================================================
     TEAM TABLE
     ========================================================== */

  async function drawTeamTable(root) {

    const teamWrap =
      $("#teamTableWrap", root);

    const pendingWrap =
      $("#pendingRequestsWrap", root);


    try {

      const team =
        await OpsAPI.getTeam();


      const safeTeam =
        Array.isArray(team)
          ? team
          : [];


      /* ------------------------------------------------------
         Team table
         ------------------------------------------------------ */

      teamWrap.innerHTML =
        safeTeam.length

          ? `

            <div class="table-wrap">

              <table class="data-table">

                <thead>

                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th></th>
                  </tr>

                </thead>


                <tbody>

                  ${safeTeam.map(
                    account => {

                      const accountId =
                        Number(
                          account.id
                        );


                      const currentId =
                        Number(
                          AuthStore.getSession()?.id
                        );


                      return `

                        <tr>

                          <td>

                            <div
                              class="cell-strong"
                            >

                              ${esc(
                                account.name ||
                                ""
                              )}

                              ${
                                accountId ===
                                currentId
                                  ? `
                                    <span
                                      class="
                                        muted
                                        small
                                      "
                                    >
                                      (you)
                                    </span>
                                  `
                                  : ""
                              }

                            </div>

                          </td>


                          <td
                            class="cell-mono"
                          >
                            ${esc(
                              account.email ||
                              ""
                            )}
                          </td>


                          <td
                            class="cell-mono"
                          >
                            ${esc(
                              account.phone ||
                              "—"
                            )}
                          </td>


                          <td>

                            <span
                              class="
                                pill
                                ${
                                  account.role ===
                                  "owner"
                                    ? "active"
                                    : "info"
                                }
                              "
                            >
                              ${esc(
                                account.role ||
                                "manager"
                              )}
                            </span>

                          </td>


                          <td
                            class="td-actions"
                          >

                            <button
                              type="button"
                              class="icon-btn"
                              title="Reset password"
                              data-reset-pw="${accountId}"
                            >
                              🔑
                            </button>


                            <button
                              type="button"
                              class="icon-btn"
                              title="Edit admin"
                              data-edit-admin="${accountId}"
                            >
                              ✎
                            </button>


                            ${
                              accountId ===
                              currentId

                                ? ""

                                : `
                                  <button
                                    type="button"
                                    class="
                                      icon-btn
                                      danger
                                    "
                                    title="Remove admin"
                                    data-del-admin="${accountId}"
                                  >
                                    🗑
                                  </button>
                                `
                            }

                          </td>

                        </tr>

                      `;

                    }
                  ).join("")}

                </tbody>

              </table>

            </div>

          `

          : emptyHTML(
              "No owner or manager accounts found."
            );


      /* ------------------------------------------------------
         Pending requests

         Load separately so a problem with pending.php
         does NOT destroy the team table.
         ------------------------------------------------------ */

      if (pendingWrap) {

        try {

          const pending =
            await OpsAPI.getPendingRequests();


          const safePending =
            Array.isArray(pending)
              ? pending
              : [];


          pendingWrap.innerHTML =
            safePending.length

              ? `

                <div
                  class="card card-pad"
                  style="
                    margin-bottom:16px;
                    border-color:
                    rgba(255,180,84,.35)
                  "
                >

                  <h3
                    style="margin-bottom:10px"
                  >
                    Pending access requests
                  </h3>


                  <div
                    style="
                      display:flex;
                      flex-direction:column;
                      gap:10px
                    "
                  >

                    ${safePending.map(
                      request => `

                        <div
                          class="dep-row"
                          style="
                            grid-template-columns:
                            1fr auto auto
                          "
                        >

                          <div>

                            <div
                              class="cell-strong"
                            >
                              ${esc(
                                request.name ||
                                ""
                              )}
                            </div>


                            <div
                              class="cell-sub"
                            >
                              ${esc(
                                request.email ||
                                ""
                              )}

                              ·

                              ${esc(
                                request.phone ||
                                "—"
                              )}
                            </div>

                          </div>


                          <button
                            type="button"
                            class="
                              btn
                              sm
                              brand
                            "
                            data-approve-req="${Number(
                              request.id
                            )}"
                          >
                            Approve
                          </button>


                          <button
                            type="button"
                            class="
                              btn
                              sm
                              danger
                            "
                            data-reject-req="${Number(
                              request.id
                            )}"
                          >
                            Reject
                          </button>

                        </div>

                      `
                    ).join("")}

                  </div>

                </div>

              `

              : "";


          /* --------------------------------------------------
             Approve
             -------------------------------------------------- */

          $$(
            "[data-approve-req]",
            root
          ).forEach(
            button => {

              button.addEventListener(
                "click",
                () => {

                  const id =
                    Number(
                      button.dataset
                        .approveReq
                    );


                  confirmAction(

                    "Approve this access request as a Manager?",

                    async () => {

                      try {

                        await OpsAPI.approveRequest(
                          id,
                          "manager"
                        );


                        toast(
                          "Access request approved."
                        );


                        await drawTeamTable(
                          root
                        );

                      } catch (error) {

                        console.error(
                          "Approve request error:",
                          error
                        );


                        toast(
                          error.message ||
                          "Unable to approve request."
                        );

                      }

                    }

                  );

                }
              );

            }
          );


          /* --------------------------------------------------
             Reject
             -------------------------------------------------- */

          $$(
            "[data-reject-req]",
            root
          ).forEach(
            button => {

              button.addEventListener(
                "click",
                () => {

                  const id =
                    Number(
                      button.dataset
                        .rejectReq
                    );


                  confirmAction(

                    "Reject this access request?",

                    async () => {

                      try {

                        await OpsAPI.rejectRequest(
                          id
                        );


                        toast(
                          "Access request rejected."
                        );


                        await drawTeamTable(
                          root
                        );

                      } catch (error) {

                        console.error(
                          "Reject request error:",
                          error
                        );


                        toast(
                          error.message ||
                          "Unable to reject request."
                        );

                      }

                    }

                  );

                }
              );

            }
          );


        } catch (pendingError) {

          console.error(
            "Pending requests error:",
            pendingError
          );


          /* Do not destroy the working team table. */

          pendingWrap.innerHTML = "";

        }

      }


      /* ------------------------------------------------------
         Reset password
         ------------------------------------------------------ */

      $$(
        "[data-reset-pw]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const id =
                Number(
                  button.dataset.resetPw
                );


              confirmAction(

                "Reset this admin's password?",

                async () => {

                  try {

                    const result =
                      await OpsAPI
                        .resetTeamMemberPassword(
                          id
                        );


                    const password =
                      result?.tempPassword ||
                      "";


                    toast(
                      password
                        ? `Password reset. Temporary password: ${password}`
                        : "Password reset successfully.",
                      7000
                    );


                  } catch (error) {

                    console.error(
                      "Reset password error:",
                      error
                    );


                    toast(
                      error.message ||
                      "Unable to reset password."
                    );

                  }

                }

              );

            }
          );

        }
      );


      /* ------------------------------------------------------
         Edit admin
         ------------------------------------------------------ */

      $$(
        "[data-edit-admin]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            async () => {

              const id =
                Number(
                  button.dataset.editAdmin
                );


              try {

                const team =
                  await OpsAPI.getTeam();


                const admin =
                  team.find(
                    item =>
                      Number(item.id) ===
                      id
                  );


                if (!admin) {

                  toast(
                    "Admin not found."
                  );

                  return;
                }


                openAdminForm(
                  root,
                  admin
                );


              } catch (error) {

                console.error(
                  "Edit admin load error:",
                  error
                );


                toast(
                  error.message ||
                  "Unable to open admin."
                );

              }

            }
          );

        }
      );


      /* ------------------------------------------------------
         Delete admin
         ------------------------------------------------------ */

      $$(
        "[data-del-admin]",
        root
      ).forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const id =
                Number(
                  button.dataset.delAdmin
                );


              confirmAction(

                "Remove this admin from the team? They will lose dashboard access.",

                async () => {

                  try {

                    await OpsAPI.removeTeamMember(
                      id
                    );


                    toast(
                      "Admin removed."
                    );


                    await drawTeamTable(
                      root
                    );


                  } catch (error) {

                    console.error(
                      "Remove admin error:",
                      error
                    );


                    toast(
                      error.message ||
                      "Unable to remove admin."
                    );

                  }

                }

              );

            }
          );

        }
      );


    } catch (error) {

      console.error(
        "Team loading error:",
        error
      );


      teamWrap.innerHTML =
        emptyHTML(
          error.message ||
          "Unable to load the admin team."
        );

    }

  }


  /* ==========================================================
     ADD / EDIT ADMIN
     ========================================================== */

  function openAdminForm(
    root,
    admin = null
  ) {

    const isEdit =
      !!admin;


    const body =
      openForm(

        isEdit
          ? "Edit admin"
          : "Add admin",

        `

          <form
            id="adminForm"
            class="form-grid"
          >

            <div class="row-2">

              <div class="field-v">

                <label for="afName">
                  Full name
                </label>

                <input
                  type="text"
                  id="afName"
                  value="${esc(
                    admin?.name ||
                    ""
                  )}"
                  required
                />

              </div>


              <div class="field-v">

                <label for="afRole">
                  Access level
                </label>

                <select
                  id="afRole"
                >

                  <option
                    value="manager"
                    ${
                      admin?.role ===
                      "manager" ||
                      !isEdit
                        ? "selected"
                        : ""
                    }
                  >
                    Manager — operational access
                  </option>


                  <option
                    value="owner"
                    ${
                      admin?.role ===
                      "owner"
                        ? "selected"
                        : ""
                    }
                  >
                    Owner — full access
                  </option>

                </select>

              </div>

            </div>


            <div class="row-2">

              <div class="field-v">

                <label for="afEmail">
                  Email
                </label>

                <input
                  type="email"
                  id="afEmail"
                  value="${esc(
                    admin?.email ||
                    ""
                  )}"
                  ${
                    isEdit
                      ? ""
                      : "required"
                  }
                />

              </div>


              <div class="field-v">

                <label for="afPhone">
                  Phone
                </label>

                <input
                  type="tel"
                  id="afPhone"
                  value="${esc(
                    admin?.phone ||
                    ""
                  )}"
                  placeholder="07X XXX XXXX"
                />

              </div>

            </div>


            ${
              !isEdit

                ? `

                  <div class="field-v">

                    <label
                      for="afPass"
                    >
                      Temporary password
                    </label>

                    <input
                      type="text"
                      id="afPass"
                      placeholder="Leave blank to auto-generate"
                    />

                  </div>

                `

                : ""
            }


            <button
              class="btn brand"
              type="submit"
            >
              ${
                isEdit
                  ? "Save changes"
                  : "Add admin"
              }
            </button>

          </form>

        `
      );


    Validate.attachPhoneMask(
      $("#afPhone", body)
    );


    /* ========================================================
       SUBMIT ADMIN
       ======================================================== */

    $("#adminForm", body)
      .addEventListener(
        "submit",
        async event => {

          event.preventDefault();


          const name =
            $("#afName", body)
              .value
              .trim();


          const role =
            $("#afRole", body)
              .value;


          const email =
            $("#afEmail", body)
              .value
              .trim();


          const phone =
            $("#afPhone", body)
              .value
              .trim();


          if (!name) {

            toast(
              "Name is required."
            );

            return;
          }


          if (!isEdit && !email) {

            toast(
              "Email is required."
            );

            return;
          }


          if (
            email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              email
            )
          ) {

            toast(
              "Enter a valid email address."
            );

            return;
          }


          if (
            phone &&
            !Validate.isValidPhone(
              phone
            )
          ) {

            toast(
              "Enter a valid Sri Lankan mobile number."
            );

            return;
          }


          try {

            /* --------------------------------------------------
               EDIT
               -------------------------------------------------- */

            if (isEdit) {

              await OpsAPI.updateTeamMember(

                Number(
                  admin.id
                ),

                {
                  name,
                  email,
                  phone,
                  role
                }

              );


              closeModal(
                "formModal"
              );


              toast(
                "Admin updated."
              );


              await drawTeamTable(
                root
              );


              return;
            }


            /* --------------------------------------------------
               ADD
               -------------------------------------------------- */

            const password =
              $("#afPass", body)
                ?.value
                .trim() ||
              "";


            const result =
              await OpsAPI.addTeamMember({

                name,

                email,

                phone,

                role,

                password:
                  password ||
                  undefined

              });


            closeModal(
              "formModal"
            );


            if (
              result?.tempPassword
            ) {

              toast(
                `Admin added. Temporary password: ${result.tempPassword}`,
                7000
              );

            } else {

              toast(
                "Admin added successfully."
              );

            }


            await drawTeamTable(
              root
            );


          } catch (error) {

            console.error(
              "Admin form error:",
              error
            );


            toast(
              error.message ||
              "Unable to save admin."
            );

          }

        }
      );

  }


  /* ==========================================================
     REGISTER SETTINGS ROUTE
     ========================================================== */

  ROUTES_MAP.profile = {

    title:
      "Settings",

    sub:
      "Operator account details and admin access.",

    render:
      renderProfile

  };

})();