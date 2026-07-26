/**
 * Kurinda - Privacy Policy & Terms of Use (EULA).
 *
 * Public, unauthenticated page - deliberately not gated by useRequireRole,
 * since a policy page needs to be readable before someone even has an
 * account. Static content (no "use client" needed at the page level); Logo
 * and ThemeToggle are self-contained client components rendered as
 * children, which the App Router allows from a server component.
 *
 * Built for the Ethics in Software Engineering summative's mandatory
 * EULA/Privacy Policy walkthrough requirement, but the content here
 * reflects Kurinda's actual, current data practices - not aspirational
 * ones - so it doubles as a real policy page for the delivered system.
 */
import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

interface SectionProps {
  n: string;
  title: string;
  children: React.ReactNode;
}

function Section({ n, title, children }: SectionProps) {
  return (
    <section className="py-6 border-b border-slate-200 dark:border-slate-800 last:border-b-0">
      <h2 className="text-lg font-semibold mb-2 flex items-baseline gap-2">
        <span className="text-cyan-600 dark:text-cyan-400 font-mono text-sm">{n}</span>
        {title}
      </h2>
      <div className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200 dark:border-slate-900 px-6 sm:px-12 lg:px-24 py-5 flex flex-wrap items-center justify-between gap-y-3">
        <Logo />
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            ← Back to home
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="px-6 sm:px-12 lg:px-24 py-12 max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2 font-mono">
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Privacy Policy &amp; Terms of Use
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Last updated: 25 July 2026. This page describes what Kurinda actually collects,
          how it is used, and who it is shared with — not a generic template.
        </p>

        <Section n="1" title="Introduction">
          <p>
            Kurinda (&quot;the Platform&quot;) is a machine-learning early-warning system
            that estimates chronic childhood stunting risk across Rwanda&apos;s 422
            administrative sectors and delivers that intelligence to district nutrition
            officers and Community Health Workers through a web dashboard, a bilingual
            assistant, and Kinyarwanda SMS alerts. By creating an account or using any
            feature of this Platform, you agree to the terms described in this document.
          </p>
        </Section>

        <Section n="2" title="Data We Collect">
          <p>
            We collect: your name, email address, a securely hashed password, your role
            (District Officer, CHW Supervisor, or Community Health Worker), and your
            assigned district or sector. If you log an intervention or mark a visit
            complete, we store the sector, an optional note, and your identity as the
            logger. If you use the assistant, your message and recent conversation
            history are sent to our AI provider per request (see Section 5) but are not
            stored in our own database. If you dispatch an SMS alert, we log the
            recipient, the sector, the risk value at time of sending, and the delivery
            status.
          </p>
          <p>
            We do <strong>not</strong> collect payment information, precise device
            location, individual health or medical records, or any DHS survey microdata.
            Sector risk figures shown in the app are aggregate statistics or model
            outputs — never records traceable to an individual child or household.
          </p>
        </Section>

        <Section n="3" title="How We Use Your Data">
          <p>
            Your account data is used to authenticate you and to scope what you can see
            and do to your role and geography — a District Officer sees their own
            district; a CHW Supervisor and CHW see their own sector&apos;s district.
            Intervention and alert logs are used to build the history shown in the
            dashboard and to compute alert previews. Assistant queries are sent, per
            request, to Google&apos;s Gemini API, along with your district&apos;s real
            sector risk data and recent intervention notes, so that the assistant&apos;s
            answers are grounded in real figures rather than invented ones.
          </p>
        </Section>

        <Section n="4" title="AI-Assisted Processing">
          <p>
            Kurinda uses two AI/ML components. First, a LightGBM classifier, trained
            offline on 2019–20 DHS data, scores every sector&apos;s stunting risk in a
            batch process — it does not make a live decision about any individual query,
            and its output (a risk percentage plus plain-language drivers) is a
            prioritisation aid, not a diagnosis. Second, a Gemini-based conversational
            assistant answers questions about your district&apos;s real risk data and
            general infant/child feeding guidance.
          </p>
          <p>
            <strong>Neither component decides anything on its own.</strong> The
            assistant is explicitly instructed to refuse medical diagnosis or
            prescription and to direct users to a health facility for anything urgent or
            clinical; a human user always initiates any consequential action, such as
            sending an SMS alert or logging an intervention.
          </p>
        </Section>

        <Section n="5" title="Data Sharing">
          <p>
            We do not sell your data. The following third parties process data as part
            of delivering the service, and only the minimum necessary for their
            function: <strong>Google (Gemini API)</strong> receives your assistant
            query, your district&apos;s aggregate sector data, and recent intervention
            notes, per request, to generate a grounded answer.{" "}
            <strong>Africa&apos;s Talking</strong> receives the recipient number and
            Kinyarwanda message text to dispatch SMS alerts (currently via sandbox
            credentials, not live delivery). <strong>Neon</strong> hosts our PostgreSQL
            database; <strong>Render</strong> hosts our application servers. Internally,
            access is restricted by role: a District Officer cannot see another
            district&apos;s data, and no administrative &quot;view all users&quot;
            capability exists in the delivered system.
          </p>
          <p>
            Several of these processors are located outside Rwanda. Rwanda&apos;s Law
            N° 058/2021 (Articles 48 and 50) requires prior authorisation from the
            National Cyber Security Authority for storing or transferring personal data
            abroad; that authorisation has not yet been obtained for this research
            deployment, and is required before the system processes the personal data
            of any real Rwandan user.
          </p>
        </Section>

        <Section n="6" title="Data Storage & Security">
          <p>
            Passwords are hashed with bcrypt and never stored or logged in plaintext.
            Authentication uses stateless, signed JSON Web Tokens (7-day expiry); there
            is no server-side session table. All API secrets (database credentials, the
            assistant API key, SMS provider credentials) are held in environment
            variables and are never committed to version control. Every endpoint that
            changes data or exposes anything beyond public sector statistics requires a
            valid token and a role check. All traffic is served over HTTPS.
          </p>
        </Section>

        <Section n="7" title="Your Rights">
          <p>
            Under Rwanda&apos;s Law N° 058/2021 on the Protection of Personal Data and
            Privacy, you have the right to access, correct, or request deletion of your
            personal data. Because Kurinda does not currently have a self-service
            account-management page, you can exercise these rights by contacting your
            account administrator, who can correct or remove your account record
            directly.
          </p>
        </Section>

        <Section n="8" title="Terms of Use (EULA)">
          <p>
            Your account is provided for professional use in the role you registered
            under. You agree not to attempt to access data outside your assigned
            district or sector, not to use the SMS alert channel for any purpose other
            than genuine risk-based outreach, and not to rely on the assistant&apos;s
            output as a substitute for clinical judgement or a health facility referral.
            Misuse of any of these may result in account suspension.
          </p>
        </Section>

        <Section n="9" title="Cookies & Local Storage">
          <p>
            Kurinda stores two things in your browser&apos;s local storage: your
            authentication token and user profile (so you stay logged in between
            visits) and your light/dark theme preference. Neither is used for tracking
            or advertising; both exist solely so the app functions correctly across page
            reloads.
          </p>
        </Section>

        <Section n="10" title="Changes to This Policy">
          <p>
            Kurinda does not yet have an in-app notification system for policy changes.
            Material changes to this policy will be reflected here with an updated
            revision note; if you are a registered user with concerns about how a
            change affects you, contact your account administrator.
          </p>
        </Section>

        <Section n="11" title="Contact">
          <p>
            For questions about this policy or your data, contact the project
            administrator via the email on file with your ALU account.
          </p>
        </Section>
      </div>
    </main>
  );
}
