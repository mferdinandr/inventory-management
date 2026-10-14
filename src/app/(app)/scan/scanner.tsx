"use client";

import type { IScannerControls } from "@zxing/browser";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Input, Label, Notice } from "@/components/ui";
import { codeFromScan, normalizeItemCode } from "@/lib/item-code";
import { t } from "@/lib/strings";

type Camera = "starting" | "active" | "denied" | "unavailable";

export function Scanner() {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<Camera>("starting");
  const [unrecognized, setUnrecognized] = useState(false);
  const [codeError, setCodeError] = useState(false);

  useEffect(() => {
    let controls: IScannerControls | undefined;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia || !video.current) {
        setCamera("unavailable");
        return;
      }
      try {
        // Loaded on demand: the decoder is large and only this page needs it.
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        const started = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video.current,
          (result) => {
            if (!result) return;
            const code = codeFromScan(result.getText());
            if (code) router.push(`/items/${encodeURIComponent(code)}`);
            else setUnrecognized(true);
          },
        );
        if (cancelled) started.stop();
        else {
          controls = started;
          setCamera("active");
        }
      } catch (e) {
        const denied = e instanceof DOMException && /^(NotAllowed|Security)Error$/.test(e.name);
        if (!cancelled) setCamera(denied ? "denied" : "unavailable");
      }
    }
    void start();

    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [router]);

  function openManual(form: FormData) {
    const code = normalizeItemCode(String(form.get("code") ?? ""));
    setCodeError(code === null);
    if (code) router.push(`/items/${encodeURIComponent(code)}`);
  }

  return (
    <div className="space-y-6">
      {camera === "denied" && <Notice tone="error">{t.scan.denied}</Notice>}
      {camera === "unavailable" && <Notice tone="error">{t.scan.unavailable}</Notice>}
      {unrecognized && <Notice tone="error">{t.scan.unrecognized}</Notice>}
      <div className={camera === "denied" || camera === "unavailable" ? "hidden" : "space-y-2"}>
        <video
          ref={video}
          muted
          playsInline
          className="aspect-square w-full rounded-lg bg-slate-900 object-cover"
        />
        <p className="text-sm text-slate-600">
          {camera === "starting" ? t.scan.starting : t.scan.hint}
        </p>
      </div>

      <form action={openManual} className="space-y-3">
        <p className="text-sm font-medium text-slate-700">{t.scan.manual}</p>
        <div>
          <Label htmlFor="code">{t.scan.codeLabel}</Label>
          <Input
            id="code"
            name="code"
            placeholder={t.scan.codePlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        </div>
        {codeError && <Notice tone="error">{t.scan.invalidCode}</Notice>}
        <Button type="submit" className="w-full">
          {t.scan.open}
        </Button>
      </form>
    </div>
  );
}
