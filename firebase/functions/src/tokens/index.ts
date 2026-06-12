import { createHash, randomBytes } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

/** Store only SHA-256 hash of signing tokens — never the raw token. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cryptographically secure random signing token (64 hex chars). */
export function generateSigningToken(): string {
  return randomBytes(32).toString("hex");
}

export function getSigningUrl(token: string): string {
  const base =
    process.env.SIGNING_BASE_URL ||
    process.env.APP_BASE_URL ||
    "https://orynsolutions.io";
  return `${base.replace(/\/$/, "")}/sign/${token}`;
}

export function tokenExpiresAt(): Timestamp {
  const days = parseInt(process.env.TOKEN_EXPIRY_DAYS || "30", 10);
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  return Timestamp.fromDate(expires);
}
