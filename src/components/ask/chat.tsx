"use client";

import { ArrowUp, ExternalLink, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { insertMarkers } from "@/lib/rag/citations";
import { MAX_TURNS, readEvents, type AskErrorCode, type SourceCard } from "@/lib/rag/events";
import { cn } from "@/lib/utils";

type UserMessage = { id: string; role: "user"; text: string };
type AssistantMessage = {
  id: string;
  role: "assistant";
  markdown: string;
  sources: SourceCard[];
  status: "streaming" | "done" | "error";
  error?: AskErrorCode;
  cached: boolean;
};
type Message = UserMessage | AssistantMessage;

const CITE_PREFIX = "#cite-";

export function Chat({ suggestions, initialQuestion }: { suggestions: string[]; initialQuestion: string }) {
  const t = useTranslations("ask");
  const locale = useLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turnsUsed, setTurnsUsed] = useState(0);
  const [input, setInput] = useState(initialQuestion);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  const limitReached = turnsUsed >= MAX_TURNS;

  function patchAssistant(id: string, patch: (m: AssistantMessage) => AssistantMessage) {
    setMessages((all) => all.map((m) => (m.id === id && m.role === "assistant" ? patch(m) : m)));
  }

  async function ask(question: string) {
    const q = question.trim();
    if (q.length < 3 || busy || limitReached) return;
    const assistantId = crypto.randomUUID();
    setMessages((all) => [
      ...all,
      { id: crypto.randomUUID(), role: "user", text: q },
      { id: assistantId, role: "assistant", markdown: "", sources: [], status: "streaming", cached: false },
    ]);
    setInput("");
    setBusy(true);
    const fail = (code: AskErrorCode) =>
      patchAssistant(assistantId, (m) => ({ ...m, status: "error", error: code }));

    try {
      abortRef.current = new AbortController();
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: conversationId ?? undefined, question: q, locale }),
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: AskErrorCode } } | null;
        const code = body?.error?.code ?? "unavailable";
        if (code === "conversation_expired") setConversationId(null);
        return fail(code);
      }
      for await (const e of readEvents(res.body)) {
        if (e.type === "meta") {
          setConversationId(e.conversation_id);
          setTurnsUsed(e.turn);
          patchAssistant(assistantId, (m) => ({ ...m, cached: e.cached }));
        } else if (e.type === "text") {
          patchAssistant(assistantId, (m) => ({ ...m, markdown: m.markdown + e.text }));
        } else if (e.type === "cite") {
          const markers = e.ns.map((n) => `[${n}](${CITE_PREFIX}${n})`).join("");
          patchAssistant(assistantId, (m) => ({ ...m, markdown: insertMarkers(m.markdown, markers, e.after) }));
        } else if (e.type === "source") {
          patchAssistant(assistantId, (m) => ({ ...m, sources: [...m.sources, e.source] }));
        } else if (e.type === "done") {
          patchAssistant(assistantId, (m) => ({ ...m, status: "done" }));
        } else if (e.type === "error") {
          fail(e.code);
        }
      }
      patchAssistant(assistantId, (m) => (m.status === "streaming" ? { ...m, status: "done" } : m));
    } catch (err) {
      if ((err as Error).name !== "AbortError") fail("unavailable");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setTurnsUsed(0);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {messages.length === 0 && suggestions.length > 0 && (
        <section aria-labelledby="suggested">
          <h2 id="suggested" className="text-sm font-medium text-muted-foreground">
            {t("suggested")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  disabled={busy}
                  className="rounded-full border bg-card px-3 py-1.5 text-left text-sm hover:border-plasma/60 disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="flex flex-col gap-6" aria-live="polite">
        {messages.map((m) =>
          m.role === "user" ? (
            <li key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-secondary px-4 py-2.5">
              {m.text}
            </li>
          ) : (
            <li key={m.id}>
              <Answer message={m} />
            </li>
          ),
        )}
      </ol>
      <div ref={bottomRef} />

      {limitReached && !busy && <p className="text-sm text-warn">{t("limitReached", { max: MAX_TURNS })}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-4 rounded-lg border bg-card p-2 shadow-lg shadow-black/30"
      >
        <label htmlFor={inputId} className="sr-only">
          {t("placeholder")}
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            rows={2}
            maxLength={1000}
            disabled={limitReached}
            placeholder={t("placeholder")}
            className="min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || limitReached || input.trim().length < 3}
            aria-label={t("send")}
            className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <ArrowUp aria-hidden className="size-4" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between px-2 text-xs text-muted-foreground">
          <span className="font-mono">{t("turns", { used: turnsUsed, max: MAX_TURNS })}</span>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <RotateCcw aria-hidden className="size-3" /> {t("newConversation")}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function Answer({ message: m }: { message: AssistantMessage }) {
  const t = useTranslations("ask");
  const [active, setActive] = useState<number | null>(null);
  const sourceId = (n: number) => `source-${m.id}-${n}`;

  return (
    <div className="rounded-lg border bg-card p-4">
      {m.status === "streaming" && !m.markdown && (
        <p className="animate-pulse text-sm text-muted-foreground">{t("thinking")}</p>
      )}
      {m.markdown && (
        <div className="space-y-3 leading-relaxed [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_ul]:space-y-1 [&_strong]:text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href?.startsWith(CITE_PREFIX)) {
                  const n = Number(href.slice(CITE_PREFIX.length));
                  return (
                    <a
                      href={`#${sourceId(n)}`}
                      onMouseEnter={() => setActive(n)}
                      onMouseLeave={() => setActive(null)}
                      onFocus={() => setActive(n)}
                      onBlur={() => setActive(null)}
                      className="mx-0.5 align-super font-mono text-[0.7rem] text-plasma no-underline hover:underline"
                      aria-label={`${t("sources")} ${n}`}
                    >
                      [{n}]
                    </a>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noreferrer" className="text-plasma underline">
                    {children}
                  </a>
                );
              },
            }}
          >
            {m.markdown}
          </ReactMarkdown>
        </div>
      )}
      {m.status === "error" && m.error && (
        <p role="alert" className="mt-2 text-sm text-warn">
          {t(`errors.${m.error}`)}
        </p>
      )}

      {m.sources.length > 0 && (
        <section className="mt-4 border-t pt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("sources")}
          </h3>
          <ol className="mt-2 grid gap-2 sm:grid-cols-2">
            {m.sources.map((s) => (
              <li
                key={s.n}
                id={sourceId(s.n)}
                className={cn(
                  "scroll-mt-24 rounded-md border p-3 text-sm transition-colors target:border-plasma",
                  active === s.n && "border-plasma bg-plasma/5",
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-mono text-xs text-plasma">[{s.n}]</span>
                  <span className="font-medium">{s.experiment}</span>
                  {s.psi_id && <span className="font-mono text-xs text-muted-foreground">{s.psi_id}</span>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`sections.${s.section}`)}
                  {s.curation !== "complete" && (
                    <span className="ml-2 rounded border border-warn/40 px-1 text-warn">
                      {t(`curation.${s.curation}`)}
                    </span>
                  )}
                </p>
                <blockquote className="mt-2 line-clamp-5 border-l-2 pl-2 text-xs italic text-foreground/80">
                  {s.cited_text}
                </blockquote>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  {s.url.startsWith("/") && (
                    <Link href={s.url} className="text-plasma hover:underline">
                      {t("openRecord")}
                    </Link>
                  )}
                  {s.psi_url && (
                    <a
                      href={s.psi_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-plasma hover:underline"
                    >
                      {t("openPsi")} <ExternalLink aria-hidden className="size-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {m.cached && m.status === "done" && (
        <p className="mt-3 text-right text-[0.7rem] text-muted-foreground">{t("cached")}</p>
      )}
    </div>
  );
}
