"use client";

import { useMemo, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Stand } from "@/../../shared";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

interface StandAssistantProps {
  stand: Stand;
  onQuestion?: (question: string, mode?: string) => void;
}

export default function StandAssistant({ stand, onQuestion }: StandAssistantProps) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: `Soy el copiloto de ${stand.title}. Pregúntame por servicios, contacto, documentos o cómo puede ayudarte esta empresa.`,
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiBaseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  }, []);

  const suggestions = [
    "¿Qué ofrece esta empresa?",
    "¿Cómo puedo contactar?",
    "¿Tiene catálogo o documentación?",
  ];

  const askAssistant = async (text: string) => {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || loading) return;

    setMessages((current) => [...current, { role: "user", content: cleanQuestion }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/stands/${encodeURIComponent(stand.id)}/assistant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          history: messages.slice(-6),
        }),
      });

      if (!response.ok) {
        throw new Error("No he podido conectar con el copiloto del stand.");
      }

      const data = await response.json() as { answer?: string; mode?: string };
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "No tengo respuesta para eso todavía. Prueba preguntando por servicios o contacto.",
        },
      ]);
      onQuestion?.(cleanQuestion, data.mode);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "El copiloto no está disponible ahora mismo.",
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-950 text-white shadow-[0_25px_70px_rgba(15,23,42,0.25)] overflow-hidden">
      <header className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-black">
          <Bot size={20} />
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-orange-400">Copiloto IA</p>
          <h3 className="text-sm font-black uppercase tracking-normal">Pregunta al stand</h3>
        </div>
      </header>

      <div className="max-h-72 space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
              message.role === "user"
                ? "bg-orange-500 text-black"
                : "bg-white/[0.08] text-white/80 border border-white/10"
            }`}
            >
              {message.content.split("\n").map((line, lineIndex) => (
                <p key={lineIndex} className={lineIndex > 0 ? "mt-2" : ""}>{line}</p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm text-white/60">
            <Loader2 size={16} className="animate-spin text-orange-400" />
            Consultando el contexto del stand...
          </div>
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => askAssistant(suggestion)}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-[9px] font-black uppercase tracking-[0.12em] text-white/60 transition hover:border-orange-400/50 hover:text-white disabled:opacity-50"
            >
              <Sparkles size={10} className="mr-1 inline text-orange-400" />
              {suggestion}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            askAssistant(question);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Pregunta sobre este stand..."
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            title="Enviar pregunta"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}
