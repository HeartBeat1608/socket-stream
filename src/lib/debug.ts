export const debug_factory = (key: string) => {
  return (...args: any[]) => {
    console.log(`[${key}]`, ...args)
  }
}