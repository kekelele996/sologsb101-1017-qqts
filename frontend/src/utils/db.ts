/**
 * IndexedDB 持久化层（Dexie 封装）
 * - 数据库名：gbglassblow
 * - 含数据结构版本号与升级迁移逻辑；v1 → v2 为 Piece 增加 craft 索引并回填默认值
 * - 提供各表增删改查、作品状态联动、整库快照导入导出与重置
 * 纯前端应用：不依赖任何后端服务或外部接口。
 */
import Dexie, { type Table, type Transaction } from 'dexie'
import type { Furnace } from '../types/furnace'
import type { GlassBatch } from '../types/batch'
import type { Piece, PieceState } from '../types/piece'
import type { Step, StepState } from '../types/step'
import type { Anneal } from '../types/anneal'
import type { Inspect } from '../types/inspect'
import { nowIso } from './id'
import { seedDatabase } from './seed'
import { round1 } from './thermal'

/** 数据库名 */
export const DB_NAME = 'gbglassblow'

/** 当前数据结构版本号（每次调整字段结构必须 +1 并补迁移） */
export const DB_SCHEMA_VERSION = 3

/** 数据行结构修订号 */
export const ROW_REVISION = 3

class GlassBlowDatabase extends Dexie {
  furnaces!: Table<Furnace, string>
  batches!: Table<GlassBatch, string>
  pieces!: Table<Piece, string>
  steps!: Table<Step, string>
  anneals!: Table<Anneal, string>
  inspects!: Table<Inspect, string>

  constructor() {
    super(DB_NAME)

    // ---------- v1：初版结构 ----------
    this.version(1).stores({
      furnaces: 'id, code, type, state, fuelType, createdAt',
      batches: 'id, furnaceId, colorCode, meltDate',
      pieces: 'id, batchId, state, artist',
      steps: 'id, pieceId, [pieceId+seq], seq',
      anneals: 'id, pieceId, kilnSlot, state, inAt',
      inspects: 'id, pieceId, date, result',
    })

    // ---------- v2：Piece 增加 craft 索引并回填默认值，补齐其余索引与字段 ----------
    this.version(DB_SCHEMA_VERSION)
      .stores({
        furnaces: 'id, code, type, state, fuelType, createdAt, updatedAt',
        batches: 'id, furnaceId, colorCode, meltDate, remainKg',
        // craft 为 v2 新增索引
        pieces: 'id, batchId, state, artist, craft, name',
        steps: 'id, pieceId, [pieceId+seq], seq, state, name',
        anneals: 'id, pieceId, kilnSlot, state, inAt, curveSeg',
        inspects: 'id, pieceId, date, result, inspector',
      })
      .upgrade(async (tx) => {
        // 迁移 1：补齐 revision / createdAt / updatedAt
        const tables = [
          tx.table('furnaces'),
          tx.table('batches'),
          tx.table('pieces'),
          tx.table('steps'),
          tx.table('anneals'),
          tx.table('inspects'),
        ]
        for (const table of tables) {
          await table.toCollection().modify((row: Record<string, unknown>) => {
            row.revision = ROW_REVISION
            if (typeof row.createdAt !== 'string') row.createdAt = nowIso()
            if (typeof row.updatedAt !== 'string') row.updatedAt = row.createdAt
          })
        }
        // 迁移 2：Piece 补齐 craft 字段（历史作品默认按吹制归类）
        await tx.table('pieces').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.craft !== 'string' || row.craft === '') row.craft = '吹制'
          if (typeof row.state !== 'string' || row.state === '') row.state = '设计中'
        })
        // 迁移 3：历史工序默认视为已执行完成，避免升级后被误判为待办
        await tx.table('steps').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.state !== 'string' || row.state === '') row.state = '已完成'
          if (typeof row.remark !== 'string') row.remark = ''
        })
        // 迁移 4：退火记录补齐出炉时间与曲线段
        await tx.table('anneals').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.outAt !== 'string') row.outAt = ''
          if (typeof row.curveSeg !== 'string' || row.curveSeg === '') row.curveSeg = '缓冷'
        })
        // 迁移 5：检验记录补齐缺陷说明
        await tx.table('inspects').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.defectNote !== 'string') row.defectNote = ''
        })
      })

    // ---------- v3：料液批次登记初始量；取料工序记录实际取料量与扣减快照 ----------
    // 索引不变（新字段均非索引），只需声明完整表结构并在 upgrade 中回填字段
    this.version(DB_SCHEMA_VERSION)
      .stores({
        furnaces: 'id, code, type, state, fuelType, createdAt, updatedAt',
        batches: 'id, furnaceId, colorCode, meltDate, remainKg',
        pieces: 'id, batchId, state, artist, craft, name',
        steps: 'id, pieceId, [pieceId+seq], seq, state, name',
        anneals: 'id, pieceId, kilnSlot, state, inAt, curveSeg',
        inspects: 'id, pieceId, date, result, inspector',
      })
      .upgrade(async (tx) => {
        // 迁移 1：料液批次补齐初始量（历史批次以当前剩余量作为台账基准，不追补已用量）
        await tx.table('batches').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.initialKg !== 'number' || Number.isNaN(row.initialKg)) {
            row.initialKg = typeof row.remainKg === 'number' ? row.remainKg : 0
          }
        })
        // 迁移 2：工序补齐取料计量与扣减快照字段。
        // 历史已完成取料视为「未计量」：不追溯扣减批次剩余量，只在作品侧展示未计量。
        await tx.table('steps').toCollection().modify((row: Record<string, unknown>) => {
          if (typeof row.gatherKg !== 'number') row.gatherKg = null
          if (typeof row.consumedBatchId !== 'string') row.consumedBatchId = ''
          if (typeof row.consumedKg !== 'number') row.consumedKg = 0
        })
      })
  }
}

