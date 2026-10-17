"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui";

type NavLinkProps = ComponentProps<typeof Link>;

/** Navbar link that highlights the active route. */
export function NavLink({ href, children, ...props }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(String(href));
  return (
    <Button asChild variant={active ? "secondary" : "ghost"} className="h-9 text-base">
      <Link href={href} {...props}>
        {children}
      </Link>
    </Button>
  );
}
