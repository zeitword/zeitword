import { nanoid } from "nanoid"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  try {
    const formData = await readFormData(event)

    const file = formData.get("file") as FormDataEntryValue as File
    if (!file) throw createError({ statusCode: 400, message: "No file provided" })

    // Generate a new file id for storage and the document record
    const fileId = nanoid(32)

    // Read the file as an ArrayBuffer and convert to a Buffer for storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Save the raw file in storage
    const res = await useS3Storage().setItemRaw(fileId, buffer)

    const config = useRuntimeConfig()

    return config.s3Endpoint + "/" + fileId
  } catch (error) {
    console.error(error)
    throw createError({ statusCode: 400, message: "Invalid request body" })
  }
})
