import { uuidv7 } from "uuidv7"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  try {
    const formData = await readFormData(event)
    const file = formData.get("file") as FormDataEntryValue as File
    if (!file) throw createError({ statusCode: 400, message: "No file provided" })

    const fileId = uuidv7()
    const arrayBuffer = await file.arrayBuffer()
    const contentType =
      file.type || getContentTypeFromFileName(file.name) || "application/octet-stream"

    const blobFile = new Blob([arrayBuffer], { type: contentType })

    await useS3Storage().setItemRaw(fileId, blobFile, {
      CacheControl: "public, max-age=31536000"
    })

    const config = useRuntimeConfig()
    const fileUrl = config.s3Endpoint + "/" + config.s3Bucket + "/" + fileId
    const fileType = getAssetTypeFromMimeType(contentType)

    return {
      id: fileId,
      src: fileUrl,
      type: fileType,
      fileName: file.name
    }
  } catch (error) {
    console.error(error)
    throw createError({ statusCode: 400, message: "Invalid request body" })
  }
})

function getContentTypeFromFileName(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase()
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }
  return ext ? mimeTypes[ext] || null : null
}

function getAssetTypeFromMimeType(mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return "image"
  } else if (mimeType.startsWith("video/")) {
    return "video"
  } else if (mimeType.startsWith("audio/")) {
    return "audio"
  } else if (mimeType === "application/pdf") {
    return "pdf"
  } else {
    return "other"
  }
}
