/**
 * 作品（Piece）
 * 新建后进入工序编辑；状态由最后一道工序与退火记录共同推进。
 */

/** 工艺：吹制 / 铸造 / 热塑 */
export type Craft = '吹制' | '铸造' | '热塑'

/** 作品状态：设计中 / 制作中 / 已退火 / 已检验 */
export type PieceState = '设计中' | '制作中' | '已退火' | '已检验'

export const CRAFT_OPTIONS: Craft[] = ['吹制', '铸造', '热塑']
export const PIECE_STATE_OPTIONS: PieceState[] = ['设计中', '制作中', '已退火', '已检验']

/** 状态推进顺序 */
export const PIECE_STATE_FLOW: PieceState[] = ['设计中', '制作中', '已退火', '已检验']

export interface Piece {
  id: string
  /** 作品名 */
  name: string
  /** 使用的料液批次 */
  batchId: string
  /** 设计高度（mm） */
  designHeightMm: number
  /** 壁厚（mm） */
  wallThicknessMm: number
  /** 工艺 */
  craft: Craft
  /** 创作者 */
  artist: string
  /** 作品状态 */
  state: PieceState
  createdAt: string
  updatedAt: string
  revision: number
}

/** 新建 / 编辑作品的表单草稿 */
export interface PieceDraft {
  name: string
  batchId: string
  designHeightMm: number
  wallThicknessMm: number
  craft: Craft
  artist: string
  state: PieceState
}
