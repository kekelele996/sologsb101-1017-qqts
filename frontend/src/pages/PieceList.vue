<script setup lang="ts">
/**
 * /pieces 作品登记与设计尺寸录入
 * 按工艺与状态筛选；新建后进入工序编辑，状态由最后一道工序与退火记录共同推进。
 * 消费模型：Piece、GlassBatch、Furnace；复用组件：<FilterBar>、<StageTag>、<StatBadge>、<EmptyPanel>
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import EmptyPanel from '@/components/common/EmptyPanel.vue'
import FilterBar from '@/components/common/FilterBar.vue'
import StatBadge from '@/components/common/StatBadge.vue'
import StageTag from '@/components/common/StageTag.vue'
import { useFurnaceStore } from '@/stores/furnaceStore'
import { usePieceStore } from '@/stores/pieceStore'
import { CRAFT_OPTIONS, PIECE_STATE_OPTIONS, type Craft, type Piece, type PieceDraft, type PieceState } from '@/types/piece'
import { checkDesign } from '@/utils/thermal'

const router = useRouter()
const pieceStore = usePieceStore()
const furnaceStore = useFurnaceStore()

const dialogVisible = ref(false)
const submitting = ref(false)
const editingId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const form = reactive<PieceDraft>({
  name: '',
  batchId: '',
  designHeightMm: 200,
  wallThicknessMm: 4,
  craft: '吹制',
  artist: '',
  state: '设计中',
})

const rules: FormRules<PieceDraft> = {
  name: [{ required: true, message: '请填写作品名', trigger: 'blur' }],
  batchId: [{ required: true, message: '请选择料液批次', trigger: 'change' }],
  designHeightMm: [{ required: true, message: '请填写设计高度', trigger: 'blur' }],
  wallThicknessMm: [{ required: true, message: '请填写壁厚', trigger: 'blur' }],
  craft: [{ required: true, message: '请选择工艺', trigger: 'change' }],
  artist: [{ required: true, message: '请填写创作者', trigger: 'blur' }],
  state: [{ required: true, message: '请选择作品状态', trigger: 'change' }],
}

const batchLabel = computed<Record<string, string>>(() => {
  const result: Record<string, string> = {}
  furnaceStore.batches.forEach((batch) => {
    const furnace = furnaceStore.furnaces.find((row) => row.id === batch.furnaceId)
    result[batch.id] = `${batch.colorCode} · ${furnace?.code ?? '未知窑炉'} · 余 ${batch.remainKg} kg`
  })
  return result
})

const designCheck = computed(() => checkDesign(form.designHeightMm, form.wallThicknessMm))

const stats = computed(() => ({
  total: pieceStore.pieces.length,
  designing: pieceStore.pieces.filter((row) => row.state === '设计中').length,
  working: pieceStore.pieces.filter((row) => row.state === '制作中').length,
  annealed: pieceStore.pieces.filter((row) => row.state === '已退火').length,
  inspected: pieceStore.pieces.filter((row) => row.state === '已检验').length,
  avgThickness:
    pieceStore.pieces.length === 0
      ? 0
      : Math.round((pieceStore.pieces.reduce((acc, row) => acc + row.wallThicknessMm, 0) / pieceStore.pieces.length) * 100) / 100,
}))

onMounted(() => {
  void pieceStore.loadAll()
  void furnaceStore.loadAll()
})

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    name: '',
    batchId: furnaceStore.batches[0]?.id ?? '',
    designHeightMm: 200,
    wallThicknessMm: 4,
    craft: '吹制' as Craft,
    artist: '',
    state: '设计中' as PieceState,
  })
  dialogVisible.value = true
}

function openEdit(row: Piece): void {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    batchId: row.batchId,
    designHeightMm: row.designHeightMm,
    wallThicknessMm: row.wallThicknessMm,
    craft: row.craft,
    artist: row.artist,
    state: row.state,
  })
  dialogVisible.value = true
}

async function handleSubmit(): Promise<void> {
  if (formRef.value === undefined) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  if (!designCheck.value.ok) {
    ElMessage.warning(designCheck.value.message)
  }
  submitting.value = true
  try {
    if (editingId.value === null) {
      const row = await pieceStore.createPiece({ ...form })
      ElMessage.success(`已登记作品「${row.name}」，可继续录入吹制工序`)
      dialogVisible.value = false
      void router.push(`/pieces/${row.id}/steps`)
      return
    }
    await pieceStore.updatePiece(editingId.value, { ...form })
    ElMessage.success('作品信息已更新')
    dialogVisible.value = false
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: Piece): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `将删除「${row.name}」及其全部吹制工序、退火与出炉检验记录，且不可恢复。`,
      '确认删除作品？',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  await pieceStore.deletePiece(row.id)
  ElMessage.success('作品已删除')
}

function goSteps(row: Piece): void {
  pieceStore.selectPiece(row.id)
  void router.push(`/pieces/${row.id}/steps`)
}

function handleFilterChange(key: string, value: string): void {
  if (key === 'craft') pieceStore.setFilters({ craft: value as Craft | 'all' })
  if (key === 'state') pieceStore.setFilters({ state: value as PieceState | 'all' })
}
</script>

<template>
  <div>
    <div class="stat-row">
      <StatBadge label="作品总数" :value="stats.total" suffix="件" tone="primary" icon="Histogram" />
      <StatBadge label="设计中" :value="stats.designing" suffix="件" tone="info" icon="DataLine" />
      <StatBadge label="制作中" :value="stats.working" suffix="件" tone="warning" icon="TrendCharts" />
      <StatBadge label="已退火" :value="stats.annealed" suffix="件" tone="primary" icon="Histogram" />
      <StatBadge label="已检验" :value="stats.inspected" suffix="件" tone="success" icon="PieChart" />
      <StatBadge label="平均壁厚" :value="stats.avgThickness" suffix="mm" tone="default" icon="TrendCharts" />
    </div>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-header__title">作品登记与设计尺寸</span>
          <el-button type="primary" @click="openCreate" :disabled="furnaceStore.batches.length === 0">
            <el-icon><Plus /></el-icon>
            <span>登记作品</span>
          </el-button>
        </div>
      </template>

      <FilterBar
        :keyword="pieceStore.filters.keyword"
        :fields="[
          { key: 'craft', label: '工艺', options: CRAFT_OPTIONS as unknown as string[] },
          { key: 'state', label: '状态', options: PIECE_STATE_OPTIONS as unknown as string[] },
        ]"
        :values="{ craft: pieceStore.filters.craft, state: pieceStore.filters.state }"
        :result-text="`命中 ${pieceStore.visiblePieces.length} / ${pieceStore.pieces.length} 件`"
        @update:keyword="(value: string) => pieceStore.setFilters({ keyword: value })"
        @change="handleFilterChange"
        @reset="pieceStore.resetFilters()"
      />

      <el-alert
        v-if="furnaceStore.batches.length === 0"
        type="warning"
        show-icon
        :closable="false"
        class="mb-14"
        title="还没有料液批次"
        description="作品必须引用一个料液批次，请先到窑炉台账页登记料液。"
      />

      <EmptyPanel
        v-if="pieceStore.ready && pieceStore.pieces.length === 0"
        title="还没有作品"
        description="登记作品名、设计高度、壁厚、工艺与创作者；保存后可直接进入工序编辑，逐道记录温度与时长。"
        action-text="登记第一件作品"
        @action="openCreate"
      />

      <el-table v-else v-loading="!pieceStore.ready" :data="pieceStore.visiblePieces" row-key="id" stripe>
        <el-table-column label="作品名" min-width="180">
          <template #default="{ row }">
            <div class="cell-stack">
              <el-link type="primary" @click="goSteps(row)">{{ row.name }}</el-link>
              <span class="cell-sub">{{ row.artist }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="工艺 / 状态" width="230">
          <template #default="{ row }">
            <StageTag :stage="row.state" :craft="row.craft" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="料液批次" min-width="220">
          <template #default="{ row }">{{ batchLabel[row.batchId] ?? '（批次已删除）' }}</template>
        </el-table-column>
        <el-table-column label="设计高度" width="110" align="right">
          <template #default="{ row }">{{ row.designHeightMm }} mm</template>
        </el-table-column>
        <el-table-column label="壁厚" width="100" align="right">
          <template #default="{ row }">{{ row.wallThicknessMm }} mm</template>
        </el-table-column>
        <el-table-column label="工序完成度" width="180">
          <template #default="{ row }">
            <div class="progress-cell">
              <el-progress
                :percentage="pieceStore.progressOf(row.id).pct"
                :stroke-width="8"
                :show-text="false"
                :status="pieceStore.progressOf(row.id).allDone ? 'success' : undefined"
              />
              <span class="cell-sub">
                {{ pieceStore.progressOf(row.id).done }} / {{ pieceStore.progressOf(row.id).total }} 道
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="当前道次" width="130">
          <template #default="{ row }">
            <span v-if="pieceStore.progressOf(row.id).total === 0" class="cell-sub">未登记工序</span>
            <span v-else>
              第 {{ pieceStore.progressOf(row.id).currentSeq }} 道 · {{ pieceStore.progressOf(row.id).currentName }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goSteps(row)">工序编辑</el-button>
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId === null ? '登记作品' : '编辑作品'" width="640px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="作品名" prop="name">
          <el-input v-model="form.name" placeholder="如：晨雾花器" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="工艺" prop="craft">
              <el-select v-model="form.craft" style="width: 100%">
                <el-option v-for="item in CRAFT_OPTIONS" :key="item" :value="item" :label="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="创作者" prop="artist">
              <el-input v-model="form.artist" placeholder="如：林曦" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="料液批次" prop="batchId">
          <el-select v-model="form.batchId" style="width: 100%">
            <el-option
              v-for="item in furnaceStore.batches"
              :key="item.id"
              :value="item.id"
              :label="batchLabel[item.id] ?? item.colorCode"
            />
          </el-select>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="设计高度（mm）" prop="designHeightMm">
              <el-input-number v-model="form.designHeightMm" :min="10" :max="2000" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="壁厚（mm）" prop="wallThicknessMm">
              <el-input-number v-model="form.wallThicknessMm" :min="0.5" :max="60" :step="0.1" :precision="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="作品状态" prop="state">
              <el-select v-model="form.state" style="width: 100%">
                <el-option v-for="item in PIECE_STATE_OPTIONS" :key="item" :value="item" :label="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert
          :type="designCheck.ok ? 'success' : 'warning'"
          show-icon
          :closable="false"
          :title="designCheck.message"
          description="壁厚会直接决定退火时长：升温与缓冷按温差/速率换算，保温按每 5 mm 壁厚 1.2 小时换算。"
        />
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
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

.cell-sub {
  font-size: 12px;
  color: #8b95a1;
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mb-14 {
  margin-bottom: 14px;
}
</style>
