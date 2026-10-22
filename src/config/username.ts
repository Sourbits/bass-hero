/**
 * What a username can be: 3 to 20 letters, numbers, _ and ., unique
 * ignoring case. Shown as typed ("BassAlex"), matched in lower case.
 */
export const USERNAME = {
  maxLength: 20,
  minLength: 3,
  /** For the form field's pattern attribute. */
  pattern: "[A-Za-z0-9_.]+",
};
