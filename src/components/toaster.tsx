"use client";

import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";

/** shadcn/ui-style Sonner toaster; mounted once in the root layout. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-lg border shadow-lg text-sm",
          title: "font-medium",
        },
      }}
    />
  );
}

/** Shows `state.error` / `state.ok` of a server action as a toast whenever the state changes. */
export function ActionToast({ state }: { state?: { error?: string; ok?: string } | undefined }) {
  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) toast.success(state.ok);
  }, [state]);
  return null;
}
