/* ============================================================
   BusPal — Shared Auth Store (mock, client-side only)

   IMPORTANT: this is a frontend demo stand-in. Passwords are
   stored in plain text in localStorage purely so the login flow
   is demonstrable without a backend. When Spring Boot is wired
   up, replace every function body here with real API calls
   (register/login returning a JWT, role read from the token) —
   nothing in the pages that call AuthStore needs to change shape.
   ============================================================ */

const AuthStore = (() => {
  const ACCOUNTS_KEY = "buspal_accounts";
  const SESSION_KEY = "buspal_session";

  function readAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || []; }
    catch { return []; }
  }
  function writeAccounts(list) { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list)); }
  const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  function seedIfEmpty() {
    if (readAccounts().length) return;
    writeAccounts([
      { id: "ACC-P1", role: "passenger", name: "R. Kavishali", email: "kavishali@example.com", phone: "077 123 4567", password: "demo123", status: "active" },
      { id: "ACC-O1", role: "owner", name: "L. Prathap", email: "ops@btexpress.lk", phone: "077 010 1107", password: "demo123", status: "active" },
      { id: "ACC-O2", role: "manager", name: "N. Silva", email: "manager@btexpress.lk", phone: "071 555 3322", password: "demo123", status: "active", addedBy: "ACC-O1" },
    ]);
  }

  function getAccounts() { return readAccounts(); }
  function findByEmail(email) {
    return readAccounts().find(a => a.email.toLowerCase() === String(email).toLowerCase());
  }

  function registerPassenger({ name, email, phone, password }) {
    const accounts = readAccounts();
    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return { error: "An account with this email already exists." };
    }
    const account = { id: uid("ACC"), role: "passenger", name, email, phone, password, status: "active" };
    accounts.push(account);
    writeAccounts(accounts);
    setSession(account);
    return { account };
  }

  function login(email, password) {
    const account = findByEmail(email);
    if (!account || account.password !== password) return { error: "Incorrect email or password." };
    if (account.status === "pending") {
      return { error: "Your account is awaiting approval from the Owner. You'll be able to log in once it's approved." };
    }
    setSession(account);
    return { account };
  }

  // Mock reset: in production this sends an emailed link with a signed,
  // expiring token. Here it issues a new temp password directly, same
  // pattern as addTeamMember's temp-password flow.
  function requestPasswordReset(email) {
    const accounts = readAccounts();
    const account = accounts.find(a => a.email.toLowerCase() === String(email).toLowerCase());
    if (!account) return { error: "No account found with that email." };
    const tempPassword = "reset-" + Math.random().toString(36).slice(2, 8);
    account.password = tempPassword;
    writeAccounts(accounts);
    return { tempPassword };
  }

  function setSession(account) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: account.id, role: account.role, name: account.name, email: account.email }));
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  // Redirects to the right dashboard for a role. Used right after login/register.
  function routeForRole(role) {
    return role === "passenger" ? "./passenger/index.html" : "./operator/index.html";
  }

  // Call at the top of a protected page. Redirects to login if there's no
  // session, or if the session's role isn't in allowedRoles.
  function requireRole(allowedRoles, loginUrl) {
    const session = getSession();
    if (!session || !allowedRoles.includes(session.role)) {
      window.location.href = loginUrl;
      return null;
    }
    return session;
  }

  // ---- Team management (operator admins) — owner only in the UI ----
  function getTeam() {
    return readAccounts().filter(a => a.role === "owner" || a.role === "manager");
  }
  function addTeamMember({ name, email, phone, role, password }) {
    const accounts = readAccounts();
    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return { error: "An account with this email already exists." };
    }
    const tempPassword = password || ("welcome-" + Math.random().toString(36).slice(2, 8));
    const account = { id: uid("ACC"), role, name, email, phone, password: tempPassword, status: "active" };
    accounts.push(account);
    writeAccounts(accounts);
    return { account };
  }
  function updateTeamMember(id, patch) {
    const accounts = readAccounts().map(a => a.id === id ? { ...a, ...patch } : a);
    writeAccounts(accounts);
    return accounts.find(a => a.id === id);
  }
  function removeTeamMember(id) {
    const accounts = readAccounts();
    const target = accounts.find(a => a.id === id);
    if (!target) return { error: "Not found." };
    const owners = accounts.filter(a => a.role === "owner");
    if (target.role === "owner" && owners.length <= 1) {
      return { error: "You can't remove the last owner account." };
    }
    writeAccounts(accounts.filter(a => a.id !== id));
    return { ok: true };
  }

  /** Owner-triggered reset for an existing team member — distinct from requestPasswordReset, which the account holder triggers themselves via "Forgot password". */
  function resetTeamMemberPassword(id) {
    const accounts = readAccounts();
    const account = accounts.find(a => a.id === id);
    if (!account) return { error: "Not found." };
    const tempPassword = "reset-" + Math.random().toString(36).slice(2, 8);
    account.password = tempPassword;
    writeAccounts(accounts);
    return { tempPassword };
  }

  // ---- Manager self-registration, pending Owner approval ----
  // An alternative to Owner-initiated invites: a prospective manager submits
  // their own details + password and can't log in until an Owner approves.
  function requestOperatorAccess({ name, email, phone, password }) {
    const accounts = readAccounts();
    if (accounts.some(a => a.email.toLowerCase() === email.toLowerCase())) {
      return { error: "An account with this email already exists." };
    }
    const account = { id: uid("ACC"), role: "manager", name, email, phone, password, status: "pending" };
    accounts.push(account);
    writeAccounts(accounts);
    return { account };
  }
  function getPendingRequests() {
    return readAccounts().filter(a => a.status === "pending");
  }
  function approveRequest(id, role) {
    const accounts = readAccounts().map(a => a.id === id ? { ...a, status: "active", role: role || a.role } : a);
    writeAccounts(accounts);
    return accounts.find(a => a.id === id);
  }
  function rejectRequest(id) {
    writeAccounts(readAccounts().filter(a => a.id !== id));
    return { id };
  }

  return {
    seedIfEmpty, getAccounts, findByEmail,
    registerPassenger, login, setSession, getSession, clearSession, routeForRole, requireRole,
    requestPasswordReset,
    getTeam, addTeamMember, updateTeamMember, removeTeamMember, resetTeamMemberPassword,
    requestOperatorAccess, getPendingRequests, approveRequest, rejectRequest,
  };
})();

AuthStore.seedIfEmpty();
