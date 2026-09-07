import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const PIECES = Array.from({ length: 16 }, (_, i) => i);
const COLORS = [
  "oklch(0.42 0.11 275)",
  "oklch(0.42 0.11 255)",
  "oklch(0.44 0.09 162)",
  "oklch(0.55 0.1 72)",
  "oklch(0.46 0.12 25)",
];

/**
 * Micro-animación discreta al completar una tarea.
 * Se dispara cada vez que cambia `trigger` (contador creciente).
 */
export function CompletionCelebration({ trigger }: { trigger: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 1300);
    return () => window.clearTimeout(id);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center"
    >
      <div className="relative">
        <span className="rckt-check-pop inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success shadow-panel ring-1 ring-success/30">
          <Check className="size-8" strokeWidth={3} />
        </span>
        {PIECES.map((i) => {
          const angle = (i / PIECES.length) * Math.PI * 2;
          const distance = 60 + (i % 4) * 14;
          return (
            <span
              key={i}
              className="rckt-confetti absolute top-1/2 left-1/2 block h-1.5 w-1.5 rounded-[1px]"
              style={{
                backgroundColor: COLORS[i % COLORS.length] as string,
                ["--rckt-x" as string]: `${Math.cos(angle) * distance}px`,
                ["--rckt-y" as string]: `${Math.sin(angle) * distance}px`,
                animationDelay: `${(i % 5) * 25}ms`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
