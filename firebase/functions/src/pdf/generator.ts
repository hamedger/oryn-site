import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getStorage } from "firebase-admin/storage";

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let remaining = para;
    while (remaining.length > maxChars) {
      let breakAt = remaining.lastIndexOf(" ", maxChars);
      if (breakAt <= 0) breakAt = maxChars;
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

async function buildPdfPages(
  pdfDoc: PDFDocument,
  sections: string[],
  footer?: string
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 12;
  const maxWidth = pageWidth - margin * 2;
  const charsPerLine = Math.floor(maxWidth / 6.5);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addLine = (line: string, isBold = false) => {
    if (y < margin + (footer ? 40 : 20)) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    page.drawText(line, {
      x: margin,
      y,
      size: 10,
      font: isBold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
      maxWidth,
    });
    y -= lineHeight;
  };

  for (const section of sections) {
    const lines = wrapText(section, charsPerLine);
    for (const line of lines) {
      const isBold = line === "SERVICE AGREEMENT" || /^\d+\./.test(line);
      addLine(line, isBold);
    }
    y -= 6;
  }

  if (footer) {
    const footerLines = wrapText(footer, charsPerLine);
    for (const line of footerLines) {
      addLine(line);
    }
  }
}

export async function generateUnsignedPdf(
  contractId: string,
  contractText: string
): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  await buildPdfPages(pdfDoc, [contractText]);
  const bytes = await pdfDoc.save();

  const path = `contracts/unsigned/${contractId}.pdf`;
  const bucket = getStorage().bucket();
  const file = bucket.file(path);
  await file.save(Buffer.from(bytes), {
    contentType: "application/pdf",
    metadata: { contractId, type: "unsigned" },
  });

  return path;
}

export async function generateSignedPdf(params: {
  contractId: string;
  contractText: string;
  signerName: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  signaturePngBuffer: Buffer;
}): Promise<{ pdfPath: string; signaturePath: string }> {
  const signaturePath = `contracts/signatures/${params.contractId}.png`;
  const bucket = getStorage().bucket();

  await bucket.file(signaturePath).save(params.signaturePngBuffer, {
    contentType: "image/png",
    metadata: { contractId: params.contractId },
  });

  const signedDate = params.signedAt.toLocaleString("en-US", {
    timeZone: "America/Detroit",
    dateStyle: "long",
    timeStyle: "short",
  });

  const contractWithSig = params.contractText
    .replace(/Client: _+/g, `Client: ${params.signerName}`)
    .replace(/Date: _+/g, `Date: ${signedDate}`);

  const auditFooter = [
    "",
    "--- ELECTRONIC ACCEPTANCE RECORD ---",
    `Contract ID: ${params.contractId}`,
    `Signed by: ${params.signerName}`,
    `Signed at: ${signedDate}`,
    `IP Address: ${params.ipAddress}`,
    `User Agent: ${params.userAgent}`,
    "Electronically accepted through orynsolutions.io.",
  ].join("\n");

  const pdfDoc = await PDFDocument.create();
  await buildPdfPages(pdfDoc, [contractWithSig], auditFooter);

  // Embed signature image on last page
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  try {
    const sigImage = await pdfDoc.embedPng(params.signaturePngBuffer);
    const sigDims = sigImage.scale(0.35);
    lastPage.drawImage(sigImage, {
      x: 50,
      y: 80,
      width: sigDims.width,
      height: sigDims.height,
    });
  } catch {
    // PNG embed may fail for some canvas exports; audit footer still records acceptance
  }

  const bytes = await pdfDoc.save();
  const pdfPath = `contracts/signed/${params.contractId}.pdf`;
  const file = bucket.file(pdfPath);

  // Signed PDFs must not be overwritten — check existence first
  const [exists] = await file.exists();
  if (exists) {
    throw new Error("Signed PDF already exists and cannot be overwritten.");
  }

  await file.save(Buffer.from(bytes), {
    contentType: "application/pdf",
    metadata: { contractId: params.contractId, type: "signed" },
  });

  return { pdfPath, signaturePath };
}

export async function getSignedDownloadUrl(
  storagePath: string,
  expiresMinutes = 15
): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresMinutes * 60 * 1000,
  });
  return url;
}
