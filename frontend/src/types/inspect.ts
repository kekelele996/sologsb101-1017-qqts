/**
 * 出炉检验（Inspect）
 * 判定不合格时生成返工提示并保留原始工序记录。
 */

/** 检验结果：合格 / 裂纹 / 气泡 / 变形 */
export type InspectResult = '合格' | '裂纹' | '气泡' | '变形'

export const INSPECT_RESULT_OPTIONS: InspectResult[] = ['合格', '裂纹', '气泡', '变形']

export interface Inspect {
  id: string
  /** 所属作品 */
  pieceId: string
  /** 检验结果 */
  result: InspectResult
  /** 缺陷说明 */
  defectNote: string
  /** 检验人 */
  inspector: string
  /** 检验日期 YYYY-MM-DD */
  date: string
  createdAt: string
  updatedAt: string
  revision: number
}

/** 新建 / 编辑出炉检验的表单草稿 */
export interface InspectDraft {
  pieceId: string
  result: InspectResult
  defectNote: string
  inspector: string
  date: string
}
