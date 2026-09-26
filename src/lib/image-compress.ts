// FR-17: kompresi gambar di sisi peramban sebelum diunggah — sisi terpanjang
// maksimum 1600px, target di bawah 500 KB. PDF (sertifikat) tidak dikompresi.

const MAX_DIMENSION = 1600
const TARGET_BYTES = 500 * 1024
const MIN_QUALITY = 0.4

export type CompressedImage = { blob: Blob; width: number; height: number }

export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Kanvas tidak didukung di peramban ini.")
  ctx.drawImage(bitmap, 0, 0, width, height)

  let quality = 0.8
  let blob = await canvasToBlob(canvas, quality)
  while (blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.15
    blob = await canvasToBlob(canvas, quality)
  }

  return { blob, width, height }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Gagal mengompresi gambar."))),
      "image/jpeg",
      quality,
    )
  })
}
