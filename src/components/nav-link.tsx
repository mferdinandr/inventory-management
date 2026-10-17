"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type NavLinkProps = ComponentProps<typeof Link>;

/** Navbar link that highlights the active route. */
export function NavLink({ href, className, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(String(href));
  return (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      className={cn("h-9 text-base", className)}
    >
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
