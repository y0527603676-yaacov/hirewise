/** The business behind the site (shown in the footer and legal pages) */
export const BUSINESS = { name: "Helani Jewelry", address: "P.O. Box 1221, Safed, Israel", email: "hello@clearwise.me" };
export const appUrl = () => (process.env.APP_URL || "https://hire.clearwise.me").replace(/\/+$/, "");
export const retentionMonths = () => Math.max(1, Math.min(36, Number(process.env.RETENTION_MONTHS) || 12));