export const db = new GlassBlowDatabase()

/* ------------------------------ 初始化与播种 ------------------------------ */

let initPromise: Promise<void> | null = null

/**
 * 打开数据库并在首屏自动播种演示数据（幂等：仅当主表为空时播种）。
 * 多次调用共用同一个 Promise，避免并发重复播种。
 */
export function initDatabase(): Promise<void> {
  if (initPromise === null) {
    initPromise = (async (): Promise<void> => {
      await db.open()
      // 首屏自动播种演示数据：仅当主表为空时执行（幂等）
      if ((await db.furnaces.count()) === 0) {
        await seedDatabase()
      }
    })()
  }
  return initPromise
}

/* -------------------------------- 窑炉 -------------------------------- */

export async function listFurnaces(): Promise<Furnace[]> {
  const rows = await db.furnaces.toArray()
  return rows.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'))
}

export async function putFurnace(row: Furnace): Promise<void> {
  await db.furnaces.put({ ...row, updatedAt: nowIso(), revision: ROW_REVISION })
}

/** 窑炉下是否还有作品通过料液批次引用它（删除保护用） */
export class BatchReferenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BatchReferenceError'
  }
}

/** 删除窑炉：级联清理其料液批次；批次仍被作品引用时拒绝删除 */
export async function removeFurnace(id: string): Promise<void> {
  await db.transaction('rw', db.furnaces, db.batches, db.pieces, async () => {
    const batchIds = (await db.batches.where('furnaceId').equals(id).toArray()).map((row) => row.id)
    if (batchIds.length > 0) {
      const referenced = await db.pieces.where('batchId').anyOf(batchIds).count()
      if (referenced > 0) {
        throw new BatchReferenceError(`该窑炉下还有 ${referenced} 件作品引用其料液批次，请先改挂或删除相关作品`)
      }
    }
    await db.batches.where('furnaceId').equals(id).delete()
    await db.furnaces.delete(id)
  })
}

/* ------------------------------ 料液批次 ------------------------------ */

export async function listBatches(): Promise<GlassBatch[]> {
  const rows = await db.batches.toArray()
  return rows.sort((a, b) => b.meltDate.localeCompare(a.meltDate))
}

