"use client";

/**
 * Kurinda - floating chat assistant widget, available on all three
 * role-specific views. Two layers behind it: a static, hardcoded FAQ
 * (lib/helpFaq.ts) answers common "how do I..." product questions
 * instantly and for free; anything it doesn't recognise - real questions
 * about the caller's own district's sector data, or general nutrition
 * guidance - goes to the Gemini-backed assistant (backend/chat.py), which
 * is scoped strictly enough to refuse off-topic or medical-diagnosis
 * questions rather than answering them.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendChatMessage, type ChatMessage } from "@/lib/chat";
import { matchFaq } from "@/lib/helpFaq";
import { getStoredUser, ROLE_LABEL, type UserRole } from "@/lib/auth";

const SUGGESTED_PROMPT: Record<UserRole, string> = {
  district_officer:
    'Try: "Which sectors in my district are highest risk?" or "How do I export a report?"',
  chw_supervisor:
    'Try: "Which sectors in my district are highest risk?" or "Why is [sector] flagged?"',
  chw: 'Try: "How do I send an SMS alert?" or "What does \'failed\' delivery status mean?"',
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8A2.5 2.5 0 0 1 17.5 16H10l-4.5 4V16h-1A2.5 2.5 0 0 1 2 13.5v-8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read once at mount: role doesn't change without a re-login, and this
  // avoids re-reading localStorage on every render.
  const [role] = useState<UserRole | null>(() => getStoredUser()?.role ?? null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const historyForRequest = messages;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", text }]);

    // Try the static FAQ first - instant, free, and can't hallucinate a
    // wrong answer about the UI. Only real/unrecognised questions reach
    // the backend and spend part of the assistant's daily quota.
    const faqAnswer = matchFaq(text, role);
    if (faqAnswer) {
      setMessages((prev) => [...prev, { role: "model", text: faqAnswer }]);
      return;
    }

    setLoading(true);
    try {
      const reply = await sendChatMessage(text, historyForRequest);
      setMessages((prev) => [...prev, { role: "model", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reach the assistant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-lg flex items-center justify-center transition-colors"
        aria-label={open ? "Close chat assistant" : "Open chat assistant"}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-2.5rem)] h-[480px] max-h-[calc(100vh-8rem)] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden animate-[fadeIn_0.15s_ease-out]">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold">Kurinda assistant</p>
            <p className="text-xs text-slate-500">
              {role
                ? `For ${ROLE_LABEL[role]}s: sector data, feeding guidance, or how to use Kurinda.`
                : "Ask about sectors in your district, general feeding guidance, or how to use Kurinda."}
            </p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {role ? SUGGESTED_PROMPT[role] : SUGGESTED_PROMPT.chw_supervisor}
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-cyan-400 text-slate-950 ml-auto"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm rounded-lg px-3 py-2 max-w-[85%] inline-flex items-center gap-2">
                <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-600 border-t-cyan-400 animate-spin" />
                Thinking…
              </div>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <form onSubmit={handleSend} className="border-t border-slate-200 dark:border-slate-800 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition-colors focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 rounded px-3 py-2 text-sm font-semibold transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
