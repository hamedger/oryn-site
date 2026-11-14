import { randomUUID } from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { Resend } from "resend";

// Outreach response tracking for the automotive and restaurant outreach agents.
// Each prospect has a vertical ("automotive" by default, or "restaurant"); stats are kept per vertical.
//
// Public (called from orynsolutions.io/go/):
//   GET  ?s=<slug>                         -> name, vertical, concept image, estimate, prefilled phone; logs a click
//   POST {s, phone}                        -> "Call me" lead; emails info@
//   POST {s, action: "unsubscribe"}        -> adds the shop to the suppression list
//
// Agent only (header x-agent-key must equal OUTREACH_AGENT_KEY):
//   POST {action: "register", prospect}    -> creates/updates a prospect, uploads its concept image
//   GET  ?action=stats[&vertical=restaurant] -> totals per design and per area for that vertical's daily report

const DESIGNS = ["A", "B", "C", "D", "E"] as const;
type Design = (typeof DESIGNS)[number];

const PROSPECTS = "outreachProspects";
const EVENTS = "outreachEvents";
const SUPPRESSION = "outreachSuppression";

const VERTICALS = ["automotive", "restaurant"] as const;
type Vertical = (typeof VERTICALS)[number];
const REASONS = ["no_website", "outdated_website", "apps_only", "no_ordering"] as const;
type Reason = (typeof REASONS)[number];

function asVertical(v: unknown): Vertical {
  return v === "restaurant" ? "restaurant" : "automotive";
}

function shortText(v: unknown, max = 80): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

const REASON_TEXT: Record<Reason, string> = {
  no_website: "no website",
  outdated_website: "outdated website",
  apps_only: "on delivery apps, no direct ordering",
  no_ordering: "no online ordering",
};

interface Prospect {
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  area?: string | null;
  design: Design;
  vertical?: Vertical;
  reason?: Reason;
  apps?: string | null;
  estimate?: string | null;
  imageUrl?: string | null;
  status?: "sent" | "clicked" | "interested" | "unsubscribed";
  sentAt?: FirebaseFirestore.Timestamp;
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

function cleanPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

function formatPhone(d: string): string {
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  );
}

function isAgent(req: Request): boolean {
  const key = process.env.OUTREACH_AGENT_KEY;
  return !!key && req.get("x-agent-key") === key;
}

async function logEvent(
  p: Prospect,
  type: "click" | "interested" | "unsubscribe",
  extra: Record<string, unknown> = {}
): Promise<void> {
  await getFirestore().collection(EVENTS).add({
    slug: p.slug,
    design: p.design,
    area: p.area ?? null,
    vertical: asVertical(p.vertical),
    type,
    at: FieldValue.serverTimestamp(),
    ...extra,
  });
}

async function getProspect(slug: unknown): Promise<Prospect | null> {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) return null;
  const snap = await getFirestore().collection(PROSPECTS).doc(slug).get();
  return snap.exists ? (snap.data() as Prospect) : null;
}

async function notifyLead(p: Prospect, phone: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const to = process.env.ADMIN_NOTIFY_EMAIL || "info@orynsolutions.io";
  const from = process.env.OUTREACH_FROM || process.env.EMAIL_FROM || "Oryn Solutions <info@orynsolutions.io>";
  const name = escapeHtml(p.name);
  const where = escapeHtml([p.city, p.area].filter(Boolean).join(", "));
  const restaurant = asVertical(p.vertical) === "restaurant";
  const reason = REASON_TEXT[(p.reason as Reason) || "no_website"] || "no website";
  await new Resend(key).emails.send({
    from,
    to,
    subject: restaurant
      ? `New restaurant lead: ${p.name}${p.city ? ` (${p.city})` : ""}`
      : `New lead: ${p.name} wants a call`,
    html: `
      <p><b>${name}</b>${where ? ` (${where})` : ""} tapped "${restaurant ? "Call me about my savings" : "Call me"}" on their concept page.</p>
      <p style="font-size:20px"><b>Call ${formatPhone(phone)}</b></p>
      <p>Design they saw: <b>${p.design}</b><br/>
      Why we reached out: ${escapeHtml(reason)}<br/>
      ${restaurant && p.apps ? `Delivery apps: ${escapeHtml(p.apps)}<br/>` : ""}
      ${restaurant && p.estimate ? `Estimate shown: ${escapeHtml(p.estimate)}<br/>` : ""}
      Email on file: ${escapeHtml(p.email || "none")}</p>
      ${p.imageUrl ? `<p><img src="${p.imageUrl}" alt="Concept" style="max-width:560px;border:1px solid #ddd"/></p>` : ""}
    `,
  });
}

