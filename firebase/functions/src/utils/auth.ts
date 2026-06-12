import { CallableRequest, HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";

const adminEmails = (): Set<string> => {
  const raw = process.env.ADMIN_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
};

export async function requireAdmin(
  request: CallableRequest<unknown>
): Promise<{ uid: string; email: string }> {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const email = (request.auth.token.email as string | undefined)?.toLowerCase();
  if (!email) {
    throw new HttpsError("unauthenticated", "Email required.");
  }

  const allowed = adminEmails();
  const hasClaim = request.auth.token.admin === true;

  if (!hasClaim && !allowed.has(email)) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  return { uid: request.auth.uid, email };
}

export async function syncAdminClaim(email: string): Promise<void> {
  const allowed = adminEmails();
  if (!allowed.has(email.toLowerCase())) return;

  const user = await getAuth().getUserByEmail(email);
  await getAuth().setCustomUserClaims(user.uid, { admin: true });
}

export function getClientIp(request: CallableRequest<unknown>): string {
  const raw = request.rawRequest.headers["x-forwarded-for"];
  if (typeof raw === "string") return raw.split(",")[0].trim();
  if (Array.isArray(raw) && raw[0]) return raw[0].split(",")[0].trim();
  return request.rawRequest.socket?.remoteAddress || "unknown";
}

export function getUserAgent(request: CallableRequest<unknown>): string {
  return String(request.rawRequest.headers["user-agent"] || "unknown");
}