export async function putBatch(row: GlassBatch): Promise<void> {
  await db.batches.put({ ...row, updatedAt: nowIso(), revision: ROW_REVISION })
}

/** 删除料液批次：仍被作品引用时拒绝，避免作品失去批次后取料无法扣减 */
export async function removeBatch(id: string): Promise<void> {
  const referenced = await db.pieces.where('batchId').equals(id).count()
  if (referenced > 0) {
    const batch = await db.batches.get(id)
    throw new BatchReferenceError(
      `料液批次「${batch?.colorCode ?? id}」仍被 ${referenced} 件作品引用，请先把这些作品改挂到其他批次`,
    )
  }
  await db.batches.delete(id)
}

/** 取料：按剩余量扣减（不足时扣到 0 并返回实际扣减量） */
export async function consumeBatch(batchId: string, kg: number): Promise<number> {
  const batch = await db.batches.get(batchId)
  if (!batch) return 0
  const actual = Math.max(0, Math.min(batch.remainKg, kg))
  await db.batches.update(batchId, { remainKg: Math.round((batch.remainKg - actual) * 10) / 10, updatedAt: nowIso() })
  return actual
}

/* -------------------------------- 作品 -------------------------------- */

export async function listPieces(): Promise<Piece[]> {
  const rows = await db.pieces.toArray()
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function putPiece(row: Piece): Promise<void> {
  await db.pieces.put({ ...row, updatedAt: nowIso(), revision: ROW_REVISION })
}

/** 删除作品：级联清理工序、退火与检验记录 */
export async function removePiece(id: string): Promise<void> {
  await db.transaction('rw', db.pieces, db.steps, db.anneals, db.inspects, async () => {
    await db.steps.where('pieceId').equals(id).delete()
    await db.anneals.where('pieceId').equals(id).delete()
    await db.inspects.where('pieceId').equals(id).delete()
    await db.pieces.delete(id)
  })
}

/**
 * 依工序与退火、检验记录推导并回写作品状态。
 * 规则：有检验记录 → 已检验；有已出炉退火 → 已退火；有工序记录 → 制作中；否则设计中。
 */
export async function syncPieceState(pieceId: string): Promise<PieceState | null> {
  const piece = await db.pieces.get(pieceId)
  if (!piece) return null
  const [steps, anneals, inspects] = await Promise.all([
    db.steps.where('pieceId').equals(pieceId).toArray(),
    db.anneals.where('pieceId').equals(pieceId).toArray(),
    db.inspects.where('pieceId').equals(pieceId).toArray(),
  ])

  let next: PieceState = '设计中'
  if (steps.length > 0) next = '制作中'
  if (anneals.some((row) => row.state === '已出炉')) next = '已退火'
  if (inspects.length > 0) next = '已检验'

  if (next !== piece.state) {
    await db.pieces.update(pieceId, { state: next, updatedAt: nowIso() })
  }
  return next
}

/* -------------------------------- 工序 -------------------------------- */

export async function listSteps(): Promise<Step[]> {
  const rows = await db.steps.toArray()
  return rows.sort((a, b) => a.pieceId.localeCompare(b.pieceId) || a.seq - b.seq)
}

export async function listStepsByPiece(pieceId: string): Promise<Step[]> {
  const rows = await db.steps.where('pieceId').equals(pieceId).toArray()
  return rows.sort((a, b) => a.seq - b.seq)
}

/** 取料扣减结算结果 */
export interface GatherSettle {
  /** 被扣减的批次 id */
  batchId: string
  /** 批次色号（提示文案用） */
  colorCode: string
  /** 实际扣减量（kg） */
  kg: number
  /** 扣减后的批次剩余量（kg） */
  remainKg: number
}

/** 工序保存结果：仅当本次写入触发了取料扣减时有值 */
export interface SaveStepResult {
  settle: GatherSettle | null
}

/** 事务内推导并回写作品状态（规则同 syncPieceState） */
async function resyncPieceStateInTx(tx: Transaction, pieceId: string): Promise<PieceState> {
  const [piece, stepRows, annealRows, inspectRows] = await Promise.all([
    tx.table<Piece, string>('pieces').get(pieceId),
    tx.table<Step, string>('steps').where('pieceId').equals(pieceId).toArray(),
    tx.table<Anneal, string>('anneals').where('pieceId').equals(pieceId).toArray(),
    tx.table<Inspect, string>('inspects').where('pieceId').equals(pieceId).toArray(),
  ])
  let next: PieceState = '设计中'
  if (stepRows.length > 0) next = '制作中'
  if (annealRows.some((row) => row.state === '已出炉')) next = '已退火'
  if (inspectRows.length > 0) next = '已检验'
  if (piece && next !== piece.state) {
    await tx.table<Piece, string>('pieces').update(pieceId, { state: next, updatedAt: nowIso() })
  }
  return next
}

/** 取料扣减校验失败（未挂批次 / 批次缺失 / 未填报取料量 / 余量不足） */
export class GatherRequirementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatherRequirementError'
  }
}

