import QRCode from "qrcode";

/** The URL a label's QR points to (docs/08 §1): only the permanent item code. */
export function qrTarget(code: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/i/${encodeURIComponent(code)}`;
}

/** SVG QR for an item, error correction M, `size` pixels square. */
export function qrSvg(code: string, size = 512): Promise<string> {
  return QRCode.toString(qrTarget(code), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: size,
  });
}
