/* ============================================================
   BusPal — Shared Validation Utilities

   Kept deliberately simple and dependency-free (matches the plain-JS
   stack). Used by every form across passenger/operator/conductor so
   "what counts as a valid phone number" is defined once, not copied
   into six different forms with six chances to drift out of sync.
   ============================================================ */

const Validate = (() => {

  function cleanPhone(v) {
    return (v || "").replace(/[\s-]/g, "");
  }

  /** Sri Lankan mobile numbers: 07XXXXXXXX (10 digits) or +947XXXXXXXX / 947XXXXXXXX. */
  function isValidPhone(v) {
    const p = cleanPhone(v);
    return /^(?:\+94|0)7\d{8}$/.test(p);
  }

  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
  }

  /** Sri Lankan NIC: old format (9 digits + V/X) or new format (12 digits). */
  function isValidNIC(v) {
    const n = (v || "").trim().toUpperCase();
    return /^\d{9}[VX]$/.test(n) || /^\d{12}$/.test(n);
  }

  /**
   * Live input filter for phone fields: strips anything that isn't a
   * digit or a leading '+', and caps the length as you type (10 digits
   * for local 07XXXXXXXX format, 12 for +947XXXXXXXX). This is on top
   * of isValidPhone()'s blur/submit check, not instead of it — this
   * stops you from ever typing an 11th digit in the first place;
   * isValidPhone still catches things like starting with the wrong
   * prefix (e.g. 08...) that length-capping alone can't.
   */
  function attachPhoneMask(inputEl) {
    if (!inputEl) return;
    inputEl.addEventListener("input", () => {
      let v = inputEl.value;
      const plus = v.startsWith("+");
      v = v.replace(/[^\d]/g, "");
      const max = plus ? 11 : 10; // "94" + 9 digits = 11, or "0" + 9 digits = 10
      v = v.slice(0, max);
      inputEl.value = plus ? "+" + v : v;
    });
  }


  function passwordStrength(pw) {
    pw = pw || "";
    if (!pw.length) return { score: 0, label: "", pct: 0, level: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (pw.length < 6) return { score, label: "Too short", pct: 15, level: "weak" };
    if (score <= 1) return { score, label: "Weak", pct: 30, level: "weak" };
    if (score === 2) return { score, label: "Fair", pct: 55, level: "fair" };
    if (score === 3) return { score, label: "Good", pct: 75, level: "good" };
    return { score, label: "Strong", pct: 100, level: "strong" };
  }

  /** Wires a live strength meter under a password <input>. Call once after the markup exists. */
  function attachPasswordMeter(inputEl, meterWrapEl) {
    if (!inputEl || !meterWrapEl) return;
    const bar = meterWrapEl.querySelector(".pw-strength-fill");
    const label = meterWrapEl.querySelector(".pw-strength-label");
    function update() {
      const s = passwordStrength(inputEl.value);
      meterWrapEl.hidden = !inputEl.value.length;
      if (bar) { bar.style.width = s.pct + "%"; bar.className = "pw-strength-fill" + (s.level ? ` pw-${s.level}` : ""); }
      if (label) label.textContent = s.label;
    }
    inputEl.addEventListener("input", update);
    update();
  }

  /** Marks/unmarks a field invalid and shows a message under it. Expects a sibling .field-error-msg element (or creates one). */
  function setFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.toggle("field-invalid", !!message);
    let msgEl = inputEl.parentElement.querySelector(".field-error-msg");
    if (!msgEl) {
      msgEl = document.createElement("div");
      msgEl.className = "field-error-msg";
      inputEl.insertAdjacentElement("afterend", msgEl);
    }
    msgEl.textContent = message || "";
    msgEl.hidden = !message;
  }

  return { cleanPhone, isValidPhone, isValidEmail, isValidNIC, passwordStrength, attachPasswordMeter, attachPhoneMask, setFieldError };
})();
