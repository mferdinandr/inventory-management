import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export * from "./alert";
export * from "./alert-dialog";
export * from "./badge";
export * from "./button";
export * from "./card";
export * from "./dialog";
export * from "./dropdown-menu";
export * from "./input";
export * from "./label";
export * from "./select";
export * from "./separator";
export * from "./skeleton";
export * from "./sonner";
export * from "./textarea";

export function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-danger-200 bg-danger-50 text-danger-700"
          : "border-success-200 bg-success-50 text-success-800",
      )}
    >
      {children}
    </div>
  );
}

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        className={cn(
          "block w-full appearance-none rounded-lg border border-ink-300 bg-white py-3 pr-10 pl-3 text-base shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30 focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  );
}
