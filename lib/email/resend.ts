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
export async function sendEmail(params: Parameters<Resend["emails"]["send"]>[0]): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn("[resend] RESEND_API_KEY not set — skipping email to", params.to);
    return false;
  }
  try {
    const { data, error } = await getResend().emails.send(params);
    if (error) {
      console.error("[resend] send failed:", error);
      return false;
    }
    console.log("[resend] sent id:", data?.id, "to:", params.to);
    return true;
  } catch (err) {
    console.error("[resend] exception:", err);
    return false;
  }
}