/**
 * 保存工序（新建 / 编辑），并在同一事务内结算「取料」工序的料液扣减：
 * - 仅当工序名为「取料」且状态为「已完成」时产生扣减；
 * - 旧记录若已扣减，先把料退回原批次快照（回退状态、改名、删除均走这条回退路径）；
 * - 新记录按作品当前挂的批次扣减填报取料量；未挂批次、批次已删、未填报或余量不足均拦下；
 * - 扣减量与批次 id 快照写在工序上，作品事后改挂批次不影响历史账。
 */
export async function saveStep(input: Step): Promise<SaveStepResult> {
  let settle: GatherSettle | null = null
  await db.transaction(
    'rw',
    db.steps,
    db.pieces,
    db.batches,
    db.anneals,
    db.inspects,
    async (tx) => {
      const old = await tx.table<Step, string>('steps').get(input.id)

      // 1) 回退旧记录已发生的扣减（退回扣减时记录的批次；批次已删则无法退回，跳过）
      if (old && old.consumedBatchId !== '' && old.consumedKg > 0) {
        const oldBatch = await tx.table<GlassBatch, string>('batches').get(old.consumedBatchId)
        if (oldBatch) {
          await tx.table<GlassBatch, string>('batches').update(oldBatch.id, {
            remainKg: round1(oldBatch.remainKg + old.consumedKg),
            updatedAt: nowIso(),
          })
        }
      }

      let consumedBatchId = ''
      let consumedKg = 0

      // 2) 新记录若为已完成的取料工序，按作品所挂批次扣减
      if (input.name === '取料' && input.state === '已完成') {
        const piece = await tx.table<Piece, string>('pieces').get(input.pieceId)
        if (!piece || piece.batchId === '') {
          throw new GatherRequirementError('该作品尚未挂料液批次，请先在作品登记中补挂批次，再完成取料工序')
        }
        const batch = await tx.table<GlassBatch, string>('batches').get(piece.batchId)
        if (!batch) {
          throw new GatherRequirementError('作品所挂的料液批次已不存在，请先在作品登记中改挂现存批次，再完成取料工序')
        }
        const kg = input.gatherKg === null ? 0 : round1(input.gatherKg)
        if (!(kg > 0)) {
          throw new GatherRequirementError('请先在取料工序中填写本次实际取料量（kg），再推进到已完成')
        }
        if (kg > batch.remainKg) {
          throw new GatherRequirementError(
            `批次「${batch.colorCode}」剩余 ${batch.remainKg} kg，不足本次取料 ${kg} kg，请补料或改挂批次`,
          )
        }
        const remainKg = round1(batch.remainKg - kg)
        await tx.table<GlassBatch, string>('batches').update(batch.id, {
          remainKg,
          updatedAt: nowIso(),
        })
        consumedBatchId = batch.id
        consumedKg = kg
        settle = { batchId: batch.id, colorCode: batch.colorCode, kg, remainKg }
      }

      const next: Step = {
        ...input,
        gatherKg: input.name === '取料' ? input.gatherKg : null,
        consumedBatchId,
        consumedKg,
        updatedAt: nowIso(),
        revision: ROW_REVISION,
      }
      await tx.table<Step, string>('steps').put(next)
      await resyncPieceStateInTx(tx, input.pieceId)
    },
  )
  return { settle }
}