async function uploadConcept(slug: string, design: Design, base64: string): Promise<string> {
  const bucket = getStorage().bucket();
  const path = `outreach/concepts/${slug}-${design}.jpg`;
  const token = randomUUID();
  await bucket.file(path).save(Buffer.from(base64, "base64"), {
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
    path
  )}?alt=media&token=${token}`;
}

async function register(body: Record<string, unknown>, res: Response): Promise<void> {
  const p = (body.prospect || {}) as Partial<Prospect> & { imageBase64?: string };
  if (typeof p.slug !== "string" || !SLUG_RE.test(p.slug) || typeof p.name !== "string") {
    res.status(400).json({ error: "slug and name are required" });
    return;
  }
  const design = (DESIGNS as readonly string[]).includes(p.design as string) ? (p.design as Design) : "A";
  const suppressed = await getFirestore().collection(SUPPRESSION).doc(p.slug).get();
  if (suppressed.exists) {
    res.status(409).json({ error: "suppressed", slug: p.slug });
    return;
  }
  const imageUrl = p.imageBase64 ? await uploadConcept(p.slug, design, p.imageBase64) : p.imageUrl ?? null;
  const doc: Prospect = {
    slug: p.slug,
    name: p.name.slice(0, 120),
    email: p.email ?? null,
    phone: cleanPhone(p.phone) ?? null,
    city: p.city ?? null,
    area: p.area ?? null,
    design,
    vertical: asVertical(p.vertical),
    reason: (REASONS as readonly string[]).includes(p.reason as string) ? (p.reason as Reason) : "no_website",
    apps: shortText(p.apps),
    estimate: shortText(p.estimate, 24),
    imageUrl,
    status: "sent",
    sentAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await getFirestore().collection(PROSPECTS).doc(p.slug).set(doc, { merge: true });
  res.json({ ok: true, slug: p.slug, imageUrl });
}

async function stats(res: Response, vertical: Vertical): Promise<void> {
  const db = getFirestore();
  const [prospects, events] = await Promise.all([db.collection(PROSPECTS).get(), db.collection(EVENTS).get()]);
  type Row = { sent: number; clicked: Set<string>; interested: Set<string>; unsubscribed: Set<string> };
  const blank = (): Row => ({ sent: 0, clicked: new Set(), interested: new Set(), unsubscribed: new Set() });
  const byDesign: Record<string, Row> = {};
  const byArea: Record<string, Row> = {};
  const row = (m: Record<string, Row>, k: string) => (m[k] ||= blank());
  // Records written before verticals existed have none and count as automotive.
  prospects.forEach((d) => {
    const p = d.data() as Prospect;
    if (asVertical(p.vertical) !== vertical) return;
    row(byDesign, p.design).sent++;
    row(byArea, p.area || "unknown").sent++;
  });
  events.forEach((d) => {
    const e = d.data() as { slug: string; design: string; area: string | null; type: string; vertical?: string };
    if (asVertical(e.vertical) !== vertical) return;
    const key = e.type === "click" ? "clicked" : e.type === "interested" ? "interested" : "unsubscribed";
    row(byDesign, e.design)[key].add(e.slug);
    row(byArea, e.area || "unknown")[key].add(e.slug);
  });
  const flat = (m: Record<string, Row>) =>
    Object.fromEntries(
      Object.entries(m).map(([k, r]) => [
        k,
        {
          sent: r.sent,
          clicked: r.clicked.size,
          interested: r.interested.size,
          unsubscribed: r.unsubscribed.size,
          interestRate: r.sent ? r.interested.size / r.sent : 0,
        },
      ])
    );
  res.json({ byDesign: flat(byDesign), byArea: flat(byArea) });
}

export async function handleOutreachRequest(req: Request, res: Response): Promise<void> {
  try {
    if (req.method === "GET") {
      if (req.query.action === "stats") {
        if (!isAgent(req)) {
          res.status(403).json({ error: "forbidden" });
          return;
        }
        await stats(res, asVertical(req.query.vertical));
        return;
      }
      const p = await getProspect(req.query.s);
      if (!p) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      if (p.status === "sent") {
        await getFirestore().collection(PROSPECTS).doc(p.slug).update({ status: "clicked" });
        await logEvent(p, "click");
      }
      res.json({
        name: p.name,
        design: p.design,
        vertical: asVertical(p.vertical),
        city: p.city ?? null,
        estimate: p.estimate ?? null,
        imageUrl: p.imageUrl ?? null,
        phone: p.phone ? formatPhone(p.phone) : "",
      });
      return;
    }

    if (req.method !== "POST") {
      res.status(405).end();
      return;
    }

    const body = (typeof req.body === "object" && req.body) || {};
    if (body.action === "register") {
      if (!isAgent(req)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      await register(body, res);
      return;
    }

    const p = await getProspect(body.s);
    if (!p) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    if (body.action === "unsubscribe") {
      await getFirestore().collection(SUPPRESSION).doc(p.slug).set({
        slug: p.slug,
        name: p.name,
        email: p.email ?? null,
        at: FieldValue.serverTimestamp(),
      });
      if (p.status !== "unsubscribed") {
        await getFirestore().collection(PROSPECTS).doc(p.slug).update({ status: "unsubscribed" });
        await logEvent(p, "unsubscribe");
      }
      res.json({ ok: true });
      return;
    }

    const phone = cleanPhone(body.phone);
    if (!phone) {
      res.status(400).json({ error: "invalid_phone" });
      return;
    }
    const alreadyInterested = p.status === "interested";
    await getFirestore().collection(PROSPECTS).doc(p.slug).update({
      status: "interested",
      leadPhone: phone,
      interestedAt: FieldValue.serverTimestamp(),
    });
    if (!alreadyInterested) {
      await logEvent(p, "interested", { phone });
      await notifyLead(p, phone);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("outreach error", err);
    res.status(500).json({ error: "server_error" });
  }
}
