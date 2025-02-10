import { documents } from "../../database/schema"
import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { uuidv7 } from "uuidv7"
import { z } from "zod"

export default defineEventHandler(async (event) => {
  const { secure } = await requireUserSession(event)
  if (!secure) throw createError({ statusCode: 401, message: "Unauthorized" })

  try {
    console.log(`Uploading a file`)

    const formData = await readFormData(event)

    const file = formData.get("file") as FormDataEntryValue as File
    if (!file) throw createError({ statusCode: 400, message: "No file provided" })

    // const parentId = formData.get("parentId") as FormDataEntryValue as string

    // Generate a new file id for storage and the document record
    const fileId = uuidv7()

    // Extract file metadata
    const fileName = file.name
    const fileType = file.type

    // Read the file as an ArrayBuffer and convert to a Buffer for storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Save the raw file in Hetzner Storage
    const res = await useS3Storage().setItemRaw(fileId, buffer)
    console.log(res)

    const fileSHA256Hash = await computeSHA256Hash(buffer)

    const documentContent = {
      file: {
        id: fileId,
        hash: fileSHA256Hash,
      },
    }

    const [createdDocument] = await useDrizzle()
      .insert(documents)
      .values({
        id: fileId,
        name: fileName,
        type: fileType,
        content: documentContent,
        organisationId: secure.organisationId,
      })
      .returning()

    // process the file
    event.waitUntil(backgroundProcessDocument({ document: createdDocument }))

    return createdDocument
  } catch (error) {
    console.error(error)
    throw createError({ statusCode: 400, message: "Invalid request body" })
  }
})

async function backgroundProcessDocument({ document }: any) {
  console.log(`Processing document: ${document.id}`)
  switch (document.type) {
    case "application/pdf":
      await processPDF(document)
      break
    default:
      console.log(`Unsupported document type: ${document.type}`)
      return {}
  }
}

async function processPDF(document: any) {
  // lets download the pdf and process it
  const fileBuffer: ArrayBuffer | null = await useS3Storage().getItemRaw(document.content.file.id)
  if (!fileBuffer) throw new Error(`File not found: ${document.content.file.id}`)

  // // Using Vercel AI SDK ask ai if this is an invoice
  const isInvoice = await askAIIfInvoice(fileBuffer)

  if (!isInvoice) return {}

  await processInvoice(document)
}

async function processInvoice(document: any) {
  const fileBuffer: ArrayBuffer | null = await useS3Storage().getItemRaw(document.content.file.id)
  if (!fileBuffer) throw new Error(`File not found: ${document.content.file.id}`)
  const bytes = new Uint8Array(fileBuffer)

  const { object } = await generateObject({
    model: google("gemini-2.0-pro-exp-02-05"),
    schema: z.object({
      invoiceDate: z.string().describe("RFC3339"),
      senderName: z.string(),
      receipientName: z.string(),
      invoiceNumber: z.string(),
      dueDate: z.string().nullable().describe("RFC3339 or null"),
      total: z.number(),
      currency: z.string().min(3).max(3).describe("ISO 4217 currency code, 3 letter code"),
      bookingNote: z.string().describe("Booking note describing the invoice in 2-3 words"),
    }),
    messages: [
      {
        role: "user",
        content: `Extract the invoice information. Currency must follow ISO 4217 standard. Dates must be in RFC3339 format. Return the information as JSON. Prefer company names for sender and recipient instead of people's names.`,
        experimental_attachments: [
          {
            name: "invoice.pdf",
            contentType: "application/pdf",
            url: bytesToPdfDataUrl(bytes),
          },
        ],
      },
    ],
  })

  console.log("Extracted data from pdf", object)

  // Merge the extracted data with the document object
  const mergedContentData = { ...document.content, ...object }

  // update the document with the merged content data
  await useDrizzle()
    .update(documents)
    .set({
      type: "x-zeitword/invoice",
      content: mergedContentData,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, document.id))

  return {}
}

async function askAIIfInvoice(file: ArrayBuffer): Promise<boolean> {
  const uintArray = new Uint8Array(file)

  const { object } = await generateObject({
    model: google("gemini-2.0-flash-001"),
    schema: z.object({
      isInvoice: z.boolean().describe("If the PDF is an invoice, then true, otherwise false"),
    }),
    messages: [
      {
        role: "user",
        content: `Is this PDF an invoice?`,
        experimental_attachments: [
          {
            name: "document.pdf",
            contentType: "application/pdf",
            url: bytesToPdfDataUrl(uintArray),
          },
        ],
      },
    ],
  })

  if (object.isInvoice) {
    console.log("This is an invoice")
    return true
  } else {
    console.log("This is not an invoice")
    return false
  }
}

// Helper

function computeSHA256Hash(buffer: Buffer<ArrayBufferLike>) {
  const crypto = require("crypto")
  return crypto.createHash("sha256").update(buffer).digest("hex")
}

function bytesToPdfDataUrl(bytes: Uint8Array): string {
  // Convert the bytes to base64
  const base64 = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ""))

  // Return the complete data URL with PDF MIME type
  return `data:application/pdf;base64,${base64}`
}
