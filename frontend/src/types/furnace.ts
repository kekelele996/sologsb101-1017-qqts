/**
 * 窑炉（Furnace）
 * 熔化炉 / 坩埚炉 / 退火窑，退火窑自动进入窑位池，熔化炉可挂料液批次。
 */

/** 窑炉类型 */
export type FurnaceType = '熔化炉' | '坩埚炉' | '退火窑'

/** 燃料类型 */
export type FuelType = '电' | '燃气'

/** 窑炉状态：停窑 / 升温 / 运行 / 保温 */
export type FurnaceState = '停窑' | '升温' | '运行' | '保温'

export const FURNACE_TYPE_OPTIONS: FurnaceType[] = ['熔化炉', '坩埚炉', '退火窑']
export const FUEL_TYPE_OPTIONS: FuelType[] = ['电', '燃气']
export const FURNACE_STATE_OPTIONS: FurnaceState[] = ['停窑', '升温', '运行', '保温']

export interface Furnace {
  id: string
  /** 窑号 */
  code: string
  /** 窑炉类型 */
  type: FurnaceType
  /** 最高温度（℃） */
  maxTempC: number
  /** 燃料类型 */
  fuelType: FuelType
  /** 运行状态 */
  state: FurnaceState
  createdAt: string
  updatedAt: string
  revision: number
}

/** 新建 / 编辑窑炉的表单草稿 */
export interface FurnaceDraft {
  code: string
  type: FurnaceType
  maxTempC: number
  fuelType: FuelType
  state: FurnaceState
}
