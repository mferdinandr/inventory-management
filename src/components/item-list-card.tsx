import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export type ItemListRow = { id: string; code: string; name: string; badge?: ReactNode };

type ItemListCardProps<T extends ItemListRow> = {
  title: string;
  emptyText: string;
  items: T[];
  hrefFor: (item: T) => string;
  meta?: (item: T) => ReactNode;
};

/** A card listing item rows (code, name, optional badge/meta) with hover and chevron. */
export function ItemListCard<T extends ItemListRow>({
  title,
  emptyText,
  items,
  hrefFor,
  meta,
}: ItemListCardProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-ink-200">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={hrefFor(item)}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{item.code}</span>
                      {item.badge}
                    </div>
                    <p className="truncate font-medium">{item.name}</p>
                    {meta && <p className="text-sm text-muted-foreground">{meta(item)}</p>}
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
