/** 主键与时间戳工具：所有实体 id 与 createdAt / updatedAt 都由此生成 */

export function uuid(prefix = 'row'): string {
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${time}${rand}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** 当前日期 YYYY-MM-DD */
export function today(): string {
  const date = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 当前时间 YYYY-MM-DDTHH:mm（用于 datetime-local 输入） */
export function nowLocalInput(): string {
  const date = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 文件名时间戳片段 */
export function stampSuffix(): string {
  const date = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`
}