/** 删除工序：若为已扣减的取料工序，在同一事务内把料退回原批次 */
export async function removeStep(id: string): Promise<void> {
  await db.transaction('rw', db.steps, db.pieces, db.batches, db.anneals, db.inspects, async (tx) => {
    const step = await tx.table<Step, string>('steps').get(id)
    if (!step) return
    if (step.consumedBatchId !== '' && step.consumedKg > 0) {
      const batch = await tx.table<GlassBatch, string>('batches').get(step.consumedBatchId)
      if (batch) {
        await tx.table<GlassBatch, string>('batches').update(batch.id, {
          remainKg: round1(batch.remainKg + step.consumedKg),
          updatedAt: nowIso(),
        })
      }
    }
    await tx.table<Step, string>('steps').delete(id)
    await resyncPieceStateInTx(tx, step.pieceId)
  })
}

/** 推进工序状态结果 */
export interface AdvanceStepResult {
  step: Step
  next: StepState
  settle: GatherSettle | null
}

/**
 * 推进工序状态：未开始 → 进行中 → 已完成。
 * 推进「取料」到已完成时校验取料量并扣减；可传入 gatherKg 完成「填报即推进」。
 */
export async function advanceStepState(
  stepId: string,
  gatherKgOverride?: number,
): Promise<AdvanceStepResult | null> {
  const existing = await db.steps.get(stepId)
  if (!existing) return null
  const flow: StepState[] = ['未开始', '进行中', '已完成']
  const index = flow.indexOf(existing.state)
  if (index < 0 || index >= flow.length - 1) {
    return { step: existing, next: existing.state, settle: null }
  }
  const next = flow[index + 1]
  const gatherKg =
    existing.name === '取料' && gatherKgOverride !== undefined ? round1(gatherKgOverride) : existing.gatherKg
  const { settle } = await saveStep({ ...existing, state: next, gatherKg })
  return { step: { ...existing, state: next, gatherKg }, next, settle }
}

/** 按给定 id 顺序重写工序序号（拖拽排序后调用） */
export async function reorderSteps(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.steps, async () => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await db.steps.update(orderedIds[index], { seq: index + 1, updatedAt: nowIso() })
    }
  })
}

/* -------------------------------- 退火 -------------------------------- */

export async function listAnneals(): Promise<Anneal[]> {
  const rows = await db.anneals.toArray()
  return rows.sort((a, b) => a.inAt.localeCompare(b.inAt))
}

export async function listAnnealsByPiece(pieceId: string): Promise<Anneal[]> {
  return db.anneals.where('pieceId').equals(pieceId).toArray()
}

export async function putAnneal(row: Anneal): Promise<void> {
  await db.anneals.put({ ...row, updatedAt: nowIso(), revision: ROW_REVISION })
  await syncPieceState(row.pieceId)
}

export async function removeAnneal(id: string): Promise<void> {
  const row = await db.anneals.get(id)
  if (!row) return
  await db.anneals.delete(id)
  await syncPieceState(row.pieceId)
}

/** 推进退火状态；「已出炉」时写回出炉时间并同步作品状态 */
export async function advanceAnnealState(annealId: string, next: Anneal['state'], outAt: string): Promise<void> {
  const row = await db.anneals.get(annealId)
  if (!row) return
  await db.anneals.update(annealId, { state: next, outAt: next === '已出炉' ? outAt : row.outAt, updatedAt: nowIso() })
  await syncPieceState(row.pieceId)
}

/* ------------------------------ 出炉检验 ------------------------------ */

