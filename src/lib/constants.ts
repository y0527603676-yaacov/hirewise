/** The business behind the site (shown in the footer and legal pages) */
export const BUSINESS = { name: "Helani Jewelry", address: "P.O. Box 1221, Safed, Israel", email: "hello@clearwise.me" };
export const appUrl = () => (process.env.APP_URL || "https://hire.clearwise.me").replace(/\/+$/, "");
export const retentionMonths = () => Math.max(1, Math.min(36, Number(process.env.RETENTION_MONTHS) || 12));

/** Accounts opened through a partner platform get an internal address that never receives mail */
export const PARTNER_EMAIL_DOMAIN = "partners.hire.clearwise.me";
export const notifyAddress = (u: { email: string; contactEmail: string | null }) =>
  u.email.endsWith(`@${PARTNER_EMAIL_DOMAIN}`) ? u.contactEmail || "" : u.email;
