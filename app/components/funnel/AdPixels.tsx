"use client";

import Script from "next/script";

// Meta Pixel + Google tag for public ad landing pages. Each loads only when its
// env var is set, so pages stay tag-free until the ad accounts exist.
//   NEXT_PUBLIC_META_PIXEL_ID          e.g. 123456789012345
//   NEXT_PUBLIC_GOOGLE_TAG_ID          e.g. AW-123456789 (or G-XXXX)
//   NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO e.g. AW-123456789/AbCdEfGh — the Lead conversion action

const META_PIXEL_ID   = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GOOGLE_TAG_ID   = process.env.NEXT_PUBLIC_GOOGLE_TAG_ID;
const GOOGLE_LEAD_TO  = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO;

type Fbq  = (...args: unknown[]) => void;
type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { fbq?: Fbq; gtag?: Gtag }
}

export default function AdPixels() {
  return (
    <>
      {META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}</Script>
      )}
      {GOOGLE_TAG_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}`} strategy="afterInteractive" />
          <Script id="google-tag" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_TAG_ID}');
          `}</Script>
        </>
      )}
    </>
  );
}

/**
 * Fire the Lead conversion. eventId is the lead id from the server, so a later
 * Meta Conversions API / Google offline upload can dedupe against this event.
 * No personal info is sent to either platform.
 */
export function trackLead(eventId: string) {
  try {
    window.fbq?.("track", "Lead", { content_name: "backup_power" }, { eventID: eventId });
    window.gtag?.("event", "generate_lead", { lead_source: "backup_power" });
    if (GOOGLE_LEAD_TO) window.gtag?.("event", "conversion", { send_to: GOOGLE_LEAD_TO, transaction_id: eventId });
  } catch {
    // Tracking is best-effort — never block the thank-you screen.
  }
}

const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"] as const;

/** UTM tags and ad click ids from the landing URL, saved on the lead for ROI reporting. */
export function readAttribution(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of ATTRIBUTION_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v.slice(0, 200);
    }
    if (document.referrer) out.referrer = document.referrer.slice(0, 200);
  } catch {
    // ignore
  }
  return out;
}
