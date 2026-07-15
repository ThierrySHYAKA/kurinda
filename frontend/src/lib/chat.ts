/**
 * Kurinda - chatbot client.
 *
 * CHW Supervisor only. Sends the message + recent history to the backend's
 * /chat endpoint, which grounds the answer in the supervisor's own
 * district's real sector data (see backend/chat.py) - nothing here does
 * any of that grounding itself, it's just the transport.
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
