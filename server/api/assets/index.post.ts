import { uuidv7 } from "uuidv7"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  try {
    const formData = await readFormData(event)
    const file = formData.get("file") as FormDataEntryValue as File
    if (!file) throw createError({ statusCode: 400, message: "No file provided" })

    console.log("File type from upload:", file.type)
    console.log("File name:", file.name)

    const fileId = uuidv7()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const contentType =
      file.type || getContentTypeFromFileName(file.name) || "application/octet-stream"
    console.log("Determined content type:", contentType)

    const res = await useS3Storage().setItemRaw(fileId, buffer, {
      ContentType: contentType,
      CacheControl: "public, max-age=31536000"
    })

    const config = useRuntimeConfig()
    const url = config.s3Endpoint + "/" + config.s3Bucket + "/" + fileId
    console.log("Uploaded with content type:", contentType)
    console.log("URL:", url)

    return url
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
