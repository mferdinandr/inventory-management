"use client";

import type { IScannerControls } from "@zxing/browser";
import { QrCode } from "lucide-react";
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
    let stream: MediaStream | undefined;
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
        const reader = new BrowserQRCodeReader();
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled || !video.current) return;
        video.current.srcObject = stream;
        try {
          await video.current.play();
        } catch {}
        // decodeFromVideoElement only reads frames; the stream above is ours
        // so stopping one instance never kills a sibling's camera in dev.
        controls = await reader.decodeFromVideoElement(video.current, (result) => {
          if (!result) return;
          const code = codeFromScan(result.getText());
          if (code) router.push(`/items/${encodeURIComponent(code)}`);
          else setUnrecognized(true);
        });
        if (!cancelled) setCamera("active");
      } catch (e) {
        const denied = e instanceof DOMException && /^(NotAllowed|Security)Error$/.test(e.name);
        if (!cancelled) setCamera(denied ? "denied" : "unavailable");
      }
    }
    void start();

    return () => {
      cancelled = true;
      controls?.stop();
      for (const track of stream?.getTracks() ?? []) track.stop();
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
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-ink-950">
          <video ref={video} autoPlay muted playsInline className="size-full object-cover" />
          <span className="pointer-events-none absolute top-3 left-3 size-10 rounded-tl-xl border-t-4 border-l-4 border-white/80" />
          <span className="pointer-events-none absolute top-3 right-3 size-10 rounded-tr-xl border-t-4 border-r-4 border-white/80" />
          <span className="pointer-events-none absolute bottom-3 left-3 size-10 rounded-bl-xl border-b-4 border-l-4 border-white/80" />
          <span className="pointer-events-none absolute right-3 bottom-3 size-10 rounded-br-xl border-r-4 border-b-4 border-white/80" />
        </div>
        <p className="text-sm text-muted-foreground">
          {camera === "starting" ? t.scan.starting : t.scan.hint}
        </p>
      </div>

      <div className="border-t border-ink-200 pt-5">
        <form action={openManual} className="space-y-3">
          <p className="text-sm font-semibold text-ink-800">{t.scan.manual}</p>
          <div className="space-y-2">
            <Label htmlFor="code">{t.scan.codeLabel}</Label>
            <div className="relative">
              <QrCode className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="code"
                name="code"
                placeholder={t.scan.codePlaceholder}
                autoCapitalize="characters"
                autoComplete="off"
                required
                className="h-11 pl-10"
              />
            </div>
          </div>
          {codeError && <Notice tone="error">{t.scan.invalidCode}</Notice>}
          <Button type="submit" size="lg" className="w-full shadow-md shadow-primary/25">
            {t.scan.open}
          </Button>
        </form>
      </div>
    </div>
  );
}
