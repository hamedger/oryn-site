export function buildSigningSmsMessage(clientName: string, signingUrl: string): string {
  const name = clientName.trim() || "there";
  return `Hi ${name}, please review and sign your Oryn service agreement on your phone: ${signingUrl}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
