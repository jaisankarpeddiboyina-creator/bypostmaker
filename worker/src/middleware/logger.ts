export function logRequest(method: string, path: string, status: number, duration: number) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)
  console.log(`[LOG] [${timestamp}] ${method} ${path} - ${status} (${duration}ms)`)
}
