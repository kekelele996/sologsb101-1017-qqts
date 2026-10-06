/**
 * 吹制工序（Step）
 * 逐道记录温度、时长与操作人；任一前序未完成则阻断进入退火排位。
 */

/** 工序名称 */
export type StepName = '取料' | '吹制' | '塑形' | '开模' | '收口'

/** 工序执行状态 */
export type StepState = '未开始' | '进行中' | '已完成'

export const STEP_NAME_OPTIONS: StepName[] = ['取料', '吹制', '塑形', '开模', '收口']
export const STEP_STATE_OPTIONS: StepState[] = ['未开始', '进行中', '已完成']

export interface Step {
  id: string
  /** 所属作品 */
  pieceId: string
  /** 工序序号，从 1 开始 */
  seq: number
  /** 工序名称 */
  name: StepName
  /** 工序温度（℃） */
  tempC: number
  /** 时长（分钟） */
  durationMin: number
  /** 操作人 */
  operator: string
  /** 备注 */
  remark: string
  /** 工序状态 */
  state: StepState
  /**
   * 取料工序的实际取料量（kg），仅 name === '取料' 时有值；
   * 推进到「已完成」前由操作工填报，未填则拦下要求补填。
   */
  gatherKg: number | null
  /** 完成取料时实际扣减的料液批次快照（防止作品事后改挂批次导致账实不符） */
  consumedBatchId: string
  /** 完成取料时实际扣减量（kg）；0 表示该工序尚未产生扣减（含历史未计量数据） */
  consumedKg: number
  createdAt: string
  updatedAt: string
  revision: number
}

/** 新建 / 编辑吹制工序的表单草稿 */
export interface StepDraft {
  pieceId: string
  seq: number
  name: StepName
  tempC: number
  durationMin: number
  operator: string
  remark: string
  state: StepState
  /** 取料实际取料量（kg），仅取料工序可填 */
  gatherKg: number | null
}
