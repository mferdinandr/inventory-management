import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it } from "vitest";
import { register } from "@/instrumentation";

afterEach(async () => {
  await Sentry.close(1000);
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
});

describe("error reporting", () => {
  it("does nothing without a DSN", () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    register();
    expect(Sentry.getClient()).toBeUndefined();
  });

  it("sends an unexpected error to the configured DSN", async () => {
    const bodies: string[] = [];
    const sink = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        bodies.push(Buffer.concat(chunks).toString("utf8"));
        res.writeHead(200, { "content-type": "application/json" }).end("{}");
      });
    });
    await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
    const { port } = sink.address() as AddressInfo;

    process.env.NEXT_PUBLIC_SENTRY_DSN = `http://key@127.0.0.1:${port}/1`;
    register();
    Sentry.captureException(new Error("boom-from-test"));
    await Sentry.flush(3000);
    await new Promise<void>((resolve) => sink.close(() => resolve()));

    expect(bodies.join("\n")).toContain("boom-from-test");
  });
});
