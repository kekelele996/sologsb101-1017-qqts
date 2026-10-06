<script setup lang="ts">
/**
 * /furnaces 窑炉与料液台账
 * 新建窑炉、登记料液批次与剩余量；取料按剩余量扣减，低于阈值高亮提示补料。
 * 消费模型：Furnace、GlassBatch；复用组件：<StageTag>、<EmptyPanel>、<FilterBar>、<StatBadge>
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import EmptyPanel from '@/components/common/EmptyPanel.vue'
import FilterBar from '@/components/common/FilterBar.vue'
import StatBadge from '@/components/common/StatBadge.vue'
import StageTag from '@/components/common/StageTag.vue'
import { useFurnaceStore } from '@/stores/furnaceStore'
import {
  FUEL_TYPE_OPTIONS,
  FURNACE_STATE_OPTIONS,
  FURNACE_TYPE_OPTIONS,
  type FuelType,
  type Furnace,
  type FurnaceDraft,
  type FurnaceState,
  type FurnaceType,
} from '@/types/furnace'
import type { GlassBatch, GlassBatchDraft } from '@/types/batch'
import { LOW_REMAIN_KG, isLowRemain } from '@/utils/thermal'
import { today } from '@/utils/id'

const store = useFurnaceStore()

const furnaceDialog = ref(false)
const batchDialog = ref(false)
const consumeDialog = ref(false)
const submitting = ref(false)
const editingFurnaceId = ref<string | null>(null)
const editingBatchId = ref<string | null>(null)
const consumeTarget = ref<GlassBatch | null>(null)
const consumeKg = ref(5)
const refillKg = ref(50)
const furnaceFormRef = ref<FormInstance>()
const batchFormRef = ref<FormInstance>()
const selectedFurnaceId = ref<string>('all')

const furnaceForm = reactive<FurnaceDraft>({
  code: '',
  type: '熔化炉',
  maxTempC: 1250,
  fuelType: '燃气',
  state: '停窑',
})

const batchForm = reactive<GlassBatchDraft>({
  furnaceId: '',
  colorCode: '',
  recipe: '',
  meltDate: today(),
  tempC: 1150,
  remainKg: 200,
})

const furnaceRules: FormRules<FurnaceDraft> = {
  code: [{ required: true, message: '请填写窑号', trigger: 'blur' }],
  type: [{ required: true, message: '请选择窑炉类型', trigger: 'change' }],
  maxTempC: [{ required: true, message: '请填写最高温度', trigger: 'blur' }],
  fuelType: [{ required: true, message: '请选择燃料类型', trigger: 'change' }],
  state: [{ required: true, message: '请选择运行状态', trigger: 'change' }],
}

const batchRules: FormRules<GlassBatchDraft> = {
  furnaceId: [{ required: true, message: '请选择所属窑炉', trigger: 'change' }],
  colorCode: [{ required: true, message: '请填写色号', trigger: 'blur' }],
  recipe: [{ required: true, message: '请填写配方', trigger: 'blur' }],
  meltDate: [{ required: true, message: '请选择熔化日期', trigger: 'change' }],
  tempC: [{ required: true, message: '请填写出料温度', trigger: 'blur' }],
  remainKg: [{ required: true, message: '请填写剩余量', trigger: 'blur' }],
}

const batches = computed<GlassBatch[]>(() =>
  selectedFurnaceId.value === 'all'
    ? store.batches
    : store.batches.filter((row) => row.furnaceId === selectedFurnaceId.value)
)

const furnaceLabel = computed<Record<string, string>>(() =>
  Object.fromEntries(store.furnaces.map((row) => [row.id, `${row.code} · ${row.type}`]))
)

const totals = computed(() => ({
  totalRemain: Math.round(store.batches.reduce((acc, row) => acc + row.remainKg, 0) * 10) / 10,
  lowCount: store.lowRemainBatches.length,
  runningCount: store.furnaces.filter((row) => row.state === '运行').length,
  meltFurnaces: store.meltingFurnaces.length,
  annealFurnaces: store.annealingFurnaces.length,
}))

onMounted(() => {
  void store.loadAll()
})

function openCreateFurnace(): void {
  editingFurnaceId.value = null
  Object.assign(furnaceForm, {
    code: '',
    type: '熔化炉' as FurnaceType,
    maxTempC: 1250,
    fuelType: '燃气' as FuelType,
    state: '停窑' as FurnaceState,
  })
  furnaceDialog.value = true
}

function openEditFurnace(row: Furnace): void {
  editingFurnaceId.value = row.id
  Object.assign(furnaceForm, {
    code: row.code,
    type: row.type,
    maxTempC: row.maxTempC,
    fuelType: row.fuelType,
    state: row.state,
  })
  furnaceDialog.value = true
}

async function submitFurnace(): Promise<void> {
  if (furnaceFormRef.value === undefined) return
  const valid = await furnaceFormRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editingFurnaceId.value === null) {
      await store.createFurnace({ ...furnaceForm })
      ElMessage.success('窑炉已登记')
    } else {
      await store.updateFurnace(editingFurnaceId.value, { ...furnaceForm })
      ElMessage.success('窑炉信息已更新')
    }
    furnaceDialog.value = false
  } finally {
    submitting.value = false
  }
}

async function deleteFurnace(row: Furnace): Promise<void> {
  try {
    await ElMessageBox.confirm(`将删除「${row.code}」及其全部料液批次，且不可恢复。`, '确认删除窑炉？', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await store.deleteFurnace(row.id)
  ElMessage.success('窑炉已删除')
}

function openCreateBatch(): void {
  editingBatchId.value = null
  Object.assign(batchForm, {
    furnaceId: store.meltingFurnaces[0]?.id ?? store.furnaces[0]?.id ?? '',
    colorCode: '',
    recipe: '',
    meltDate: today(),
    tempC: 1150,
    remainKg: 200,
  })
  batchDialog.value = true
}

function openEditBatch(row: GlassBatch): void {
  editingBatchId.value = row.id
  Object.assign(batchForm, {
    furnaceId: row.furnaceId,
    colorCode: row.colorCode,
    recipe: row.recipe,
    meltDate: row.meltDate,
    tempC: row.tempC,
    remainKg: row.remainKg,
  })
  batchDialog.value = true
}

async function submitBatch(): Promise<void> {
  if (batchFormRef.value === undefined) return
  const valid = await batchFormRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (editingBatchId.value === null) {
      await store.createBatch({ ...batchForm })
      ElMessage.success('料液批次已登记')
    } else {
      await store.updateBatch(editingBatchId.value, { ...batchForm })
      ElMessage.success('料液批次已更新')
    }
    batchDialog.value = false
  } finally {
    submitting.value = false
  }
}

async function deleteBatch(row: GlassBatch): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除料液批次「${row.colorCode}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  await store.deleteBatch(row.id)
  ElMessage.success('料液批次已删除')
}

function openConsume(row: GlassBatch): void {
  consumeTarget.value = row
  consumeKg.value = Math.min(10, row.remainKg)
  consumeDialog.value = true
}

async function submitConsume(): Promise<void> {
  const target = consumeTarget.value
  if (target === null) return
  const actual = await store.consume(target.id, consumeKg.value)
  ElMessage.success(`已取料 ${actual} kg`)
  if (isLowRemain(target.remainKg - actual)) {
    ElMessage.warning(`${target.colorCode} 剩余量低于 ${LOW_REMAIN_KG} kg，请及时补料`, )
  }
  consumeDialog.value = false
}

async function submitRefill(row: GlassBatch): Promise<void> {
  await store.refill(row.id, refillKg.value)
  ElMessage.success(`已补料 ${refillKg.value} kg`)
}

function batchRowClass({ row }: { row: GlassBatch }): string {
  return isLowRemain(row.remainKg) ? 'row-low-remain' : ''
}

function handleFurnaceFilter(key: string, value: string): void {
  if (key === 'type') store.setFilters({ type: value as FurnaceType | 'all' })
  if (key === 'state') store.setFilters({ state: value as FurnaceState | 'all' })
}
</script>

<template>
  <div>
    <div class="stat-row">
      <StatBadge label="窑炉总数" :value="store.furnaces.length" suffix="台" tone="primary" icon="Histogram" />
      <StatBadge label="熔化/坩埚炉" :value="totals.meltFurnaces" suffix="台" tone="warning" icon="DataLine" />
      <StatBadge label="退火窑" :value="totals.annealFurnaces" suffix="台" tone="info" icon="Histogram" />
      <StatBadge label="运行中" :value="totals.runningCount" suffix="台" tone="success" icon="TrendCharts" />
      <StatBadge label="料液批次" :value="store.batches.length" suffix="批" tone="primary" icon="PieChart" />
      <StatBadge label="剩余总量" :value="totals.totalRemain" suffix="kg" tone="info" icon="TrendCharts" />
      <StatBadge
        label="低于补料阈值"
        :value="totals.lowCount"
        suffix="批"
        :tone="totals.lowCount > 0 ? 'danger' : 'success'"
        icon="Warning"
        :hint="`剩余量低于 ${LOW_REMAIN_KG} kg 的料液批次数量`"
      />
    </div>

    <el-alert
      v-if="store.lowRemainBatches.length > 0"
      type="warning"
      show-icon
      :closable="false"
      class="mb-14"
      :title="`有 ${store.lowRemainBatches.length} 批料液剩余量低于 ${LOW_REMAIN_KG} kg，请安排补料`"
    >
      <template #default>
        <div class="low-list">
          <div v-for="row in store.lowRemainBatches" :key="row.id">
            {{ row.colorCode }}（{{ furnaceLabel[row.furnaceId] ?? '未知窑炉' }}）剩余
            <b>{{ row.remainKg }} kg</b> —— {{ row.recipe }}
          </div>
        </div>
      </template>
    </el-alert>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-header__title">窑炉台账</span>
          <el-button type="primary" @click="openCreateFurnace">
            <el-icon><Plus /></el-icon>
            <span>新建窑炉</span>
          </el-button>
        </div>
      </template>

      <FilterBar
        :keyword="store.filters.keyword"
        :fields="[
          { key: 'type', label: '窑炉类型', options: FURNACE_TYPE_OPTIONS as unknown as string[] },
          { key: 'state', label: '运行状态', options: FURNACE_STATE_OPTIONS as unknown as string[] },
        ]"
        :values="{ type: store.filters.type, state: store.filters.state }"
        :result-text="`命中 ${store.visibleFurnaces.length} / ${store.furnaces.length} 台`"
        @update:keyword="(value: string) => store.setFilters({ keyword: value })"
        @change="handleFurnaceFilter"
        @reset="store.resetFilters()"
      />

      <EmptyPanel
        v-if="store.ready && store.furnaces.length === 0"
        title="还没有窑炉"
        description="先登记熔化炉 / 坩埚炉 / 退火窑，再挂料液批次或分配退火窑位。"
        action-text="新建第一台窑炉"
        @action="openCreateFurnace"
      />

      <el-table v-else v-loading="!store.ready" :data="store.visibleFurnaces" row-key="id" stripe>
        <el-table-column label="窑号 / 类型" min-width="180">
          <template #default="{ row }">
            <div class="cell-stack">
              <span class="cell-strong">{{ row.code }}</span>
              <span class="cell-sub">{{ row.type }} · {{ row.fuelType }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="130">
          <template #default="{ row }">
            <el-space>
              <StageTag :furnace-state="row.state" size="small" />
              <el-tag size="small" :type="row.type === '退火窑' ? 'primary' : 'warning'">{{ row.type }}</el-tag>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="最高温度" width="110" align="right">
          <template #default="{ row }">{{ row.maxTempC }} ℃</template>
        </el-table-column>
        <el-table-column label="料液批次" width="110" align="right">
          <template #default="{ row }">{{ store.statOf(row.id).batchCount }} 批</template>
        </el-table-column>
        <el-table-column label="剩余合计" width="120" align="right">
          <template #default="{ row }">{{ store.statOf(row.id).totalRemainKg }} kg</template>
        </el-table-column>
        <el-table-column label="关联作品" width="110" align="right">
          <template #default="{ row }">{{ store.statOf(row.id).pieceCount }} 件</template>
        </el-table-column>
        <el-table-column label="低于阈值" width="110" align="right">
          <template #default="{ row }">
            <span :class="{ 'cell-warn': store.statOf(row.id).lowCount > 0 }">
              {{ store.statOf(row.id).lowCount }} 批
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditFurnace(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="openCreateBatch">挂料液</el-button>
            <el-button link type="danger" size="small" @click="deleteFurnace(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="mt-14">
      <template #header>
        <div class="card-header">
          <span class="card-header__title">料液批次与剩余量</span>
          <el-space>
            <el-select v-model="selectedFurnaceId" style="width: 200px" size="small">
              <el-option value="all" label="全部窑炉" />
              <el-option
                v-for="item in store.furnaces"
                :key="item.id"
                :value="item.id"
                :label="`${item.code} · ${item.type}`"
              />
            </el-select>
            <el-button type="primary" @click="openCreateBatch" :disabled="store.meltingFurnaces.length === 0">
              <el-icon><Plus /></el-icon>
              <span>登记料液批次</span>
            </el-button>
          </el-space>
        </div>
      </template>

      <EmptyPanel
        v-if="store.batches.length === 0 && !store.loading"
        title="还没有料液批次"
        description="为熔化炉或坩埚炉登记色号、配方、熔化日期与剩余量；取料时会自动按剩余量扣减，低于阈值会高亮提示补料。"
        action-text="登记第一批料液"
        @action="openCreateBatch"
      />

      <el-table
        v-else
        v-loading="store.loading"
        :data="batches"
        row-key="id"
        stripe
        :row-class-name="batchRowClass"
      >
        <el-table-column label="色号 / 配方" min-width="260">
          <template #default="{ row }">
            <div class="cell-stack">
              <span class="cell-strong">{{ row.colorCode }}</span>
              <span class="cell-sub">{{ row.recipe }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="所属窑炉" min-width="170">
          <template #default="{ row }">{{ furnaceLabel[row.furnaceId] ?? '（窑炉已删除）' }}</template>
        </el-table-column>
        <el-table-column prop="meltDate" label="熔化日期" width="120" />
        <el-table-column label="出料温度" width="110" align="right">
          <template #default="{ row }">{{ row.tempC }} ℃</template>
        </el-table-column>
        <el-table-column label="剩余量" width="130" align="right">
          <template #default="{ row }">
            <el-tag :type="isLowRemain(row.remainKg) ? 'danger' : 'success'" size="small">
              {{ row.remainKg }} kg
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="取料 / 补料" width="300">
          <template #default="{ row }">
            <el-space>
              <el-button size="small" type="primary" plain @click="openConsume(row)">取料</el-button>
              <el-input-number v-model="refillKg" :min="1" :max="2000" :step="10" size="small" style="width: 110px" />
              <el-button size="small" @click="submitRefill(row)">补料</el-button>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEditBatch(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteBatch(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="furnaceDialog" :title="editingFurnaceId === null ? '新建窑炉' : '编辑窑炉'" width="580px">
      <el-form ref="furnaceFormRef" :model="furnaceForm" :rules="furnaceRules" label-width="120px">
        <el-form-item label="窑号" prop="code">
          <el-input v-model="furnaceForm.code" placeholder="如：KILN-03 / AN-02" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="窑炉类型" prop="type">
              <el-select v-model="furnaceForm.type" style="width: 100%">
                <el-option v-for="item in FURNACE_TYPE_OPTIONS" :key="item" :value="item" :label="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="最高温度（℃）" prop="maxTempC">
              <el-input-number v-model="furnaceForm.maxTempC" :min="100" :max="1800" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="燃料类型" prop="fuelType">
              <el-select v-model="furnaceForm.fuelType" style="width: 100%">
                <el-option v-for="item in FUEL_TYPE_OPTIONS" :key="item" :value="item" :label="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="运行状态" prop="state">
              <el-select v-model="furnaceForm.state" style="width: 100%">
                <el-option v-for="item in FURNACE_STATE_OPTIONS" :key="item" :value="item" :label="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert
          v-if="furnaceForm.type === '退火窑'"
          type="success"
          show-icon
          :closable="false"
          title="退火窑保存后会自动进入窑位池（A1–C3 共 9 个窑位），可在退火编排页分配。"
        />
      </el-form>
      <template #footer>
        <el-button @click="furnaceDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitFurnace">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDialog" :title="editingBatchId === null ? '登记料液批次' : '编辑料液批次'" width="620px">
      <el-form ref="batchFormRef" :model="batchForm" :rules="batchRules" label-width="120px">
        <el-form-item label="所属窑炉" prop="furnaceId">
          <el-select v-model="batchForm.furnaceId" style="width: 100%">
            <el-option
              v-for="item in store.meltingFurnaces"
              :key="item.id"
              :value="item.id"
              :label="`${item.code} · ${item.type} · 上限 ${item.maxTempC} ℃`"
            />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="色号" prop="colorCode">
              <el-input v-model="batchForm.colorCode" placeholder="如：G-101" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="熔化日期" prop="meltDate">
              <el-date-picker v-model="batchForm.meltDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="配方" prop="recipe">
          <el-input v-model="batchForm.recipe" type="textarea" :rows="2" placeholder="如：钠钙玻璃基础料 + 氧化钴 0.3%" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="出料温度（℃）" prop="tempC">
              <el-input-number v-model="batchForm.tempC" :min="600" :max="1800" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="剩余量（kg）" prop="remainKg">
              <el-input-number v-model="batchForm.remainKg" :min="0" :max="5000" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert
          v-if="isLowRemain(batchForm.remainKg)"
          type="warning"
          show-icon
          :closable="false"
          :title="`剩余量低于补料阈值 ${LOW_REMAIN_KG} kg，保存后会在列表与顶部提醒中高亮。`"
        />
      </el-form>
      <template #footer>
        <el-button @click="batchDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitBatch">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="consumeDialog" title="取料" width="460px">
      <p class="dialog-tip">
        {{ consumeTarget?.colorCode }} 当前剩余
        <b>{{ consumeTarget?.remainKg }} kg</b>，取料后按剩余量扣减；不足时扣到 0。
      </p>
      <el-form label-width="110px">
        <el-form-item label="取料量（kg）">
          <el-input-number v-model="consumeKg" :min="0.5" :max="consumeTarget?.remainKg ?? 100" :step="0.5" style="width: 100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="consumeDialog = false">取消</el-button>
        <el-button type="primary" @click="submitConsume">确认取料</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 14px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.card-header__title {
  font-size: 15px;
  font-weight: 600;
  color: #1d2b3a;
}

.cell-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cell-strong {
  font-weight: 600;
  color: #1d2b3a;
}

.cell-sub {
  font-size: 12px;
  color: #8b95a1;
}

.cell-warn {
  color: #c0392b;
  font-weight: 600;
}

.low-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  line-height: 1.8;
}

.dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #5b6b7a;
}

.mt-14 {
  margin-top: 14px;
}

.mb-14 {
  margin-bottom: 14px;
}
</style>
