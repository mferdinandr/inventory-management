"use client";

import { Button } from "@/components/ui";
import { t } from "@/lib/strings";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      {t.print.print}
    </Button>
  );
}
