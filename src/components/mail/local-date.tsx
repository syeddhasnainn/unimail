import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}

export function LocalDate({ value, format }: { value: Date | string; format: (value: Date | string) => string }) {
  return <>{useHydrated() ? format(value) : null}</>
}
