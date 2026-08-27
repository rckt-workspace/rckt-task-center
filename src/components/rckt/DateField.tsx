import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCO, fromISO, toISO } from "@/lib/rckt/dates";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
}

export function DateField({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  clearable = false,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4" />
            {value ? formatCO(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            weekStartsOn={1}
            selected={value ? fromISO(value) : undefined}
            onSelect={(d) => {
              if (!d) return;
              onChange(toISO(d));
              setOpen(false);
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Limpiar fecha"
          onClick={() => onChange(null)}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
