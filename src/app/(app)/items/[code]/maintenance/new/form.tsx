"use client";

import { Save } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { Button, Input, Label, NativeSelect, Notice } from "@/components/ui";
import { t } from "@/lib/strings";
import { type MaintenanceFormState, saveMaintenance } from "./actions";

const ACTOR_KEY = "simaset.actorName";
const TYPES = ["PERBAIKAN", "PEMELIHARAAN", "KALIBRASI"] as const;
const FIELD = "h-11";

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
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
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
    <form action={action} onSubmit={rememberActor} className="space-y-4">
      {state?.error && <Notice tone="error">{state.error}</Notice>}

      <Field name="type" label={t.maintenance.type}>
        <NativeSelect
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
          className={FIELD}
        >
          {TYPES.map((k) => (
            <option key={k} value={k}>
              {t.maintenance.types[k]}
            </option>
          ))}
        </NativeSelect>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="performedOn" label={t.maintenance.performedOn}>
          <Input
            id="performedOn"
            name="performedOn"
            type="date"
            required
            defaultValue={v.performedOn ?? today}
            className={FIELD}
          />
        </Field>
        <Field name="performer" label={t.maintenance.performer}>
          <Input
            id="performer"
            name="performer"
            required
            maxLength={120}
            defaultValue={v.performer}
            className={FIELD}
          />
        </Field>
      </div>

      {type === "PERBAIKAN" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="complaint" label={t.maintenance.complaint}>
            <Input
              id="complaint"
              name="complaint"
              required
              defaultValue={v.complaint}
              className={FIELD}
            />
          </Field>
          <Field name="action" label={t.maintenance.action}>
            <Input id="action" name="action" defaultValue={v.action} className={FIELD} />
          </Field>
          <Field name="parts" label={t.maintenance.parts}>
            <Input id="parts" name="parts" defaultValue={v.parts} className={FIELD} />
          </Field>
          <Field name="finishedOn" label={t.maintenance.finishedOn}>
            <Input
              id="finishedOn"
              name="finishedOn"
              type="date"
              defaultValue={v.finishedOn}
              className={FIELD}
            />
          </Field>
        </div>
      )}

      {type === "PEMELIHARAAN" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="activities" label={t.maintenance.activities}>
            <Input
              id="activities"
              name="activities"
              required
              defaultValue={v.activities}
              className={FIELD}
            />
          </Field>
          <Field name="findings" label={t.maintenance.findings}>
            <Input id="findings" name="findings" defaultValue={v.findings} className={FIELD} />
          </Field>
          <Field name="nextDue" label={t.maintenance.nextDueInput}>
            <Input
              id="nextDue"
              name="nextDue"
              type="date"
              defaultValue={v.nextDue}
              className={FIELD}
            />
          </Field>
        </div>
      )}

      {type === "KALIBRASI" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="institution" label={t.maintenance.institution}>
            <Input
              id="institution"
              name="institution"
              required
              defaultValue={v.institution}
              className={FIELD}
            />
          </Field>
          <Field name="certificateNo" label={t.maintenance.certificateNo}>
            <Input
              id="certificateNo"
              name="certificateNo"
              defaultValue={v.certificateNo}
              className={FIELD}
            />
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
              className={FIELD}
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
              className={FIELD}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="cost" label={t.maintenance.cost}>
          <Input
            id="cost"
            name="cost"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={v.cost}
            className={FIELD}
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
            className={FIELD}
          />
        </Field>
      </div>

      <Field name="note" label={t.maintenance.note}>
        <Input id="note" name="note" maxLength={1000} defaultValue={v.note} className={FIELD} />
      </Field>
      <Field name="actorName" label={t.maintenance.actorName} hint={t.maintenance.actorHint}>
        <Input
          id="actorName"
          name="actorName"
          required
          maxLength={80}
          value={actorName}
          onChange={(e) => setActorName(e.target.value)}
          className={FIELD}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full shadow-md shadow-primary/25"
      >
        <Save className="size-4" />
        {t.maintenance.submit}
      </Button>
    </form>
  );
}
