/* ============================================================
   BusPal — Shared Auth Store

   Real PHP + MySQL backend authentication.

   Session/token information is stored in sessionStorage so
   Passenger and Operator can be tested in separate browser tabs
   without one tab overwriting the other's authentication token.

   Passwords are never stored in browser storage.
   ============================================================ */

const AuthStore = (() => {
  const SESSION_KEY = "buspal_session";
  const TOKEN_KEY = "buspal_token";

  const API_BASE =
    "http://localhost/buspal-backend-php/api";

  async function apiRequest(endpoint, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (error) {
      console.error("API connection error:", error);

      return {
        error:
          "Unable to connect to the server. Make sure WAMP and Apache are running.",
      };
    }

    let body = null;

    try {
      body = await response.json();
    } catch {
      return {
        error:
          `Server returned an invalid response. HTTP ${response.status}.`,
      };
    }

    if (!response.ok || body?.success === false) {
      return {
        error:
          body?.message ||
          body?.error ||
          `Request failed with status ${response.status}.`,
      };
    }

    return body;
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setSession(accountData) {
    const session = {
      id: accountData.accountId,
      role: String(accountData.role).toLowerCase(),
      name: accountData.name,
      email: accountData.email,
    };

    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    );

    if (accountData.token) {
      sessionStorage.setItem(
        TOKEN_KEY,
        accountData.token
      );
    }

    return session;
  }

  function getSession() {
    try {
      return JSON.parse(
        sessionStorage.getItem(SESSION_KEY)
      );
    } catch {
      return null;
    }
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  }

  async function login(email, password) {
    const result = await apiRequest(
      "/auth/login.php",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      }
    );

    if (result.error) {
      return { error: result.error };
    }

    const accountData = result.data;

    if (
      !accountData ||
      !accountData.token ||
      accountData.accountId == null ||
      !accountData.role
    ) {
      console.error(
        "Unexpected login response:",
        result
      );

      return {
        error:
          "Login failed. Invalid server response.",
      };
    }

    const session =
      setSession(accountData);

    return {
      account: session,
      token: accountData.token,
    };
  }

  async function registerPassenger({
    name,
    email,
    phone,
    password,
  }) {
    const result = await apiRequest(
      "/auth/register.php",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
        }),
      }
    );

    if (result.error) {
      return { error: result.error };
    }

    const accountData = result.data;

    if (
      !accountData ||
      !accountData.token ||
      accountData.accountId == null ||
      !accountData.role
    ) {
      console.error(
        "Unexpected register response:",
        result
      );

      return {
        error:
          "Registration failed. Invalid server response.",
      };
    }

    const session =
      setSession(accountData);

    return {
      account: session,
      token: accountData.token,
    };
  }

  async function requestPasswordReset(email) {
    const result = await apiRequest(
      "/auth/reset-password.php",
      {
        method: "POST",
        body: JSON.stringify({
          email,
        }),
      }
    );

    if (result.error) {
      return { error: result.error };
    }

    return result.data || result;
  }

  function routeForRole(role) {
    return role === "passenger"
      ? "./passenger/index.html"
      : "./operator/index.html";
  }

  function requireRole(
    allowedRoles,
    loginUrl
  ) {
    const session = getSession();

    if (
      !session ||
      !allowedRoles.includes(session.role)
    ) {
      window.location.href = loginUrl;
      return null;
    }

    return session;
  }

  return {
    login,
    registerPassenger,
    requestPasswordReset,
    setSession,
    getSession,
    clearSession,
    getToken,
    routeForRole,
    requireRole,
  };
})();