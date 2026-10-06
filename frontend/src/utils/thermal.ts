/**
 * 热工计算工具
 * - 退火曲线段时长换算（升温 / 保温 / 缓冷）
 * - 窑位占用判重（同一窑位时间窗重叠检测）
 * - 温度单位换算（℃ ↔ ℉）
 * - 工艺温度区间与设计尺寸校验
 */
import type { Anneal, CurveSeg } from '../types/anneal'
import type { Craft } from '../types/piece'

/** 保留 1 位小数 */
export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** 保留 2 位小数 */
export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** 摄氏度 → 华氏度 */
export function cToF(c: number): number {
  return round1((c * 9) / 5 + 32)
}

/** 华氏度 → 摄氏度 */
export function fToC(f: number): number {
  return round1(((f - 32) * 5) / 9)
}

/** 退火曲线段参数：起止温度与速率 */
export interface CurveSegment {
  seg: CurveSeg
  startC: number
  endC: number
  /** 升降温速率（℃/小时）；保温段为 0 */
  rateCPerHour: number
  /** 保温段的基准保温时长（小时，按 5mm 壁厚计） */
  holdHoursPer5mm: number
  hint: string
}

/** 退火曲线定义（钠钙玻璃常规退火区间） */
export const ANNEAL_CURVE: Record<CurveSeg, CurveSegment> = {
  升温: {
    seg: '升温',
    startC: 20,
    endC: 560,
    rateCPerHour: 120,
    holdHoursPer5mm: 0,
    hint: '从室温以 120 ℃/h 缓慢升温至 560 ℃ 退火点，避免热冲击。',
  },
  保温: {
    seg: '保温',
    startC: 560,
    endC: 560,
    rateCPerHour: 0,
    holdHoursPer5mm: 1.2,
    hint: '在 560 ℃ 退火点保温，每 5 mm 壁厚保温 1.2 小时以消除内应力。',
  },
  缓冷: {
    seg: '缓冷',
    startC: 560,
    endC: 60,
    rateCPerHour: 40,
    holdHoursPer5mm: 0,
    hint: '以 40 ℃/h 缓慢降温至 60 ℃ 以下再出窑，快速降温会造成裂纹。',
  },
}

/**
 * 曲线段时长换算（小时）
 * 升温 / 缓冷按温差与速率换算；保温按壁厚换算（每 5 mm 保温 1.2 小时）。
 */
export function segmentHours(seg: CurveSeg, wallThicknessMm: number): number {
  const curve = ANNEAL_CURVE[seg]
  if (seg === '保温') {
    const thickness = Math.max(1, wallThicknessMm)
    return round1((thickness / 5) * curve.holdHoursPer5mm)
  }
  const delta = Math.abs(curve.endC - curve.startC)
  if (curve.rateCPerHour <= 0) return 0
  return round1(delta / curve.rateCPerHour)
}

/** 一件作品的完整退火时长（三段合计，小时） */
export function totalAnnealHours(wallThicknessMm: number): number {
  return round1(
    segmentHours('升温', wallThicknessMm) + segmentHours('保温', wallThicknessMm) + segmentHours('缓冷', wallThicknessMm),
  )
}

