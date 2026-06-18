"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Bot, Loader2, MapPin, MessageCircle, Send, Sparkles, X } from "lucide-react";

type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type FairAssistantRecommendation = {
  id: string;
  title: string;
  pavilion_id?: string | null;
  pavilion_name?: string | null;
  reason?: string;
  contact?: string | null;
};

interface FairAssistantProps {
  slug: string;
  eventId?: string | null;
  onAnalytics?: (question: string, mode?: string) => void;
  onOpenStand?: (recommendation: FairAssistantRecommendation) => void;
}

const fallbackSuggestions = [
  "Recomiendame stands de IA",
  "Que empresas hay en la feria?",
  "Donde esta el auditorio?",
];

export default function FairAssistant({ slug, onAnalytics, onOpenStand }: FairAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(fallbackSuggestions);
  const [recommendations, setRecommendations] = useState<FairAssistantRecommendation[]>([]);
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      content: "Hola, soy tu copiloto de feria. Puedo recomendarte stands, orientarte por pabellones y ayudarte a encontrar contactos utiles.",
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const apiBaseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSuggestions() {
      try {
        const response = await fetch(`${apiBaseUrl}/events/slug/${encodeURIComponent(slug)}/assistant/suggestions`);
        if (!response.ok) return;
        const data = await response.json() as { suggestions?: string[] };
        if (!ignore && data.suggestions?.length) {
          setSuggestedQuestions(data.suggestions);
        }
      } catch {
        // The static suggestions are good enough when the API is not reachable.
      }
    }

    loadSuggestions();

    return () => {
      ignore = true;
    };
  }, [apiBaseUrl, slug]);

  const askAssistant = async (text: string) => {
    const cleanQuestion = text.trim();
    if (!cleanQuestion || loading) return;

    setMessages((current) => [...current, { role: "user", content: cleanQuestion }]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await fetch(`${apiBaseUrl}/events/slug/${encodeURIComponent(slug)}/assistant`, {
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
        throw new Error("No he podido conectar con el asistente.");
      }

      const data = await response.json() as {
        answer?: string;
        mode?: string;
        recommendations?: FairAssistantRecommendation[];
      };
      const answer = data.answer || "No tengo respuesta para eso todavia. Prueba preguntando por stands, pabellones o el auditorio.";

      setRecommendations(data.recommendations || []);
      setMessages((current) => [...current, { role: "assistant", content: answer }]);
      onAnalytics?.(cleanQuestion, data.mode);
    } catch (error) {
      setRecommendations([]);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "El asistente no esta disponible ahora mismo.",
        },
      ]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-primary px-5 py-4 text-black shadow-[0_18px_55px_rgba(255,81,0,0.45)] transition hover:scale-105"
        title="Asistente IA"
      >
        <MessageCircle size={24} />
        <span className="hidden text-[10px] font-black uppercase tracking-widest sm:inline">Preguntar IA</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(720px,calc(100vh-140px))] w-[calc(100vw-2rem)] max-w-[440px] flex-col overflow-hidden rounded-lg border border-white/15 bg-[#080808]/95 text-white shadow-[0_25px_90px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:right-6"
          >
            <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-black">
                  <Bot size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.28em] text-primary">Copiloto IA</p>
                  <h2 className="text-sm font-black uppercase tracking-normal">Guia de feria</h2>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
                title="Cerrar asistente"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[86%] rounded-lg px-4 py-3 text-sm leading-6 ${
                    message.role === "user"
                      ? "bg-primary text-black"
                      : "border border-white/10 bg-white/[0.06] text-white/82"
                  }`}
                  >
                    {message.content.split("\n").map((line, lineIndex) => (
                      <p key={lineIndex} className={lineIndex > 0 ? "mt-2" : ""}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white/65">
                    <Loader2 size={16} className="animate-spin text-primary" />
                    Pensando con el contexto de la feria...
                  </div>
                </div>
              )}

              {recommendations.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Stands recomendados</p>
                  {recommendations.map((recommendation) => (
                    <button
                      key={recommendation.id}
                      onClick={() => onOpenStand?.(recommendation)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-primary/60 hover:bg-white/[0.08]"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-black uppercase tracking-wide text-white">{recommendation.title}</h3>
                        <ArrowRight size={16} className="shrink-0 text-primary" />
                      </div>
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        <MapPin size={12} className="text-primary" />
                        {recommendation.pavilion_name || "Pabellon"}
                      </p>
                      {recommendation.reason && (
                        <p className="line-clamp-3 text-xs leading-5 text-white/60">{recommendation.reason}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => askAssistant(suggestion)}
                    disabled={loading}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-white/60 transition hover:border-primary/40 hover:text-white disabled:opacity-50"
                  >
                    <Sparkles size={11} className="mr-1 inline text-primary" />
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
                  placeholder="Pregunta por stands, agenda o contactos..."
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/50 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-primary/70"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  title="Enviar pregunta"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
