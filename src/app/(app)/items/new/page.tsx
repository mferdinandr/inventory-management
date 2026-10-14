import type { Metadata } from "next";
import { t } from "@/lib/strings";
import { requireAction } from "@/server/auth/session";
import { listRooms } from "@/server/services/item.service";
import { createItemAction } from "../actions";
import { emptyValues, ItemForm } from "../item-form";

export const metadata: Metadata = { title: t.items.newItem.title };

export default async function NewItemPage() {
  await requireAction("item.create");
  const rooms = await listRooms();
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t.items.newItem.title}</h1>
      <ItemForm
        action={createItemAction}
        values={emptyValues}
        contents={[]}
        rooms={rooms}
        submitLabel={t.items.newItem.submit}
        cancelHref="/items"
      />
    </section>
  );
}
