"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * O React 19 "limpa" o formulário (form.reset()) depois de cada `<form action={...}>`, e o Radix Checkbox escuta esse reset e chama
 * `onCheckedChange` com o valor que a caixa tinha quando foi montada. Como as listas daqui são controladas por estado (e alternam o item
 * ao receber o evento), o salvamento deixava a tela de volta no estado de antes: o que foi marcado ficava gravado no banco, mas
 * a caixa aparecia desmarcada ao reabrir, e um novo "Salvar" gravava o estado antigo por cima. Durante o reset, a mudança é ignorada.
 */
let resetting = false;
if (typeof document !== "undefined") {
  document.addEventListener(
    "reset",
    () => {
      resetting = true;
      setTimeout(() => {
        resetting = false;
      }, 0);
    },
    true,
  );
}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, onCheckedChange, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    onCheckedChange={(checked) => {
      if (resetting) return;
      onCheckedChange?.(checked);
    }}
    className={cn(
      "peer size-4 shrink-0 rounded border border-border-strong bg-surface",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
      "data-[state=checked]:bg-accent data-[state=checked]:border-accent",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
      <Check className="size-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
