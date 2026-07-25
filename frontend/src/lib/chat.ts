/**
 * Kurinda - chatbot client, used by all three roles.
 *
 * Sends the message + recent history to the backend's /chat endpoint,
 * which grounds the answer in the caller's own district's real sector
 * data (see backend/chat.py) - nothing here does any of that grounding
 * itself, it's just the transport. Product/how-to questions are
 * intercepted before they reach this module - see lib/helpFaq.ts.
 */
import { authFetch } from "./auth";

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<string> {
  const res = await authFetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.detail ?? `HTTP ${res.status}`);
  }
  return data.reply as string;
}
