import { Resend } from "resend";

export const FROM = process.env.RESEND_FROM ?? "Rouxte <noreply@rouxte.app>";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder");
  }
  return _resend;
}

// Convenience wrapper — silently skips if no API key configured
export async function sendEmail(params: Parameters<Resend["emails"]["send"]>[0]): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  await getResend().emails.send(params).catch(() => {});
}
