<script setup lang="ts">
/**
 * <StatBadge> 计数与占比徽标
 * 被树体检查页、加固件页、复评页消费。
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import { DataLine, Histogram, PieChart, TrendCharts, Warning } from '@element-plus/icons-vue'

type BadgeTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

const props = withDefaults(
  defineProps<{
    label: string
    value: number | string
    /** 数值后缀，如「株」「次」「%」 */
    suffix?: string
    /** 占比（0–100），传入后渲染进度条 */
    percent?: number
    tone?: BadgeTone
    icon?: string
    hint?: string
    size?: 'default' | 'small'
  }>(),
  {
    suffix: '',
    percent: undefined,
    tone: 'default',
    icon: 'DataLine',
    hint: '',
    size: 'default',
  }
)

const TONE_COLOR: Record<BadgeTone, string> = {
  default: '#5b6b7a',
  primary: '#c2571a',
  success: '#1e8449',
  warning: '#d68910',
  danger: '#c0392b',
  info: '#2b6ca3',
}

const ICONS: Record<string, Component> = { DataLine, Histogram, PieChart, TrendCharts, Warning }

const color = computed<string>(() => TONE_COLOR[props.tone])
const iconComponent = computed<Component>(() => ICONS[props.icon] ?? DataLine)
const clampedPercent = computed<number>(() =>
  props.percent === undefined ? 0 : Math.max(0, Math.min(100, Math.round(props.percent * 10) / 10))
)
</script>

<template>
  <el-tooltip :content="hint" :disabled="hint === ''" placement="top">
    <div class="stat-badge" :class="[`is-${size}`]" :style="{ '--badge-color': color }">
      <div class="stat-badge__head">
        <el-icon class="stat-badge__icon"><component :is="iconComponent" /></el-icon>
        <span>{{ label }}</span>
      </div>
      <div class="stat-badge__body">
        <span class="stat-badge__value">{{ value }}</span>
        <span v-if="suffix" class="stat-badge__suffix">{{ suffix }}</span>
      </div>
      <el-progress
        v-if="percent !== undefined"
        :percentage="clampedPercent"
        :stroke-width="6"
        :show-text="false"
        :color="color"
      />
    </div>
  </el-tooltip>
</template>

<style scoped>
.stat-badge {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 132px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #e6e0d6;
  border-left: 4px solid var(--badge-color);
  border-radius: 10px;
}

.stat-badge.is-small {
  min-width: 104px;
  padding: 8px 10px;
}

.stat-badge__head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6b6257;
  font-size: 13px;
}

.stat-badge__icon {
  color: var(--badge-color);
  font-size: 15px;
}

.stat-badge__body {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-badge__value {
  font-size: 22px;
  font-weight: 700;
  color: #2f2a24;
  font-variant-numeric: tabular-nums;
}

.stat-badge.is-small .stat-badge__value {
  font-size: 18px;
}

.stat-badge__suffix {
  font-size: 12px;
  color: #8c8479;
}
</style>
