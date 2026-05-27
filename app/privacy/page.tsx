import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Rouxte",
  description:
    "How Rouxte collects, uses, and protects data — for sales reps, managers, dealers, and the homeowners they sell to.",
};

const LAST_UPDATED = "May 2026";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Rouxte" className="h-7" />
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Pricing
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 prose prose-gray prose-headings:font-bold prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p>
          Rouxte is a software platform used by door-to-door telecom sales teams to manage leads,
          appointments, training, and commissions. This Privacy Policy explains what information
          Rouxte (&ldquo;we&rdquo;, &ldquo;us&rdquo;) collects through the Rouxte web app and mobile
          apps, how we use it, and the choices you have. By using Rouxte you agree to the practices
          described here.
        </p>

        <h2>1. Who this policy covers</h2>
        <ul>
          <li>
            <strong>Sales reps, managers, and admins</strong> who sign in to Rouxte through their
            dealer organization (the &ldquo;Org&rdquo;).
          </li>
          <li>
            <strong>Homeowners and prospects</strong> whose information is entered into Rouxte by a
            sales rep after a door interaction, an opt-in form, or a similar contact.
          </li>
        </ul>
        <p>
          If a sales rep enters your information into Rouxte without your knowledge and you want it
          removed, contact us at <a href="mailto:privacy@rouxte.com">privacy@rouxte.com</a> or use
          the public opt-out link the rep should have provided.
        </p>

        <h2>2. Information we collect</h2>
        <h3>2.1 From sales reps and managers</h3>
        <ul>
          <li>Account info: name, email, phone, role, profile photo, employer org</li>
          <li>Auth identifiers from sign-in providers (Google, GitHub, Apple)</li>
          <li>Location data while the mobile app is open in field mode (last-seen position)</li>
          <li>Activity: doors knocked, leads captured, notes, status changes, sales submitted</li>
          <li>Device + diagnostic info (crash reports via Sentry, OS version, app version)</li>
          <li>Photos you upload to a lead (no-solicit signs, install photos, etc.)</li>
        </ul>
        <h3>2.2 From homeowners and prospects</h3>
        <ul>
          <li>Property address, approximate location, AT&amp;T fiber availability at that address</li>
          <li>Optional: name, phone, email — captured by the rep during the conversation</li>
          <li>Notes the rep writes about the conversation</li>
          <li>Sale, quote, or appointment details if a deal is created</li>
          <li>If you submit a SmartPitch lead form yourself: the answers you provided</li>
        </ul>
        <h3>2.3 Automatically</h3>
        <ul>
          <li>Standard server logs (IP, user agent, request path) for security + abuse prevention</li>
          <li>Cookies for authentication and short-lived session state</li>
        </ul>

        <h2>3. How we use information</h2>
        <ul>
          <li>To provide the Rouxte service: show your assigned leads on a map, log your activity, compute commissions, route your sales for manager review.</li>
          <li>To enable team and manager visibility — your dealer org sees your activity by design.</li>
          <li>To compute fiber and wireless availability quotes against carrier coverage data.</li>
          <li>To prevent abuse, debug crashes, and improve product quality.</li>
          <li>To send transactional email (sign-in, billing receipts, sale confirmations) via Resend.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell personal information. We do not use your data to train any
          public AI model. Lead text sent to Anthropic for AI Coach responses is processed under
          Anthropic&apos;s zero-retention terms.
        </p>

        <h2>4. Who we share information with</h2>
        <p>We share data only with the service providers that operate Rouxte:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication, file storage. Hosts the canonical
            copy of your account and lead data.
          </li>
          <li>
            <strong>Vercel</strong> — hosting for the rouxte.com web app and the API.
          </li>
          <li>
            <strong>Mapbox</strong> — map tiles and address geocoding for the lead map.
          </li>
          <li>
            <strong>Anthropic</strong> — AI Coach responses. Lead text sent for coaching is not
            retained by Anthropic and not used for model training.
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery.
          </li>
          <li>
            <strong>Square</strong> — payment processing for org subscriptions and store orders.
            Card numbers are tokenized by Square; Rouxte never stores raw card data.
          </li>
          <li>
            <strong>Sentry</strong> — crash reporting in the mobile apps. Crash payloads may include
            screen names, breadcrumbs, and device info but not lead PII.
          </li>
          <li>
            <strong>Printful</strong> — fulfillment of physical store items (badges, swag).
          </li>
          <li>
            <strong>Daily.co</strong> — in-app video meetings.
          </li>
          <li>
            <strong>Google Firebase Cloud Messaging</strong> and <strong>Apple Push Notification
            Service</strong> — push notifications on Android and iOS respectively.
          </li>
        </ul>
        <p>
          Your dealer org administrators can see all activity by reps in their org. Sales managers
          can view rep-level metrics. This is a core feature of the product, not a third-party
          disclosure.
        </p>
        <p>
          We may disclose information if required by law, valid legal process, or to protect rights,
          property, or safety.
        </p>

        <h2>5. Data retention</h2>
        <ul>
          <li>Account data is retained while your account is active.</li>
          <li>Lead activity logs are append-only and retained for the life of the org for compliance and dispute resolution.</li>
          <li>Crash reports are retained for 90 days.</li>
          <li>Server logs are retained for 30 days.</li>
          <li>On account deletion request, we delete your profile and personal identifiers within 30 days, except for records we are legally required to retain (commission and tax records).</li>
        </ul>

        <h2>6. Your choices and rights</h2>
        <ul>
          <li>
            <strong>Access, correction, deletion:</strong> contact{" "}
            <a href="mailto:privacy@rouxte.com">privacy@rouxte.com</a>. We respond within 30 days.
          </li>
          <li>
            <strong>Homeowner opt-out:</strong> Rouxte includes a public opt-out link for any
            captured address (the rep should have given you a card or QR code). You can also email
            us with the address you want excluded.
          </li>
          <li>
            <strong>Do Not Knock list:</strong> sales reps mark addresses as do-not-knock through
            the app; that flag is permanent for the org.
          </li>
          <li>
            <strong>Push notifications:</strong> manage on your device.
          </li>
          <li>
            <strong>Location:</strong> revoke at the OS level (iOS Settings &rarr; Rouxte &rarr;
            Location, or Android Settings &rarr; Apps &rarr; Rouxte &rarr; Permissions). The app
            works with location off, but field-mode features become limited.
          </li>
          <li>
            <strong>California (CCPA/CPRA), EU (GDPR), and similar laws:</strong> you have the
            rights described above by default; we treat all users to the same standard.
          </li>
        </ul>

        <h2>7. Security</h2>
        <p>
          We use TLS for data in transit and at-rest encryption provided by Supabase and Vercel. We
          enforce role-based access via Postgres row-level security. We do not store card numbers.
          No system is perfectly secure; please report security issues to{" "}
          <a href="mailto:security@rouxte.com">security@rouxte.com</a>.
        </p>

        <h2>8. Children</h2>
        <p>
          Rouxte is intended for adults only — sales reps, managers, dealers, and homeowners.
          Rouxte does not knowingly collect information from children under 13 (or 16 in
          jurisdictions where that threshold applies). If you believe a child&apos;s information is
          in our system, email <a href="mailto:privacy@rouxte.com">privacy@rouxte.com</a> and we
          will delete it.
        </p>

        <h2>9. International transfers</h2>
        <p>
          Rouxte is operated from the United States. If you use Rouxte from outside the U.S., your
          information will be transferred to and processed in the U.S. and other countries where our
          service providers operate.
        </p>

        <h2>10. Changes to this policy</h2>
        <p>
          If we make material changes, we will email account holders and update the &ldquo;Last
          updated&rdquo; date above. Continued use of Rouxte after changes means you accept the
          updated policy.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href="mailto:privacy@rouxte.com">privacy@rouxte.com</a>
          <br />
          Security disclosures: <a href="mailto:security@rouxte.com">security@rouxte.com</a>
          <br />
          Support: <a href="mailto:support@rouxte.com">support@rouxte.com</a>
        </p>
      </article>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-sm text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Rouxte. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-gray-700">Terms</Link>
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
