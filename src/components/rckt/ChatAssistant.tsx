import { useCallback, useEffect, useRef, useState } from "react";
import { Loader, MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendChatMessage } from "@/lib/chat.functions";
import type { LLMMessage } from "@/server/llm/types";
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
];

const WELCOME_MESSAGE =
  "Hola, soy el asistente de RCKT Task Center. Puedo ayudarte a entender tus tareas y tu carga de trabajo.";

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
      const conversationHistory = buildConversationHistory();

      const response = await sendChatMessage({
        message: userMessage,
        conversationHistory,
      });

      if (!response.ok) {
        setError(response.error || "Error al procesar tu mensaje");
        return;
      }

      const assistantTime = Date.now();
      const assistantMessage: Message = {
        id: `assistant-${assistantTime}`,
        role: "assistant",
        content: response.reply,
        timestamp: assistantTime,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error desconocido";
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
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg transition-all hover:scale-110 hover:shadow-xl active:scale-95"
          aria-label="Abrir asistente"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 flex h-screen w-full flex-col bg-black/40 sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[420px] sm:rounded-t-2xl sm:shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:rounded-t-2xl">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Asistente RCKT</h3>
              <p className="text-xs text-muted-foreground">Consulta sobre tus tareas</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 space-y-4 overflow-y-auto bg-background p-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xs rounded-lg px-4 py-2 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-blue-600 text-white" : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Procesando...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              </div>
            )}

            {messages.length === 1 && !isLoading && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Sugerencias rápidas:</p>
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestion(suggestion)}
                    className="w-full rounded-lg border border-border bg-card p-2 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border bg-card p-3 sm:rounded-b-2xl">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre tus tareas..."
                disabled={isLoading}
                className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Presiona <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Enter</kbd>
              {" para enviar, "}
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">Shift+Enter</kbd>
              {" para nueva línea"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
