import { compressImage } from "@/lib/image-compress"
import {
  confirmAttachmentAction,
  requestAttachmentUploadAction,
} from "@/server/actions/attachment.actions"

/** FR-17: kompresi (untuk gambar) → minta URL presigned → PUT langsung ke penyimpanan objek → konfirmasi. */
export async function uploadAttachmentsForEvent(
  eventId: string,
  files: File[],
): Promise<{ uploaded: number; errors: string[] }> {
  const errors: string[] = []
  let uploaded = 0

  for (const file of files) {
    try {
      let body: Blob = file
      let width: number | undefined
      let height: number | undefined
      let contentType = file.type

      if (file.type.startsWith("image/") && file.type !== "image/webp") {
        const compressed = await compressImage(file)
        body = compressed.blob
        width = compressed.width
        height = compressed.height
        contentType = "image/jpeg"
      }

      const requested = await requestAttachmentUploadAction({
        eventId,
        contentType,
        sizeBytes: body.size,
        originalFilename: file.name,
      })
      if (!requested.ok) {
        errors.push(`${file.name}: ${requested.error}`)
        continue
      }

      const putRes = await fetch(requested.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body,
      })
      if (!putRes.ok) {
        errors.push(`${file.name}: unggah ke penyimpanan gagal (${putRes.status}).`)
        continue
      }

      const confirmed = await confirmAttachmentAction({
        eventId,
        objectKey: requested.objectKey,
        mimeType: contentType,
        sizeBytes: body.size,
        width,
        height,
        originalFilename: file.name,
      })
      if (!confirmed.ok) {
        errors.push(`${file.name}: ${confirmed.error}`)
        continue
      }
      uploaded++
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "galat tak terduga"}`)
    }
  }

  return { uploaded, errors }
}
