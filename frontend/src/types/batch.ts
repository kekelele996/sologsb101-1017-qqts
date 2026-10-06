/**
 * 料液批次（GlassBatch）
 * 取料时按剩余量扣减，低于阈值高亮提示补料。
 */
export interface GlassBatch {
  id: string
  /** 所属熔化炉 / 坩埚炉 */
  furnaceId: string
  /** 色号 */
  colorCode: string
  /** 配方 */
  recipe: string
  /** 熔化日期 YYYY-MM-DD */
  meltDate: string
  /** 出料温度（℃） */
  tempC: number
  /** 剩余量（kg） */
  remainKg: number
  createdAt: string
  updatedAt: string
  revision: number
}

/** 新建 / 编辑料液批次的表单草稿 */
export interface GlassBatchDraft {
  furnaceId: string
  colorCode: string
  recipe: string
  meltDate: string
  tempC: number
  remainKg: number
}
