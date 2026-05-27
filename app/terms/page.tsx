import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Rouxte",
  description:
    "The rules for using Rouxte — for dealers, sales reps, managers, and anyone signing in.",
};

const LAST_UPDATED = "May 2026";

export default function TermsOfServicePage() {
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
        <h1>Terms of Service</h1>
        <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p>
          Welcome to Rouxte. These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of the Rouxte web app, mobile apps, and related services (collectively, the
          &ldquo;Service&rdquo;). By creating an account or otherwise using the Service, you agree
          to these Terms. If you are using Rouxte on behalf of a dealer organization, you confirm
          you have authority to bind that organization.
        </p>

        <h2>1. The Service</h2>
        <p>
          Rouxte is software for door-to-door telecom sales teams. The Service includes lead
          mapping, sales activity logging, training, AI coaching, quote generation, manager review
          tools, and related features. We may add, change, or remove features at any time.
        </p>

        <h2>2. Accounts</h2>
        <ul>
          <li>
            You must provide accurate registration information and keep it current.
          </li>
          <li>
            You are responsible for keeping your credentials secure and for all activity under your
            account.
          </li>
          <li>
            You must be at least 18 years old. Rouxte is not intended for minors.
          </li>
          <li>
            Org administrators can manage roles, deactivate users, and access activity logs for
            users in their org.
          </li>
        </ul>

        <h2>3. Subscription, billing, and free trial</h2>
        <ul>
          <li>
            Rouxte is offered on a per-rep monthly subscription. Pricing tiers and what they
            include are described on <Link href="/pricing">/pricing</Link>.
          </li>
          <li>
            New orgs may receive a free trial. Cards are collected at signup but no charge occurs
            during the trial. Cancel before the trial ends and you will not be billed.
          </li>
          <li>
            We bill at the start of each monthly period based on the number of active reps during
            that period. An active rep is one who has logged any activity (door knock, lead update,
            etc.) within the period.
          </li>
          <li>
            If a charge fails, the account enters a 7-day grace period. After 7 days the account
            moves to read-only until billing is restored.
          </li>
          <li>
            Payments are processed by Square. Rouxte does not store raw card numbers.
          </li>
          <li>
            Subscriptions auto-renew until canceled. You may cancel at any time from the billing
            settings; cancellation takes effect at the end of the current period.
          </li>
          <li>
            All fees are non-refundable except where required by law or where we explicitly agree
            otherwise.
          </li>
        </ul>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use Rouxte to violate any law, including TCPA, Do Not Knock ordinances, and state-specific solicitation laws.</li>
          <li>Send communications to anyone who has not consented or who has opted out.</li>
          <li>Falsify activity, fabricate sales, or misrepresent commissions.</li>
          <li>Attempt to reverse engineer, scrape, or extract data outside the normal Service interface.</li>
          <li>Interfere with the Service, probe for vulnerabilities without our written permission, or impair other users&apos; ability to use it.</li>
          <li>Upload malicious code, illegal content, or content that infringes another&apos;s rights.</li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules, including without notice
          for severe violations.
        </p>

        <h2>5. Your data</h2>
        <ul>
          <li>
            You retain ownership of the data you put into Rouxte (leads, notes, photos, etc.).
          </li>
          <li>
            You grant Rouxte a worldwide, royalty-free license to host, process, transmit, and
            display your data solely to operate the Service for you and your org.
          </li>
          <li>
            On request and subject to legal retention obligations, we will export or delete your
            data. See the <Link href="/privacy">Privacy Policy</Link> for details.
          </li>
          <li>
            You are responsible for collecting any consents required to put a homeowner&apos;s
            information into the Service (phone numbers, names, photos, etc.).
          </li>
        </ul>

        <h2>6. AI features</h2>
        <p>
          Rouxte includes AI-generated content from the AI Coach (&ldquo;Rex&rdquo;). AI outputs may
          be inaccurate, outdated, or inappropriate for a particular situation. Use professional
          judgment before acting on them. Rouxte does not guarantee the accuracy of AI-generated
          content. Lead text sent to our AI provider (Anthropic) is processed under their
          zero-retention terms and is not used to train any public model.
        </p>

        <h2>7. Intellectual property</h2>
        <p>
          Rouxte and all related software, designs, trademarks, and content are owned by Rouxte and
          its licensors and protected by intellectual property law. You receive a limited,
          non-exclusive, non-transferable, revocable license to use the Service per these Terms.
          You may not copy, modify, distribute, sell, or lease any part of the Service without our
          written permission.
        </p>

        <h2>8. Third-party services and integrations</h2>
        <p>
          The Service relies on third-party providers (Supabase, Vercel, Mapbox, Anthropic, Resend,
          Square, Sentry, Daily.co, Printful, FCM, APNs). Their availability and terms apply to
          their portions. We are not responsible for outages or actions of those providers.
        </p>

        <h2>9. Beta features</h2>
        <p>
          We may offer features marked &ldquo;beta,&rdquo; &ldquo;preview,&rdquo; or similar. These
          are provided as-is, may change or be removed without notice, and are excluded from any
          uptime or support commitments.
        </p>

        <h2>10. Disclaimers</h2>
        <p>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
          WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. ROUXTE DOES NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE, OR THAT DATA WILL BE
          ACCURATE OR PRESERVED WITHOUT LOSS. YOU USE THE SERVICE AT YOUR OWN RISK.
        </p>

        <h2>11. Limitation of liability</h2>
        <p>
          TO THE FULLEST EXTENT PERMITTED BY LAW, ROUXTE AND ITS OFFICERS, EMPLOYEES, AND AGENTS
          ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
          OR ANY LOSS OF PROFITS, REVENUE, GOODWILL, OR DATA, ARISING OUT OF OR RELATED TO YOUR USE
          OF THE SERVICE. ROUXTE&apos;S TOTAL LIABILITY FOR ANY CLAIM ARISING FROM OR RELATED TO
          THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID ROUXTE IN THE 12
          MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED U.S. DOLLARS.
        </p>

        <h2>12. Indemnification</h2>
        <p>
          You agree to defend, indemnify, and hold harmless Rouxte from any claim or demand,
          including reasonable attorneys&apos; fees, arising out of your breach of these Terms,
          your violation of any law, your collection or use of any homeowner&apos;s information in
          violation of applicable consent rules, or your infringement of any third-party right.
        </p>

        <h2>13. Termination</h2>
        <p>
          You may close your account at any time. We may suspend or terminate your account for
          breach of these Terms, non-payment, fraud, or to comply with law. On termination, your
          right to use the Service ends; sections that by their nature should survive termination
          (ownership, disclaimers, limitations, indemnification, dispute resolution) survive.
        </p>

        <h2>14. Governing law and disputes</h2>
        <p>
          These Terms are governed by the laws of the State of Texas, without regard to its
          conflict-of-law principles. Any dispute will be resolved in the state or federal courts
          located in Travis County, Texas, and the parties consent to personal jurisdiction there.
          Class actions and class arbitrations are waived to the extent permitted by law.
        </p>

        <h2>15. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. If we make material changes, we will email
          account holders and update the &ldquo;Last updated&rdquo; date above. Continued use of
          the Service after the effective date means you accept the changes.
        </p>

        <h2>16. Contact</h2>
        <p>
          Questions about these Terms:{" "}
          <a href="mailto:support@rouxte.com">support@rouxte.com</a>
          <br />
          Legal notices and DMCA: <a href="mailto:legal@rouxte.com">legal@rouxte.com</a>
        </p>
      </article>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-sm text-gray-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} Rouxte. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
            <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