/** 把小时数格式化为「x 小时 y 分钟」 */
export function formatHours(hours: number): string {
  const total = Math.max(0, Math.round(hours * 60))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} 分钟`
  if (m === 0) return `${h} 小时`
  return `${h} 小时 ${m} 分钟`
}

/** 解析 ISO / datetime-local 字符串为时间戳；非法返回 NaN */
export function parseAt(value: string): number {
  if (value === '') return Number.NaN
  const stamp = new Date(value).getTime()
  return Number.isNaN(stamp) ? Number.NaN : stamp
}

/** 时间窗：[入窑, 出炉]；未出炉时以入窑 + 预计时长作为临时出炉时间 */
export function annealWindow(row: Pick<Anneal, 'inAt' | 'outAt' | 'curveSeg'>, wallThicknessMm: number): [number, number] {
  const start = parseAt(row.inAt)
  if (Number.isNaN(start)) return [Number.NaN, Number.NaN]
  const end = parseAt(row.outAt)
  if (!Number.isNaN(end) && end > start) return [start, end]
  return [start, start + segmentHours(row.curveSeg, wallThicknessMm) * 3600 * 1000]
}

/** 两个时间窗是否重叠 */
export function windowsOverlap(a: [number, number], b: [number, number]): boolean {
  if (Number.isNaN(a[0]) || Number.isNaN(b[0])) return false
  return a[0] < b[1] && b[0] < a[1]
}

export interface SlotConflict {
  conflict: boolean
  /** 冲突的既有退火记录 */
  withPieceId: string
  withAnnealId: string
  message: string
}

/**
 * 窑位占用判重：同一窑位、时间窗重叠即为冲突。
 * excludeAnnealId 用于编辑场景排除自身。
 */
export function checkSlotConflict(
  existing: Anneal[],
  candidate: Pick<Anneal, 'id' | 'kilnSlot' | 'inAt' | 'outAt' | 'curveSeg' | 'pieceId'>,
  wallThicknessOf: (pieceId: string) => number,
  excludeAnnealId = '',
): SlotConflict {
  const ownThickness = wallThicknessOf(candidate.pieceId)
  const ownWindow = annealWindow(candidate, ownThickness)

  for (const row of existing) {
    if (row.id === excludeAnnealId) continue
    if (row.kilnSlot !== candidate.kilnSlot) continue
    const otherWindow = annealWindow(row, wallThicknessOf(row.pieceId))
    if (windowsOverlap(ownWindow, otherWindow)) {
      return {
        conflict: true,
        withPieceId: row.pieceId,
        withAnnealId: row.id,
        message: `窑位 ${candidate.kilnSlot} 在该时间窗内已被占用（${row.inAt} 起的 ${row.curveSeg} 段），请更换窑位或调整时间。`,
      }
    }
  }
  return { conflict: false, withPieceId: '', withAnnealId: '', message: '' }
}

/** 生成某台退火窑的窑位列表 */
export function kilnSlots(kilnCode: string): string[] {
  const rows = ['A', 'B', 'C']
  const cols = [1, 2, 3]
  const list: string[] = []
  rows.forEach((row) => {
    cols.forEach((col) => {
      list.push(`${kilnCode}-${row}${col}`)
    })
  })
  return list
}

/** 工艺对应的适宜成型温度区间（℃） */
export const CRAFT_TEMP_RANGE: Record<Craft, { min: number; max: number; hint: string }> = {
  吹制: { min: 900, max: 1200, hint: '吹制需在 900–1200 ℃ 的高温区间快速完成，温度过低玻璃会硬化。' },
  铸造: { min: 800, max: 1150, hint: '铸造（窑铸）在 800–1150 ℃ 区间浇注，随后随窑缓冷。' },
  热塑: { min: 700, max: 1000, hint: '热塑（灯工）在 700–1000 ℃ 区间塑形，注意反复回火避免炸裂。' },
}

export interface TempCheck {
  ok: boolean
  message: string
}

/** 工序温度合理性校验：不得超窑炉上限，且应落在工艺区间附近 */
export function checkStepTemp(tempC: number, maxTempC: number, craft: Craft): TempCheck {
  const range = CRAFT_TEMP_RANGE[craft]
  if (tempC > maxTempC) {
    return { ok: false, message: `工序温度 ${tempC} ℃ 超过所选窑炉上限 ${maxTempC} ℃，无法执行。` }
  }
  if (tempC < range.min - 120 || tempC > range.max + 120) {
    return {
      ok: false,
      message: `工序温度 ${tempC} ℃ 明显偏离「${craft}」的适宜区间 ${range.min}–${range.max} ℃。${range.hint}`,
    }
  }
  return { ok: true, message: `工序温度 ${tempC} ℃ 落在「${craft}」的合理区间内。` }
}

/** 设计尺寸比例校验：壁厚与高度需匹配 */
export function checkDesign(heightMm: number, wallThicknessMm: number): TempCheck {
  if (heightMm <= 0) return { ok: false, message: '设计高度必须大于 0。' }
  if (wallThicknessMm <= 0) return { ok: false, message: '壁厚必须大于 0。' }
  if (wallThicknessMm >= heightMm / 8) {
    return { ok: false, message: `壁厚 ${wallThicknessMm} mm 相对设计高度 ${heightMm} mm 偏厚，成型与退火难度都会显著上升。` }
  }
  if (wallThicknessMm < 1.5) {
    return { ok: false, message: `壁厚 ${wallThicknessMm} mm 过薄（建议 ≥ 1.5 mm），退火时极易变形。` }
  }
  return { ok: true, message: `设计尺寸比例合理：高 ${heightMm} mm / 壁厚 ${wallThicknessMm} mm。` }
}

/** 料液剩余量阈值（kg），低于该值提示补料 */
export const LOW_REMAIN_KG = 60

/** 是否低于补料阈值 */
export function isLowRemain(remainKg: number): boolean {
  return remainKg < LOW_REMAIN_KG
}
