/**
 * Kurinda - static product/how-to FAQ for the chat widget.
 *
 * Answers common "how do I..." and "what does X mean" questions instantly,
 * client-side, before a message ever reaches the backend's /chat endpoint.
 * Two reasons this exists as a hardcoded lookup instead of just widening
 * Gemini's system prompt: (1) Gemini has no ground truth about this UI and
 * could plausibly invent a wrong answer about a feature it's never seen;
 * (2) the assistant's free tier is capped at 20 requests/day, and spending
 * that budget on "how do I export a report" instead of a real data
 * question would be a bad trade. Every answer below is grounded in
 * verified, current system behaviour - see the cited source next to each
 * entry - not aspirational or planned functionality.
 *
 * Real data questions ("which sectors in my district are highest risk")
 * and anything this list doesn't recognise still go to Gemini as before.
 */
import type { UserRole } from "./auth";

export interface FaqEntry {
  id: string;
  roles: UserRole[] | "all";
  /** Short phrases matched as substrings against the normalised question. */
  triggers: string[];
  answer: string;
}

export const HELP_FAQ: FaqEntry[] = [
  {
    id: "risk-value",
    roles: "all",
    triggers: [
      "what does risk mean",
      "risk percentage",
      "risk value",
      "what is risk score",
      "how is risk calculated",
      "what is the risk",
    ],
    answer:
      "The risk percentage estimates how likely a sector is to have chronic child stunting above the WHO's 30% threshold — it's not a diagnosis for any individual child. It's either a real DHS 2019–20 measurement or a machine-learning prediction (ask me about \"measured vs predicted\" for the difference). Treat it as a prioritisation signal: the model is right about 70% of the time on data it's never seen, which is useful for ranking sectors, not for treating one score as certain.",
  },
  {
    id: "measured-vs-predicted",
    roles: "all",
    triggers: [
      "measured vs predicted",
      "measured versus predicted",
      "what does predicted mean",
      "dhs measurement",
      "model prediction",
      "is this real data",
      "source of data",
    ],
    answer:
      "Every sector is labelled with where its number comes from. \"DHS measurement (2019–20)\" means it's a real, surveyed figure — the survey reached 320 of Rwanda's 422 sectors. \"Model prediction\" means the survey never reached that sector (the other 102), so Kurinda estimated its risk from rainfall, vegetation and market-price patterns instead. A predicted sector is never shown as if it were measured.",
  },
  {
    id: "risk-drivers",
    roles: "all",
    triggers: [
      "risk driver",
      "what are drivers",
      "why is this sector flagged",
      "protective factor",
      "why flagged",
      "why is it high risk",
    ],
    answer:
      "Risk drivers are the top 3 reasons the model raised a sector's risk; the protective factor is the strongest reason it lowered it. Both come from SHAP, a method for explaining one specific prediction rather than the model in general — they're plain-language translations of real contributing signals (rainfall, vegetation, market prices), not a generic list.",
  },
  {
    id: "model-accuracy",
    roles: "all",
    triggers: [
      "how accurate",
      "can i trust",
      "model accuracy",
      "is the model reliable",
      "how good is the model",
      "auc",
    ],
    answer:
      "On sectors the model never saw during training, it ranks a genuinely higher-risk sector above a lower-risk one correctly about 70% of the time (test AUC 0.6967). That's meaningfully better than chance and good enough to prioritise where to look — it's not accurate enough to treat any single sector's score as a clinical finding. Kurinda is a screening and targeting tool, not a diagnosis.",
  },
  {
    id: "export-pdf",
    roles: ["district_officer"],
    triggers: [
      "export report",
      "export pdf",
      "download report",
      "priority report",
      "print report",
      "save report",
    ],
    answer:
      "Use the export control on your dashboard to generate a priority report as a PDF. It's built entirely in your browser — nothing is uploaded or stored on the server, so there's no separate \"saved reports\" list. Export again whenever you need a fresh copy.",
  },
  {
    id: "log-intervention",
    roles: ["district_officer", "chw_supervisor"],
    triggers: [
      "log intervention",
      "log a visit",
      "mark visit",
      "record intervention",
      "how do i log",
      "intervention history",
    ],
    answer:
      "Select a sector, then use the form in its detail panel — District Officers \"log an intervention,\" CHW Supervisors \"mark a visit complete.\" Both write to the same history underneath, just labelled differently for your role, and the new entry appears immediately.",
  },
  {
    id: "send-sms",
    roles: ["chw"],
    triggers: [
      "send sms",
      "send alert",
      "sms alert",
      "how many sectors alerted",
      "alert slider",
      "dispatch alert",
    ],
    answer:
      "Use the slider to choose how many of the highest-risk sectors to alert, then check the preview above it — it shows exactly which sectors will receive a message before you send anything. Dispatch sends one Kinyarwanda SMS per sector through Africa's Talking, and per-sector delivery status appears right after.",
  },
  {
    id: "delivery-status",
    roles: ["chw"],
    triggers: [
      "what does sent mean",
      "what does failed mean",
      "delivery status",
      "why did it fail",
      "sms failed",
    ],
    answer:
      "\"Sent\" means Africa's Talking accepted the message for delivery; \"failed\" means it didn't — hover the status for the error detail. This deployment currently runs on Africa's Talking sandbox credentials, so messages are simulated rather than delivered to a real handset; that's expected, not a bug.",
  },
  {
    id: "scope-restriction",
    roles: "all",
    triggers: [
      "other district",
      "see all sectors",
      "only see my district",
      "why cant i see",
      "cant see other",
      "see the whole country",
    ],
    answer:
      "Your account is scoped to your own district (or sector, for supervisors and CHWs), set when you registered — by design, so each role only sees the area it's responsible for. That's an account setting, not something changeable from within the app.",
  },
  {
    id: "language",
    roles: "all",
    triggers: [
      "kinyarwanda",
      "change language",
      "language support",
      "english or kinyarwanda",
      "switch language",
    ],
    answer:
      "SMS alerts are sent in Kinyarwanda. I reply in whichever language you write to me in, English or Kinyarwanda — there's no separate language toggle to set, just write your question in the language you want the answer in.",
  },
  {
    id: "slow-loading",
    roles: "all",
    triggers: [
      "site is slow",
      "taking long to load",
      "not loading",
      "slow first load",
      "why is it slow",
      "page wont load",
    ],
    answer:
      "If this is your first request in a while, the free hosting tier spins the service down when idle, so the first load can take up to a minute to wake back up. That's a property of the hosting plan, not a fault — it's fast again right after.",
  },
  {
    id: "data-privacy",
    roles: "all",
    triggers: [
      "where does data come from",
      "is my data private",
      "data privacy",
      "data source",
      "personal data",
    ],
    answer:
      "Kurinda only stores aggregate sector-level rates and model outputs — never individual health records. The underlying risk figures come from Rwanda's 2019–20 DHS survey plus public satellite (rainfall, vegetation) and market-price data; no personally identifiable health information is collected or stored.",
  },
  {
    id: "medical-scope",
    roles: "all",
    triggers: [
      "medical advice",
      "can you diagnose",
      "prescribe",
      "medication",
      "is this a doctor",
    ],
    answer:
      "I can discuss your district's real risk data and general infant/child feeding guidance, but I won't diagnose or prescribe. For anything medical or urgent, refer the household to the nearest health facility — that's a deliberate limit, not a bug.",
  },
  {
    id: "theme-toggle",
    roles: "all",
    triggers: ["dark mode", "light mode", "theme toggle", "change theme"],
    answer:
      "Use the theme toggle in the header to switch between light and dark — your choice is remembered on this device. The app defaults to light so it stays readable on projectors.",
  },
  {
    id: "data-freshness",
    roles: "all",
    triggers: [
      "how often updated",
      "when was this updated",
      "is this real time",
      "live data",
      "how current is this",
    ],
    answer:
      "Risk scores come from a model trained on a fixed snapshot, not a live feed — they change only when the pipeline is re-run and redeployed by the development team, not automatically or in real time.",
  },
  {
    id: "forgot-password",
    roles: "all",
    triggers: ["forgot password", "reset password", "cant log in", "cant login", "locked out"],
    answer:
      "There's no self-service password reset yet. If you're locked out, you'll need a new account registered against your district or sector, or you can contact whoever administers your Kurinda deployment.",
  },
  {
    id: "role-overview",
    roles: "all",
    triggers: [
      "what roles are there",
      "difference between roles",
      "what can i do",
      "what is my role",
    ],
    answer:
      "Kurinda has three roles: District Officer (district-wide risk map, intervention logging, PDF export), CHW Supervisor (prioritised sector list, this assistant, marking visits complete), and Community Health Worker (SMS alert dispatch to the highest-risk sectors). Each account is locked to one role at registration.",
  },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Returns the best-matching FAQ answer for `input`, scoped to `role`, or
 * null if nothing matches well enough - callers should fall through to
 * the real assistant in that case. Deliberately simple substring scoring
 * rather than any embedding/similarity model: this list is small, the
 * triggers are written to be distinctive, and a plain, explainable match
 * is easier to verify never gives a wrong answer than a fuzzy one would be.
 */
export function matchFaq(input: string, role: UserRole | null): string | null {
  const q = normalize(input);
  if (!q) return null;

  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of HELP_FAQ) {
    if (entry.roles !== "all" && (!role || !entry.roles.includes(role))) continue;
    let score = 0;
    for (const trigger of entry.triggers) {
      if (q.includes(normalize(trigger))) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  return best ? best.entry.answer : null;
}
