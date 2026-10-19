"use client";

import { Button } from "@/components/ui";
import { t } from "@/lib/strings";

export function PrintButton({ className }: { className?: string }) {
  return (
    <Button type="button" onClick={() => window.print()} className={className}>
      {t.print.print}
    </Button>
  );
}
