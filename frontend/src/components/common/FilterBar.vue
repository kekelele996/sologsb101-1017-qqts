<script setup lang="ts">
/**
 * <FilterBar> 关键字 + 多选条件过滤条
 * 筛选条件通过 URL query 同步（可分享、可刷新保持），被作品页、退火页、导出页消费。
 */
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export interface FilterField {
  /** 同时作为 URL query 参数名 */
  key: string
  label: string
  options: string[]
  optionLabels?: Record<string, string>
}

const props = withDefaults(
  defineProps<{
    keyword: string
    fields?: FilterField[]
    /** 当前值；'all' 表示不过滤 */
    values?: Record<string, string>
    resultText?: string
  }>(),
  {
    fields: () => [],
    values: () => ({}),
    resultText: '',
  }
)

const emit = defineEmits<{
  'update:keyword': [string]
  change: [string, string]
  reset: []
}>()

const route = useRoute()
const router = useRouter()

// 首次挂载：从 URL query 回灌筛选条件（支持把带筛选的链接直接分享出去）
onMounted(() => {
  const query = route.query
  if (typeof query.q === 'string') emit('update:keyword', query.q)
  props.fields.forEach((field) => {
    const value = query[field.key]
    if (typeof value === 'string') emit('change', field.key, value)
  })
})

// 筛选条件变化后写回 URL query
watch(
  () => JSON.stringify({ q: props.keyword, values: props.values }),
  () => {
    const query: Record<string, string> = {}
    if (props.keyword.trim() !== '') query.q = props.keyword.trim()
    Object.entries(props.values).forEach(([key, value]) => {
      if (value !== '' && value !== 'all') query[key] = value
    })
    void router.replace({ query })
  }
)

function optionLabel(field: FilterField, option: string): string {
  return field.optionLabels?.[option] ?? option
}
</script>

<template>
  <el-card class="filter-bar" shadow="never">
    <div class="filter-bar__row">
      <el-input
        :model-value="keyword"
        clearable
        placeholder="输入关键字筛选"
        class="filter-bar__keyword"
        @update:model-value="(value: string) => emit('update:keyword', value)"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div v-for="field in fields" :key="field.key" class="filter-bar__field">
        <span class="filter-bar__label">{{ field.label }}</span>
        <el-select
          :model-value="values[field.key] ?? 'all'"
          class="filter-bar__select"
          @update:model-value="(value: string) => emit('change', field.key, value)"
        >
          <el-option :value="'all'" :label="`全部${field.label}`" />
          <el-option
            v-for="option in field.options"
            :key="option"
            :value="option"
            :label="optionLabel(field, option)"
          />
        </el-select>
      </div>

      <el-button @click="emit('reset')">
        <el-icon><RefreshLeft /></el-icon>
        <span>重置筛选</span>
      </el-button>

      <el-tag v-if="resultText" type="success" effect="plain">{{ resultText }}</el-tag>
      <slot name="extra" />
    </div>
  </el-card>
</template>

<style scoped>
.filter-bar {
  margin-bottom: 14px;
  background: #fbfaf6;
}

.filter-bar__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.filter-bar__keyword {
  width: 220px;
}

.filter-bar__field {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-bar__label {
  font-size: 13px;
  color: #6b6257;
}

.filter-bar__select {
  width: 148px;
}
</style>
