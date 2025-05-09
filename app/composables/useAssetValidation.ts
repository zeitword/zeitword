import { computed, ref } from "vue"
import type { AssetType } from "~/types"

const assetTypeToMimeMap: { [key: string]: string[] } = {
  image: ["image/*"],
  video: ["video/*"],
  audio: ["audio/*"],
  pdf: ["application/pdf"],
  other: []
}

export function useAssetValidation(assetTypes: AssetType[] | undefined) {
  const allowedTypesString = computed(() => {
    if (!assetTypes || assetTypes.length === 0) {
      return ""
    }
    return assetTypes.map((type) => type.display.toLowerCase()).join(", ")
  })

  function isValidFileType(file: File): boolean {
    if (!assetTypes || assetTypes.length === 0) {
      return true
    }

    const allowedMimeTypes: string[] = []
    assetTypes.forEach((type: AssetType) => {
      const mimeTypeArray = assetTypeToMimeMap[type.value]
      if (mimeTypeArray) {
        allowedMimeTypes.push(...mimeTypeArray)
      }
    })

    return allowedMimeTypes.some((mimeType) => file.type.startsWith(mimeType.slice(0, -1)))
  }

  return { allowedTypesString, isValidFileType }
}
