export type Option = {
  value: string
  display: string
}

export type AssetObject = {
  id: string
  src: string
  alt: string
  type: string
}

export type AssetConfig = {
  assetTypes: Option[]
}

export type AssetType = {
  value: string
  display: string
}

export type RichTextConfig = {
  features: Option[]
}
