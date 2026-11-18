import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bot, LoaderCircle, MessageCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { api } from "../services/api";

type ChatRole = "user" | "assistant";
type Source = { label: string; href: string };
type Message = { role: ChatRole; content: string; sources?: Source[] };
type ChatReply = { answer: string; sources: Source[]; material_id: string | null };
type AssistantStatus = { configured: boolean };

const suggestions = [
  "How should I interpret a voltage prediction?",
  "What does energy above hull mean?",
  "How do I inspect a crystal structure?",
];

export default function ResearchAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const materialId = location.pathname.match(/^\/(?:materials|structures)\/(cf-\d{5})(?:\/|$)/i)?.[1]?.toLowerCase();

  useEffect(() => {
    if (!open || status !== null) return;
    let active = true;
    api<AssistantStatus>("/assistant/status")
      .then((result) => active && setStatus(result.configured))
      .catch((reason: Error) => {
        if (active) {
          setStatus(false);
          setStatusError(reason.message || "Could not check assistant availability.");
        }
      });
    return () => {
      active = false;
    };
  }, [open, status]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        requestAnimationFrame(() => launcherRef.current?.focus());
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sending || status !== true) return;
    const userMessage: Message = { role: "user", content: message };
    const previous = messages;
    setMessages((current) => [...current, userMessage].slice(-40));
    setDraft("");
    setError("");
    setSending(true);
    try {
      const reply = await api<ChatReply>("/assistant/chat", {
        message,
        history: previous.slice(-8).map(({ role, content }) => ({ role, content })),
        ...(materialId ? { material_id: materialId } : {}),
      });
      setMessages((current) => [
        ...current,
        { role: "assistant" as const, content: reply.answer, sources: reply.sources },
      ].slice(-40));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent. Please try again.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleInputKey(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="research-assistant">
      {open && (
        <section className="assistant-panel" role="dialog" aria-label="CrystalForge Research Assistant">
          <header className="assistant-header">
            <div className="assistant-brand-icon" aria-hidden="true"><Bot size={20} /></div>
            <div className="assistant-heading">
              <strong>Research Assistant</strong>
              <span className={status === false ? "assistant-service-offline" : ""}><i /> {status === true ? "Ready to answer" : status === false ? "Setup required" : "Checking availability"}</span>
            </div>
            {messages.length > 0 && <button className="assistant-icon-button" onClick={() => { setMessages([]); setError(""); setDraft(""); }} aria-label="Start a new conversation"><RotateCcw size={16} /></button>}
            <button className="assistant-icon-button" onClick={() => { setOpen(false); requestAnimationFrame(() => launcherRef.current?.focus()); }} aria-label="Close assistant">
              <X size={18} />
            </button>
          </header>

          <div className="assistant-transcript" aria-live="polite" aria-relevant="additions text">
            {messages.length === 0 ? (
              <div className="assistant-welcome">
                <div className="assistant-welcome-mark"><Sparkles size={20} /></div>
                <h2>Explore the materials with confidence.</h2>
                <p>Ask about CrystalForge data, predictions, or structure metadata. Answers are grounded in available catalog context.</p>
                {materialId && <span className="assistant-context-tag">Using material {materialId}</span>}
                {status === null && !statusError && <p className="assistant-status-line"><LoaderCircle className="assistant-spinner" size={15} /> Checking assistant availability…</p>}
                {status === false && <p className="assistant-not-configured" role="status">{statusError || "AI replies are not configured yet. Ask the project administrator to add GEMINI_API_KEY to Render."}</p>}
                {status === true && <div className="assistant-suggestions" aria-label="Suggested questions">{suggestions.map((question) => <button key={question} onClick={() => setDraft(question)}>{question}</button>)}</div>}
              </div>
            ) : (
              <div className="assistant-messages">
                {messages.map((message, index) => (
                  <article className={`assistant-message ${message.role}`} key={`${index}-${message.role}`}>
                    {message.role === "assistant" && <span className="assistant-message-mark" aria-hidden="true"><Bot size={14} /></span>}
                    <div className="assistant-bubble">
                      <p>{message.content}</p>
                      {message.sources && message.sources.length > 0 && <div className="assistant-sources"><span>Sources</span>{message.sources.map((source) => source.href.startsWith("/") ? <Link key={source.href} to={source.href}>{source.label}</Link> : <a key={source.href} href={source.href} target="_blank" rel="noreferrer">{source.label}</a>)}</div>}
                    </div>
                  </article>
                ))}
                {sending && <div className="assistant-typing" role="status"><span /><span /><span /><span className="sr-only">Assistant is responding</span></div>}
                <div ref={endRef} />
              </div>
            )}
          </div>

          <div className="assistant-compose-wrap">
            {error && <div className="assistant-error" role="alert">{error}</div>}
            <form className="assistant-compose" onSubmit={(event) => void sendMessage(event)}>
              <label className="sr-only" htmlFor="assistant-message">Ask the research assistant</label>
              <textarea
                id="assistant-message"
                ref={inputRef}
                rows={1}
                maxLength={1200}
                placeholder={status === true ? "Ask about materials or predictions…" : "Assistant is unavailable"}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleInputKey}
                disabled={status !== true || sending}
                aria-describedby="assistant-privacy"
              />
              <button type="submit" disabled={!draft.trim() || sending || status !== true} aria-label="Send message">
                {sending ? <LoaderCircle className="assistant-spinner" size={18} /> : <Send size={17} />}
              </button>
            </form>
            <div className="assistant-compose-meta">
              <span id="assistant-privacy">Messages are sent to Gemini. Don’t share private information.</span>
              <span>{draft.length}/1200</span>
            </div>
            <p className="assistant-disclaimer">Research support only. Predictions need independent DFT or experimental validation.</p>
          </div>
        </section>
      )}
      <button
        ref={launcherRef}
        className={`assistant-launcher${open ? " is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close research assistant" : "Open research assistant"}
        aria-expanded={open}
      >
        {open ? <X size={19} /> : <><MessageCircle size={19} /><span>Ask CrystalForge</span></>}
      </button>
    </div>
  );
}
