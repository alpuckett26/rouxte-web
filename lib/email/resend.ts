import { Resend } from "resend";

export const FROM = process.env.RESEND_FROM ?? "Rouxte <noreply@rouxte.app>";

let _resend: Resend | null = null;

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY ?? "placeholder");
  }
  return _resend;
}

// Returns true if the email was sent successfully, false otherwise.
// Silently skips (returns false) when RESEND_API_KEY is not configured.
export async function sendEmail(params: Parameters<Resend["emails"]["send"]>[0]): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const { error } = await getResend().emails.send(params);
    return !error;
  } catch {
    return false;
  }
}
