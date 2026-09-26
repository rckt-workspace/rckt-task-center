import { useCallback, useEffect, useRef, useState } from "react";
import { Loader, MessageCircle, Send, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { LLMMessage } from "@/lib/chat-core/llm-types";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const QUICK_SUGGESTIONS = [
  "¿Qué tareas tengo pendientes?",
  "¿Qué me vence hoy?",
  "Resume mi semana",
  "Estado del equipo",
];

const WELCOME_MESSAGE =
  "Hola. Puedo ayudarte a entender qué tienes pendiente, qué vence hoy y cómo está distribuida la carga del equipo.";

const MAX_HISTORY_INTERACTIONS = 10;

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: 0,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const buildConversationHistory = useCallback((): LLMMessage[] => {
    const userMessages = messages.filter((m) => m.id !== "welcome");
    const recent = userMessages.slice(-MAX_HISTORY_INTERACTIONS * 2);

    return recent.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    setError(null);
    const userMessage = input.trim();
    const userTime = Date.now();
    setInput("");

    const newUserMessage: Message = {
      id: `user-${userTime}`,
      role: "user",
      content: userMessage,
      timestamp: userTime,
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        setError("Sesión expirada. Por favor, recarga la página.");
        return;
      }

      const conversationHistory = buildConversationHistory();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          message: userMessage,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: string };
        setError(errorData.error || "Error al procesar tu mensaje");
        return;
      }

      const data = (await response.json()) as {
        ok: boolean;
        reply?: string;
      };

      if (!data.ok || !data.reply) {
        setError("Error al procesar tu mensaje");
        return;
      }

      const assistantTime = Date.now();
      const assistantMessage: Message = {
        id: `assistant-${assistantTime}`,
        role: "assistant",
        content: data.reply,
        timestamp: assistantTime,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error de conexión";
      setError(errorMsg);
      toast.error("Error: " + errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, buildConversationHistory]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 shadow-2xl transition-all duration-200 hover:scale-110 hover:shadow-blue-600/50 active:scale-95"
          aria-label="Abrir asistente"
          title="RCKT Assistant"
        >
          <div className="relative">
            <MessageCircle className="h-7 w-7 text-white" />
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-400 animate-pulse" />
          </div>
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex h-screen w-full flex-col bg-black/30 backdrop-blur-sm sm:bottom-6 sm:right-6 sm:h-[680px] sm:w-[480px] sm:rounded-2xl sm:shadow-2xl sm:bg-black/0 sm:backdrop-blur-0">
          {/* Main Container */}
          <div className="flex h-full flex-col rounded-none bg-gradient-to-b from-slate-950 to-slate-900 sm:rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 sm:rounded-t-2xl">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">RCKT ASSISTANT</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="h-2 w-2 rounded-full bg-green-400" />
                        <p className="text-xs text-green-400 font-medium">En línea</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Tu copiloto para tareas y operación
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "bg-slate-800 text-slate-100 border border-slate-700"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 border border-slate-700">
                    <Loader className="h-4 w-4 animate-spin text-blue-400" />
                    <span className="text-sm text-slate-300">Procesando...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-start animate-in fade-in">
                  <div className="rounded-lg bg-red-900/20 border border-red-800/50 px-4 py-2.5 text-sm text-red-300 max-w-xs">
                    <p className="font-medium">Error</p>
                    <p className="text-xs mt-1 text-red-200">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-xs mt-2 text-red-400 hover:text-red-300 underline"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              )}

              {messages.length === 1 && !isLoading && (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Preguntas rápidas
                  </p>
                  {QUICK_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestion(suggestion)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-left text-sm text-slate-300 transition-all hover:bg-slate-800 hover:border-slate-600 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95"
                    >
                      <div className="flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="flex-1">{suggestion}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-800 bg-slate-900 p-4 sm:rounded-b-2xl">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pregúntame sobre tus tareas..."
                  disabled={isLoading}
                  className="flex-1 resize-none rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  rows={2}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all h-auto px-3 rounded-lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs border border-slate-700">
                  Enter
                </kbd>
                {" para enviar · "}
                <kbd className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs border border-slate-700">
                  Shift+Enter
                </kbd>
                {" para salto de línea"}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
