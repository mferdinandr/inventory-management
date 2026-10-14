import Link from "next/link";
import type { ComponentProps } from "react";

/** A link that looks like `Button` from the UI kit (navigation, not a form submit). */
export function LinkButton({
  variant = "primary",
  ...props
}: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  const styles =
    variant === "primary"
      ? "bg-teal-700 text-white hover:bg-teal-800"
      : "border border-slate-300 bg-white text-slate-800 hover:bg-slate-100";
  return (
    <Link
      className={`inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-base font-medium ${styles}`}
      {...props}
    />
  );
}
