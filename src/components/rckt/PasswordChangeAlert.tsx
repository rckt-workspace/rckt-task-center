import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PasswordChangeAlertProps {
  mustChange?: boolean;
}

export function PasswordChangeAlert({ mustChange = false }: PasswordChangeAlertProps) {
  if (!mustChange) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
      <div className="flex gap-3">
        <AlertCircle className="size-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-amber-900">Contraseña temporal</h3>
          <p className="text-sm text-amber-800 mt-1">
            Tu cuenta utiliza una contraseña temporal. Te recomendamos cambiarla por una más segura.
          </p>
          <Button asChild size="sm" className="mt-3" variant="outline">
            <Link to="/profile">Cambiar contraseña</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
