import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fromISO, mondayOf, toISO, weekLabel } from "@/lib/rckt/dates";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  value: string;
  onChange: (mondayIso: string) => void;
  label?: string;
  className?: string;
}

export function WeekPicker({ value, onChange, label = "Semana", className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start gap-2 font-normal", className)}>
          <CalendarDays className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium">{weekLabel(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          weekStartsOn={1}
          selected={fromISO(value)}
          onSelect={(d) => {
            if (!d) return;
            onChange(toISO(mondayOf(d)));
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
