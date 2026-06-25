export function getCurrentPeriod(): { periodStart: number; periodEnd: number } {
  const now = new Date()
  const periodStart = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000
  )
  const periodEnd = Math.floor(
    new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime() / 1000
  )
  return { periodStart, periodEnd }
}
