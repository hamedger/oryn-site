import { randomUUID } from "crypto";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import { Resend } from "resend";

// Outreach response tracking for the automotive outreach agent.
//
// Public (called from orynsolutions.io/go/):
//   GET  ?s=<slug>                         -> shop name, concept image, prefilled phone; logs a click
//   POST {s, phone}                        -> "Call me" lead; emails info@
//   POST {s, action: "unsubscribe"}        -> adds the shop to the suppression list
//
// Agent only (header x-agent-key must equal OUTREACH_AGENT_KEY):
//   POST {action: "register", prospect}    -> creates/updates a prospect, uploads its concept image
//   GET  ?action=stats                     -> totals per design and per area for the daily report

const DESIGNS = ["A", "B", "C", "D", "E"] as const;
type Design = (typeof DESIGNS)[number];

const PROSPECTS = "outreachProspects";
const EVENTS = "outreachEvents";
const SUPPRESSION = "outreachSuppression";

interface Prospect {
  slug: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  area?: string | null;
  design: Design;
  reason?: "no_website" | "outdated_website";
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
  await new Resend(key).emails.send({
    from,
    to,
    subject: `New lead: ${p.name} wants a call`,
    html: `
      <p><b>${name}</b>${where ? ` (${where})` : ""} tapped "Call me" on their concept page.</p>
      <p style="font-size:20px"><b>Call ${formatPhone(phone)}</b></p>
      <p>Design they saw: <b>${p.design}</b><br/>
      Why we reached out: ${p.reason === "outdated_website" ? "outdated website" : "no website"}<br/>
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
    reason: p.reason === "outdated_website" ? "outdated_website" : "no_website",
    imageUrl,
    status: "sent",
    sentAt: FieldValue.serverTimestamp() as unknown as FirebaseFirestore.Timestamp,
  };
  await getFirestore().collection(PROSPECTS).doc(p.slug).set(doc, { merge: true });
  res.json({ ok: true, slug: p.slug, imageUrl });
}

async function stats(res: Response): Promise<void> {
  const db = getFirestore();
  const [prospects, events] = await Promise.all([db.collection(PROSPECTS).get(), db.collection(EVENTS).get()]);
  type Row = { sent: number; clicked: Set<string>; interested: Set<string>; unsubscribed: Set<string> };
  const blank = (): Row => ({ sent: 0, clicked: new Set(), interested: new Set(), unsubscribed: new Set() });
  const byDesign: Record<string, Row> = {};
  const byArea: Record<string, Row> = {};
  const row = (m: Record<string, Row>, k: string) => (m[k] ||= blank());
  prospects.forEach((d) => {
    const p = d.data() as Prospect;
    row(byDesign, p.design).sent++;
    row(byArea, p.area || "unknown").sent++;
  });
  events.forEach((d) => {
    const e = d.data() as { slug: string; design: string; area: string | null; type: string };
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
        await stats(res);
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
      res.json({ name: p.name, design: p.design, imageUrl: p.imageUrl ?? null, phone: p.phone ? formatPhone(p.phone) : "" });
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
