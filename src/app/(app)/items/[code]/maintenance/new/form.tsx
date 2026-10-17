"use client";

import { useActionState, useEffect, useState } from "react";
import { Button, Input, Label, NativeSelect, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
import { type MaintenanceFormState, saveMaintenance } from "./actions";

const ACTOR_KEY = "simaset.actorName";
const TYPES = ["PERBAIKAN", "PEMELIHARAAN", "KALIBRASI"] as const;

type Props = {
  code: string;
  today: string;
  quantity: number;
  damaged: number;
};

function Field({
  name,
  label,
  hint,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
    </div>
  );
}

export function MaintenanceForm({ code, today, quantity, damaged }: Props) {
  const [state, action, pending] = useActionState<MaintenanceFormState, FormData>(
    saveMaintenance.bind(null, code),
    undefined,
  );
  const v = state?.values ?? {};
  const [type, setType] = useState<(typeof TYPES)[number]>("PERBAIKAN");
  const [result, setResult] = useState(v.result ?? "LULUS");
  const [actorName, setActorName] = useState("");

  // The person usually fills this in many times a day on the same phone.
  useEffect(() => {
    try {
      setActorName(localStorage.getItem(ACTOR_KEY) ?? "");
    } catch {}
  }, []);

  // A failed save re-renders with the earlier choice of kind.
  useEffect(() => {
    const kept = state?.values?.type;
    if (kept && TYPES.includes(kept as never)) setType(kept as (typeof TYPES)[number]);
    if (state?.values?.result) setResult(state.values.result);
  }, [state]);

  const rememberActor = () => {
    try {
      localStorage.setItem(ACTOR_KEY, actorName.trim());
    } catch {}
  };

  return (
    <form action={action} onSubmit={rememberActor} className="max-w-xl space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}

      <Field name="type" label={t.maintenance.type}>
        <NativeSelect
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
        >
          {TYPES.map((k) => (
            <option key={k} value={k}>
              {t.maintenance.types[k]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <Field name="performedOn" label={t.maintenance.performedOn}>
        <Input
          id="performedOn"
          name="performedOn"
          type="date"
          required
          defaultValue={v.performedOn ?? today}
        />
      </Field>
      <Field name="performer" label={t.maintenance.performer}>
        <Input
          id="performer"
          name="performer"
          required
          maxLength={120}
          defaultValue={v.performer}
        />
      </Field>

      {type === "PERBAIKAN" && (
        <>
          <Field name="complaint" label={t.maintenance.complaint}>
            <Input id="complaint" name="complaint" required defaultValue={v.complaint} />
          </Field>
          <Field name="action" label={t.maintenance.action}>
            <Input id="action" name="action" defaultValue={v.action} />
          </Field>
          <Field name="parts" label={t.maintenance.parts}>
            <Input id="parts" name="parts" defaultValue={v.parts} />
          </Field>
          <Field name="finishedOn" label={t.maintenance.finishedOn}>
            <Input id="finishedOn" name="finishedOn" type="date" defaultValue={v.finishedOn} />
          </Field>
        </>
      )}

      {type === "PEMELIHARAAN" && (
        <>
          <Field name="activities" label={t.maintenance.activities}>
            <Input id="activities" name="activities" required defaultValue={v.activities} />
          </Field>
          <Field name="findings" label={t.maintenance.findings}>
            <Input id="findings" name="findings" defaultValue={v.findings} />
          </Field>
          <Field name="nextDue" label={t.maintenance.nextDueInput}>
            <Input id="nextDue" name="nextDue" type="date" defaultValue={v.nextDue} />
          </Field>
        </>
      )}

      {type === "KALIBRASI" && (
        <>
          <Field name="institution" label={t.maintenance.institution}>
            <Input id="institution" name="institution" required defaultValue={v.institution} />
          </Field>
          <Field name="certificateNo" label={t.maintenance.certificateNo}>
            <Input id="certificateNo" name="certificateNo" defaultValue={v.certificateNo} />
          </Field>
          <Field
            name="result"
            label={t.maintenance.result}
            hint={result === "TIDAK_LULUS" ? t.maintenance.failedNotice : undefined}
          >
            <NativeSelect
              id="result"
              name="result"
              value={result}
              onChange={(e) => setResult(e.target.value)}
            >
              <option value="LULUS">{t.maintenance.results.LULUS}</option>
              <option value="TIDAK_LULUS">{t.maintenance.results.TIDAK_LULUS}</option>
            </NativeSelect>
          </Field>
          <Field name="validUntil" label={t.maintenance.validUntil}>
            <Input
              id="validUntil"
              name="validUntil"
              type="date"
              required
              defaultValue={v.validUntil}
            />
          </Field>
        </>
      )}

      <Field name="cost" label={t.maintenance.cost}>
        <Input
          id="cost"
          name="cost"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          defaultValue={v.cost}
        />
      </Field>
      <Field
        name="damagedAfter"
        label={t.maintenance.damagedAfter}
        hint={t.maintenance.damagedHint(quantity, damaged)}
      >
        <Input
          id="damagedAfter"
          name="damagedAfter"
          type="number"
          inputMode="numeric"
          min={0}
          max={quantity}
          step={1}
          required
          defaultValue={v.damagedAfter ?? String(damaged)}
        />
      </Field>
      <Field name="note" label={t.maintenance.note}>
        <Input id="note" name="note" maxLength={1000} defaultValue={v.note} />
      </Field>
      <Field name="actorName" label={t.maintenance.actorName} hint={t.maintenance.actorHint}>
        <Input
          id="actorName"
          name="actorName"
          required
          maxLength={80}
          value={actorName}
          onChange={(e) => setActorName(e.target.value)}
        />
      </Field>

      <Button type="submit" disabled={pending}>
        {t.maintenance.submit}
      </Button>
    </form>
  );
}
