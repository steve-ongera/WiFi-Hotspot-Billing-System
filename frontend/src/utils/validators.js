/**
 * utils/validators.js — WifiBill form validators
 * Each function returns an error string or "" for valid.
 */

export const validatePhone = (value = "") => {
  const raw = value.trim().replace(/\s|-/g, "");
  if (!raw) return "Phone number is required.";
  const normalized =
    raw.startsWith("07") || raw.startsWith("01")
      ? "254" + raw.slice(1)
      : raw.startsWith("+254")
      ? raw.slice(1)
      : raw;
  if (!/^254(7|1)\d{8}$/.test(normalized))
    return "Enter a valid Kenyan number: 07XX or 01XX.";
  return "";
};

export const validatePassword = (value = "") => {
  if (!value) return "Password is required.";
  if (value.length < 6) return "Password must be at least 6 characters.";
  return "";
};

export const validatePasswordConfirm = (password, confirm) => {
  if (!confirm) return "Please confirm your password.";
  if (password !== confirm) return "Passwords do not match.";
  return "";
};

export const validateEmail = (value = "") => {
  if (!value) return "";                  // optional field
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address.";
  return "";
};

export const validateRequired = (value, label = "This field") => {
  if (!value || (typeof value === "string" && !value.trim()))
    return `${label} is required.`;
  return "";
};

export const validatePositiveNumber = (value, label = "Value") => {
  if (value === "" || value == null) return `${label} is required.`;
  if (isNaN(Number(value)) || Number(value) <= 0) return `${label} must be a positive number.`;
  return "";
};

export const validateMAC = (value = "") => {
  if (!value) return "";                  // optional
  if (!/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(value))
    return "Enter a valid MAC address (e.g. AA:BB:CC:DD:EE:FF).";
  return "";
};

export const validateVoucherCode = (value = "") => {
  if (!value.trim()) return "Voucher code is required.";
  if (value.trim().length < 6) return "Voucher code is too short.";
  return "";
};

/** Run a map of { fieldName: validatorFn } and return { fieldName: errorMsg } */
export const runValidators = (validators) => {
  const errors = {};
  Object.entries(validators).forEach(([field, fn]) => {
    const msg = fn();
    if (msg) errors[field] = msg;
  });
  return errors;
};