export async function listInspects(): Promise<Inspect[]> {
  const rows = await db.inspects.toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export async function listInspectsByPiece(pieceId: string): Promise<Inspect[]> {
  const rows = await db.inspects.where('pieceId').equals(pieceId).toArray()
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

export async function putInspect(row: Inspect): Promise<void> {
  await db.inspects.put({ ...row, updatedAt: nowIso(), revision: ROW_REVISION })
  await syncPieceState(row.pieceId)
}

export async function removeInspect(id: string): Promise<void> {
  const row = await db.inspects.get(id)
  if (!row) return
  await db.inspects.delete(id)
  await syncPieceState(row.pieceId)
}

/* ---------------------------- 整库快照 ---------------------------- */

export interface DatabaseSnapshot {
  name: string
  schemaVersion: number
  exportedAt: string
  furnaces: Furnace[]
  batches: GlassBatch[]
  pieces: Piece[]
  steps: Step[]
  anneals: Anneal[]
  inspects: Inspect[]
}

export async function exportSnapshot(): Promise<DatabaseSnapshot> {
  const [furnaces, batches, pieces, steps, anneals, inspects] = await Promise.all([
    db.furnaces.toArray(),
    db.batches.toArray(),
    db.pieces.toArray(),
    db.steps.toArray(),
    db.anneals.toArray(),
    db.inspects.toArray(),
  ])
  return { name: DB_NAME, schemaVersion: DB_SCHEMA_VERSION, exportedAt: nowIso(), furnaces, batches, pieces, steps, anneals, inspects }
}

export async function importSnapshot(snapshot: DatabaseSnapshot): Promise<void> {
  await db.transaction('rw', [db.furnaces, db.batches, db.pieces, db.steps, db.anneals, db.inspects], async () => {
    await Promise.all([
      db.furnaces.clear(),
      db.batches.clear(),
      db.pieces.clear(),
      db.steps.clear(),
      db.anneals.clear(),
      db.inspects.clear(),
    ])
    await db.furnaces.bulkPut(snapshot.furnaces.map((row) => ({ ...row, revision: ROW_REVISION })))
    await db.batches.bulkPut(
      snapshot.batches.map((row) => ({
        ...row,
        // 兼容 v2 存档：缺初始量时以剩余量为基准
        initialKg: typeof row.initialKg === 'number' ? row.initialKg : row.remainKg,
        revision: ROW_REVISION,
      })),
    )
    await db.pieces.bulkPut(snapshot.pieces.map((row) => ({ ...row, revision: ROW_REVISION })))
    await db.steps.bulkPut(
      snapshot.steps.map((row) => ({
        ...row,
        gatherKg: typeof row.gatherKg === 'number' ? row.gatherKg : null,
        consumedBatchId: typeof row.consumedBatchId === 'string' ? row.consumedBatchId : '',
        consumedKg: typeof row.consumedKg === 'number' ? row.consumedKg : 0,
        revision: ROW_REVISION,
      })),
    )
    await db.anneals.bulkPut(snapshot.anneals.map((row) => ({ ...row, revision: ROW_REVISION })))
    await db.inspects.bulkPut(snapshot.inspects.map((row) => ({ ...row, revision: ROW_REVISION })))
  })
}

export async function resetDatabase(): Promise<void> {
  await db.transaction('rw', [db.furnaces, db.batches, db.pieces, db.steps, db.anneals, db.inspects], async () => {
    await Promise.all([
      db.furnaces.clear(),
      db.batches.clear(),
      db.pieces.clear(),
      db.steps.clear(),
      db.anneals.clear(),
      db.inspects.clear(),
    ])
  })
  await seedDatabase()
}

export async function countAll(): Promise<Record<string, number>> {
  const [furnaces, batches, pieces, steps, anneals, inspects] = await Promise.all([
    db.furnaces.count(),
    db.batches.count(),
    db.pieces.count(),
    db.steps.count(),
    db.anneals.count(),
    db.inspects.count(),
  ])
  return { furnaces, batches, pieces, steps, anneals, inspects }
}
