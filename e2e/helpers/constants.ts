export const CASE_URL_PATTERN = /\/case\/[a-f0-9-]+/;
// The "Ready to Publish" intermediate state was retired (ADR 0003 §2) — a
// case is either DRAFT or PUBLISHED now.
export const STATUS_BUTTON_PATTERN = /Draft|Published/;
export const LOGIN_PATTERN = /\/login/;
