import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import { t } from "@/lib/strings";
import { requireUser } from "@/server/auth/session";
import { getItemByCode, listRooms } from "@/server/services/item.service";
import { updateItemAction } from "../../actions";
import { toDateInput } from "../../format";
import { ItemForm } from "../../item-form";

export const metadata: Metadata = { title: t.items.editItem.title };

export default async function EditItemPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const { code } = await params;
  const item = await getItemByCode(decodeURIComponent(code));
  if (!item) notFound();

  const state = { location: item.location, needsSterilization: item.needsSterilization };
  const canEditDetails = can(user.role, "item.editDetails", state);
  const canEditContents = can(user.role, "item.editContents", state);
  if ((!canEditDetails && !canEditContents) || item.isArchived) redirect(`/items/${item.code}`);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">
        {t.items.editItem.title}: {item.code}
      </h1>
      {!canEditDetails && <p className="text-slate-600">{t.items.editItem.contentsOnly}</p>}
      <ItemForm
        action={updateItemAction}
        edit={{ id: item.id, version: item.version }}
        values={{
          name: item.name,
          needsSterilization: item.needsSterilization ? "true" : "false",
          room: item.room ?? "",
          description: item.description ?? "",
          quantity: String(item.quantity),
          damagedQuantity: String(item.damagedQuantity),
          brand: item.brand ?? "",
          model: item.model ?? "",
          serialNumber: item.serialNumber ?? "",
          purchaseDate: toDateInput(item.purchaseDate),
          purchasePrice: item.purchasePrice === null ? "" : String(item.purchasePrice),
          supplier: item.supplier ?? "",
          fundingSource: item.fundingSource ?? "",
          warrantyUntil: toDateInput(item.warrantyUntil),
        }}
        contents={item.contents.map((c) => ({
          id: c.id,
          name: c.name,
          brand: c.brand ?? "",
          quantity: c.quantity,
          damagedQuantity: c.damagedQuantity,
          note: c.note ?? "",
        }))}
        rooms={await listRooms()}
        submitLabel={t.items.save}
        cancelHref={`/items/${item.code}`}
        canEditDetails={canEditDetails}
        canChangeSterilization={item.location === "OPERASI"}
        contentsRestricted={user.role === "STERIL"}
      />
    </section>
  );
}
