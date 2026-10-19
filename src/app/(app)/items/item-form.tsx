"use client";

import { type FormEvent, startTransition, useActionState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
import type { ItemFormState } from "./actions";
import { type ContentRow, ContentsEditor } from "./contents-editor";

/** Form values as plain strings, the way inputs hold them. */
export type ItemValues = {
  name: string;
  needsSterilization: "true" | "false" | "";
  room: string;
  description: string;
  quantity: string;
  damagedQuantity: string;
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  supplier: string;
  fundingSource: string;
  warrantyUntil: string;
};

export const emptyValues: ItemValues = {
  name: "",
  needsSterilization: "",
  room: "",
  description: "",
  quantity: "1",
  damagedQuantity: "0",
  brand: "",
  model: "",
  serialNumber: "",
  purchaseDate: "",
  purchasePrice: "",
  supplier: "",
  fundingSource: "",
  warrantyUntil: "",
};

type Props = {
  action: (prev: ItemFormState, form: FormData) => Promise<ItemFormState>;
  values: ItemValues;
  contents: ContentRow[];
  rooms: string[];
  submitLabel: string;
  cancelHref: string;
  /** Present when editing: identifies the row and the version the edit started from. */
  edit?: { id: string; version: number };
  /** False for steril staff: only the contents can change. */
  canEditDetails?: boolean;
  /** False while the item is at CSSD. */
  canChangeSterilization?: boolean;
  /** Steril staff add rows and change counts but do not remove or rename. */
  contentsRestricted?: boolean;
};

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-3 [&>div]:space-y-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function ItemForm({
  action,
  values,
  contents,
  rooms,
  submitLabel,
  cancelHref,
  edit,
  canEditDetails = true,
  canChangeSterilization = true,
  contentsRestricted = false,
}: Props) {
  const [state, formAction, pending] = useActionState<ItemFormState, FormData>(action, undefined);
  const f = t.items.fields;

  // Submitting through a transition (not `<form action>`) keeps what was typed when the
  // server answers with an error, instead of React resetting the form.
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form
      onSubmit={onSubmit}
      // Enter in a text box must not submit a long form half-filled (the contents editor
      // uses Enter to add rows).
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
      }}
      className="space-y-4"
    >
      {edit && (
        <>
          <input type="hidden" name="id" value={edit.id} />
          <input type="hidden" name="version" value={edit.version} />
        </>
      )}

      {canEditDetails && (
        <>
          <Group title={t.items.groups.identity}>
            <div className="sm:col-span-2">
              <Label htmlFor="name">
                {f.name} ({t.items.required})
              </Label>
              <Input id="name" name="name" defaultValue={values.name} required maxLength={120} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium text-slate-700">
                {f.needsSterilization} ({t.items.required})
              </legend>
              <div className="space-y-1">
                {(
                  [
                    ["true", f.sterilizationYes],
                    ["false", f.sterilizationNo],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 items-center gap-2 text-base">
                    <input
                      type="radio"
                      name="needsSterilization"
                      value={value}
                      defaultChecked={values.needsSterilization === value}
                      disabled={!canChangeSterilization}
                      required
                      className="size-5"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {!canChangeSterilization && (
                <p className="text-sm text-slate-600">{f.sterilizationLocked}</p>
              )}
            </fieldset>
            <div>
              <Label htmlFor="room">{f.room}</Label>
              <Input
                id="room"
                name="room"
                list="rooms"
                defaultValue={values.room}
                maxLength={120}
              />
              <datalist id="rooms">
                {rooms.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-slate-500">{f.roomHint}</p>
            </div>
            <div>
              <Label htmlFor="description">{f.description}</Label>
              <Input
                id="description"
                name="description"
                defaultValue={values.description}
                maxLength={1000}
              />
            </div>
          </Group>

          <Group title={t.items.groups.quantity}>
            <div>
              <Label htmlFor="quantity">{f.quantity}</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={values.quantity}
              />
              <p className="mt-1 text-xs text-slate-500">{f.quantityHint}</p>
            </div>
            <div>
              <Label htmlFor="damagedQuantity">{f.damagedQuantity}</Label>
              <Input
                id="damagedQuantity"
                name="damagedQuantity"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={values.damagedQuantity}
              />
            </div>
          </Group>

          <Group title={t.items.groups.equipment}>
            <div>
              <Label htmlFor="brand">{f.brand}</Label>
              <Input id="brand" name="brand" defaultValue={values.brand} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="model">{f.model}</Label>
              <Input id="model" name="model" defaultValue={values.model} maxLength={80} />
            </div>
            <div>
              <Label htmlFor="serialNumber">{f.serialNumber}</Label>
              <Input
                id="serialNumber"
                name="serialNumber"
                defaultValue={values.serialNumber}
                maxLength={80}
              />
              <p className="mt-1 text-xs text-slate-500">{f.serialHint}</p>
            </div>
          </Group>

          <Group title={t.items.groups.purchase}>
            <div>
              <Label htmlFor="purchaseDate">{f.purchaseDate}</Label>
              <Input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                defaultValue={values.purchaseDate}
              />
            </div>
            <div>
              <Label htmlFor="purchasePrice">{f.purchasePrice}</Label>
              <Input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={values.purchasePrice}
              />
            </div>
            <div>
              <Label htmlFor="supplier">{f.supplier}</Label>
              <Input id="supplier" name="supplier" defaultValue={values.supplier} maxLength={120} />
            </div>
            <div>
              <Label htmlFor="fundingSource">{f.fundingSource}</Label>
              <Input
                id="fundingSource"
                name="fundingSource"
                defaultValue={values.fundingSource}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="warrantyUntil">{f.warrantyUntil}</Label>
              <Input
                id="warrantyUntil"
                name="warrantyUntil"
                type="date"
                defaultValue={values.warrantyUntil}
              />
            </div>
          </Group>
        </>
      )}

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{t.items.groups.contents}</h2>
        <ContentsEditor initial={contents} restricted={contentsRestricted} />
      </section>

      {edit && (
        <div className="space-y-2">
          <Label htmlFor="note">{f.note}</Label>
          <Input id="note" name="note" maxLength={300} />
        </div>
      )}

      <div aria-live="polite">{state?.error && <Notice tone="error">{state.error}</Notice>}</div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t.items.saving : submitLabel}
        </Button>
        <a
          href={cancelHref}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-base font-medium hover:bg-slate-100"
        >
          {t.items.cancel}
        </a>
      </div>
    </form>
  );
}
