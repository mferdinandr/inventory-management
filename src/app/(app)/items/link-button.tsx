import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/utils";

/** A link that looks like `Button` from the UI kit (navigation, not a form submit). */
export function LinkButton({
  variant = "default",
  ...props
}: ComponentProps<typeof Link> & { variant?: "default" | "outline" | "ghost" }) {
  return <Link className={cn(buttonVariants({ variant }), "gap-2")} {...props} />;
}
