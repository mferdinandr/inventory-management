"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link> & { onDark?: boolean };

/** Navbar link that highlights the active route. `onDark` styles it for the dark header. */
export function NavLink({ href, className, onDark = false, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(String(href));
  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "h-9 text-base",
        active
          ? onDark
            ? "bg-white text-brand-800 hover:bg-white hover:text-brand-800"
            : "bg-ink-100 text-foreground hover:bg-ink-100"
          : onDark
            ? "text-brand-50 hover:bg-white/10 hover:text-white"
            : "text-ink-700 hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
