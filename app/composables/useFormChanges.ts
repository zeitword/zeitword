interface UseFormChangesOptions<T, K extends keyof T> {
  initialData: Ref<T | null>
  dataKey?: K
  onDataUpdated?: (data: T) => void
}

interface UseFormChangesReturn<T, K extends keyof T> {
  formData: Ref<Partial<T> | Partial<T[K]>>
  hasChanges: ComputedRef<boolean>
  resetChanges: () => void
  updateFormData: (newData: T) => void
}

function useFormChanges<T, K extends keyof T = keyof T>(
  options: UseFormChangesOptions<T, K>
): UseFormChangesReturn<T, K> {
  const { initialData, dataKey, onDataUpdated } = options

  const formData = ref<Partial<T> | Partial<T[K]>>(dataKey ? {} : {}) as Ref<
    Partial<T> | Partial<T[K]>
  >

  const updateFormData = (newData: T) => {
    initialData.value = newData
    if (dataKey && newData && newData[dataKey]) {
      formData.value = { ...newData[dataKey] }
    } else if (!dataKey && newData) {
      formData.value = { ...newData }
    }
    if (onDataUpdated) {
      onDataUpdated(newData)
    }
  }
  // Watch for changes in the initialData
  watch(
    () => initialData.value,
    (newData) => {
      if (newData) {
        updateFormData(newData)
      }
    },
    { deep: true, immediate: true }
  )

  const hasChanges = computed(() => {
    if (!initialData.value) {
      return false
    }
    const initial =
      dataKey && initialData.value[dataKey] ? initialData.value[dataKey] : initialData.value

    return JSON.stringify(formData.value) !== JSON.stringify(initial)
  })

  const resetChanges = () => {
    if (dataKey && initialData.value && initialData.value[dataKey]) {
      formData.value = { ...(initialData.value[dataKey] as Partial<T[K]>) }
    } else if (!dataKey && initialData.value) {
      formData.value = { ...(initialData.value as Partial<T>) }
    }
  }
  return {
    formData,
    hasChanges,
    resetChanges,
    updateFormData
  }
}

export default useFormChanges
