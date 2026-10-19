"use client";

import { useEffect, useState } from "react";
import { Input, Label } from "@/components/ui";
import { t } from "@/lib/strings";

const ACTOR_KEY = "simaset.actorName";

/** Name of the staff member and an optional note; the name is remembered on this device. */
export function FlowFields({ notePlaceholder }: { notePlaceholder?: string }) {
  const [actorName, setActorName] = useState("");

  useEffect(() => {
    try {
      setActorName(localStorage.getItem(ACTOR_KEY) ?? "");
    } catch {}
  }, []);

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="actorName">
          {t.flow.actorName} <span className="font-semibold text-destructive">*</span>
        </Label>
        <Input
          id="actorName"
          name="actorName"
          required
          maxLength={80}
          value={actorName}
          onChange={(e) => setActorName(e.target.value)}
          onBlur={() => {
            try {
              localStorage.setItem(ACTOR_KEY, actorName.trim());
            } catch {}
          }}
          className="h-11"
        />
        <p className="text-sm text-muted-foreground">{t.flow.actorHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">{t.flow.note}</Label>
        <Input
          id="note"
          name="note"
          maxLength={300}
          placeholder={notePlaceholder}
          className="h-11"
        />
      </div>
    </>
  );
}

/** Persist the name at submit too, since a tap on Save may skip the blur. */
export function rememberActorName(form: HTMLFormElement) {
  try {
    const name = new FormData(form).get("actorName");
    if (typeof name === "string") localStorage.setItem(ACTOR_KEY, name.trim());
  } catch {}
}
