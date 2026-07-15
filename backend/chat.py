"""
Kurinda chatbot - Gemini-backed assistant for CHW Supervisors.

Grounded in two things only: (1) the real sector risk data for the
supervisor's own district, and (2) a small curated set of standard IYCF
(Infant and Young Child Feeding) guidance. Deliberately narrow scope - no
general medical advice, no off-topic chat - enforced via the system prompt,
since Kurinda is a screening/coordination tool, not a clinical one.
"""
import os
import time
from typing import Optional

import requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)


class GeminiQuotaExceeded(RuntimeError):
    """Raised specifically for HTTP 429 (RESOURCE_EXHAUSTED). On the free
    tier this is a hard daily request cap, not a transient blip - retrying
    within the same day cannot succeed, so this is deliberately NOT retried
    like the 503 case below, and main.py maps it to a distinct, honest
    client-facing message instead of the generic "try again" one."""

# Standard, publicly-known WHO/UNICEF Infant and Young Child Feeding (IYCF)
# guidance - curated as a short reference the bot can draw from, not sourced
# from a specific ministry document.
IYCF_GUIDANCE = """
- Exclusive breastfeeding for the first 6 months of life; no other food or water needed.
- Continue breastfeeding up to 2 years or beyond, alongside complementary foods.
- Start complementary feeding at 6 months with diverse, energy- and nutrient-dense foods.
  Aim for minimum dietary diversity: foods from at least 4 of these groups daily - grains/roots/tubers,
  legumes/nuts, dairy, meat/fish/poultry, eggs, vitamin-A rich fruits/vegetables, other fruits/vegetables.
- Meal frequency by age: 2-3 meals/day at 6-8 months, 3-4 meals/day at 9-23 months, plus 1-2 snacks.
- Practice responsive feeding: patient, encouraging, no force-feeding, feed slowly and attentively.
- Hygiene: handwashing with soap before feeding/food prep, safe water, clean utensils and storage.
- Danger signs requiring immediate referral to a health facility: visible severe wasting, swelling of
  both feet (oedema), persistent diarrhoea or vomiting, refusal to eat or drink, lethargy or
  unresponsiveness, fever, convulsions.
""".strip()

SYSTEM_PROMPT_TEMPLATE = """You are Kurinda's assistant for a Community Health Worker Supervisor in {district} District, Rwanda. Kurinda is a machine-learning early-warning system for chronic childhood stunting risk.

You may ONLY do two things:
1. Answer questions about Kurinda's own stunting-risk data for sectors in {district} District, using ONLY the data listed below. Do not invent numbers or sectors not listed.
2. Give general Infant and Young Child Feeding (IYCF) guidance, using ONLY the reference material below, when asked how to advise a caregiver.

You must NOT:
- Give a medical diagnosis, prescribe treatment, or advise on anything beyond the general guidance provided. For anything medical, urgent, or outside this scope, tell the user to refer the household to their nearest health facility.
- Answer questions unrelated to child nutrition, stunting risk, or this district's data (no general chat, no unrelated topics, no requests to act as a different kind of assistant).
- Claim certainty the underlying model doesn't have: this is a screening tool (test AUC 0.70), not a diagnosis - predicted sectors carry real uncertainty.

Reply in the same language the user writes in (English or Kinyarwanda). Keep answers short and practical for a supervisor in the field.

--- Sector data for {district} District (source: Kurinda /sectors) ---
{sector_data}

--- Recent interventions logged in {district} District ---
{intervention_data}

--- General IYCF guidance reference (WHO/UNICEF, publicly known) ---
{iycf_guidance}
"""


def format_sector_context(sectors: list[dict]) -> str:
    if not sectors:
        return "(no sector data available)"
    lines = []
    for s in sorted(sectors, key=lambda x: x.get("risk_value") or 0, reverse=True):
        pct = s.get("risk_value")
        pct_str = f"{pct * 100:.1f}%" if pct is not None else "n/a"
        source = "measured (DHS)" if s.get("source") == "dhs_measurement_2019_20" else "predicted"
        drivers = ", ".join(
            d for d in [s.get("risk_driver_1"), s.get("risk_driver_2"), s.get("risk_driver_3")] if d
        )
        line = f"- {s.get('NAME_3')}: {pct_str} risk, {source}"
        if drivers:
            line += f", top drivers: {drivers}"
        if s.get("protective_factor"):
            line += f", protective factor: {s['protective_factor']}"
        lines.append(line)
    return "\n".join(lines)


def format_intervention_context(interventions: list[dict]) -> str:
    if not interventions:
        return "(no interventions logged yet)"
    lines = []
    for i in interventions[:20]:
        note = f" - {i['note']}" if i.get("note") else ""
        created = str(i.get("created_at", ""))[:10]
        lines.append(f"- {i.get('sector')}: {created} by {i.get('logged_by_name')}{note}")
    return "\n".join(lines)


def ask_gemini(
    district: str,
    sectors: list[dict],
    interventions: list[dict],
    message: str,
    history: Optional[list[dict]] = None,
) -> str:
    """Call Gemini with a system prompt grounded in real district data.
    Raises RuntimeError if not configured or the call fails."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        district=district,
        sector_data=format_sector_context(sectors),
        intervention_data=format_intervention_context(interventions),
        iycf_guidance=IYCF_GUIDANCE,
    )

    # Bound history/message length so one bad turn can't blow the token budget.
    contents = []
    for turn in (history or [])[-10:]:
        role = "model" if turn.get("role") == "model" else "user"
        text = str(turn.get("text", ""))[:2000]
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": message[:2000]}]})

    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 800,
            # gemini-flash-latest is a "thinking" model - hidden reasoning
            # tokens count against maxOutputTokens and can eat the whole
            # budget before the visible answer is written, truncating it.
            # This is quick grounded Q&A, not multi-step reasoning, so
            # thinking is switched off rather than just raising the cap.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }

    # Gemini's free tier returns a transient 503 ("high demand") fairly
    # often - real, not a bug here - so retry a couple of times with a
    # short backoff before giving up, rather than failing a demo on the
    # first blip.
    #
    # IMPORTANT: the API key is passed as a URL query param, so
    # requests/urllib3 exception messages (and even the plain Response
    # object) can embed the full request URL including that key. Nothing
    # derived from the request/response is ever put into a raised message
    # here - only fixed, hand-written text - so a client-facing error can
    # never leak the key. Full details go to server logs instead.
    last_status: Optional[int] = None
    for attempt in range(3):
        try:
            resp = requests.post(GEMINI_URL, params={"key": GEMINI_API_KEY}, json=payload, timeout=30)
        except requests.RequestException:
            print("Kurinda chat: network error calling Gemini (attempt", attempt + 1, ")")
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError("Gemini request failed: network error")

        if resp.status_code == 503:
            last_status = 503
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError("Gemini is temporarily overloaded, please try again")

        if resp.status_code == 429:
            print("Kurinda chat: Gemini quota exceeded:", resp.text[:500])
            raise GeminiQuotaExceeded("Gemini request quota exceeded")

        if not resp.ok:
            print("Kurinda chat: Gemini returned", resp.status_code, resp.text[:500])
            raise RuntimeError(f"Gemini request failed (HTTP {resp.status_code})")

        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except (KeyError, IndexError):
            print("Kurinda chat: unexpected Gemini response shape:", data)
            raise RuntimeError("Gemini returned an unexpected response")

    raise RuntimeError(f"Gemini unavailable after retries (last status {last_status})")
