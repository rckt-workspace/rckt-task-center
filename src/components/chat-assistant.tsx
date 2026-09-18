import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader } from "lucide-react";
import { sendChatMessage } from "@/lib/chat.functions";
import type { LLMMessage } from "@/server/llm/types";
import { cn } from "@/lib/utils";

interface Message extends LLMMessage {
  id: string;
}

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    setError(null);
    const userMessage: Message = {
      id: Math.random().toString(36).substring(7),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await sendChatMessage({
        message: input,
        conversationHistory: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      setIsLoading(false);

      if (response.ok) {
        const assistantMessage: Message = {
          id: Math.random().toString(36).substring(7),
          role: "assistant",
          content: response.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setError(response.error || "Error al procesar tu mensaje");
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (err) {
      setIsLoading(false);
      setError("Error de conexión. Por favor intenta de nuevo.");
      setMessages((prev) => prev.slice(0, -1));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Chat assistant"
        className={cn(
          "fixed bottom-6 right-6 z-40 p-3 rounded-full transition-all duration-200",
          "bg-slate-900 hover:bg-slate-800 text-white shadow-lg",
          "hover:shadow-xl hover:scale-110",
          isOpen && "scale-110",
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-40 w-96 max-h-96",
            "bg-white rounded-lg shadow-2xl flex flex-col",
            "border border-slate-200",
          )}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
            <h3 className="font-semibold">Asistente de RCKT</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:opacity-80 transition-opacity"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 text-sm py-8">
                <p className="mb-2">¿Preguntas sobre tus tareas?</p>
                <p className="text-xs">Soy solo lectura - no puedo crear ni editar tareas.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-2 text-sm",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] px-3 py-2 rounded-lg break-words",
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-br-none"
                      : "bg-slate-100 text-slate-900 rounded-bl-none",
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader className="w-4 h-4 animate-spin" />
                Procesando...
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 p-3 space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta... (Enter para enviar, Shift+Enter para nueva línea)"
              className={cn(
                "w-full px-3 py-2 border border-slate-200 rounded",
                "text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent",
                "resize-none max-h-24",
              )}
              rows={2}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className={cn(
                "w-full px-3 py-2 rounded text-white text-sm font-medium",
                "transition-colors duration-200",
                isLoading || !input.trim()
                  ? "bg-slate-300 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Enviar
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
