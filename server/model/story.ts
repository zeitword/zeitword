import { z } from "zod"

type Response<T> = { data: T; error: null } | { data: null; error: Error }

export function useStoryModel() {
  // fields

  async function getField() {}

  async function listFields() {}

  async function updateField() {}

  // blocks

  const listBlocksParamSchema = z.object({
    siteId: z.string().describe("The site ID"),
    blockId: z
      .string()
      .optional()
      .describe("The block ID for which to get the blocks as blocks can be nested")
  })

  /**
   * List all blocks for a site
   * @param params - The parameters for the list blocks operation
   * @returns A response object containing the list of blocks or an error
   */
  async function listBlocks(
    params: z.infer<typeof listBlocksParamSchema>
  ): Promise<Response<null>> {
    try {
      const { siteId, blockId } = listBlocksParamSchema.parse(params)

      return { data: null, error: new Error("Not implemented") }
    } catch (error) {
      return { data: null, error: new Error("Failed to list blocks") }
    }
  }

  async function getBlock() {}

  async function addBlock() {}

  async function removeBlock() {}

  return {
    blocks: {
      list: listBlocks,
      get: getBlock,
      add: addBlock,
      remove: removeBlock
    },
    fields: {
      get: getField,
      list: listFields
    }
  }
}
