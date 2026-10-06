<script setup lang="ts">
/**
 * <StageTag> 作品阶段标签
 * 按 设计中 / 制作中 / 已退火 / 已检验 渲染阶段底色与图标，被作品页、工序页、退火页消费。
 */
import { computed } from 'vue'
import type { Component } from 'vue'
import { Brush, Check, EditPen, Loading } from '@element-plus/icons-vue'
import type { Craft, PieceState } from '@/types/piece'
import type { FurnaceState } from '@/types/furnace'

const props = withDefaults(
  defineProps<{
    stage?: PieceState | null
    /** 可选：同时展示工艺标签 */
    craft?: Craft | null
    /** 可选：展示窑炉运行状态（供 /furnaces 复用同一标签组件） */
    furnaceState?: FurnaceState | null
    size?: 'default' | 'small'
  }>(),
  {
    stage: null,
    craft: null,
    furnaceState: null,
    size: 'default',
  }
)

type TagType = 'info' | 'warning' | 'primary' | 'success'

const TYPE_MAP: Record<PieceState, TagType> = {
  设计中: 'info',
  制作中: 'warning',
  已退火: 'primary',
  已检验: 'success',
}

const ICON_MAP: Record<PieceState, Component> = {
  设计中: EditPen,
  制作中: Loading,
  已退火: Brush,
  已检验: Check,
}

const HINT_MAP: Record<PieceState, string> = {
  设计中: '仅完成设计尺寸登记，尚未开始吹制工序',
  制作中: '吹制工序进行中，前序未完成时无法进入退火排位',
  已退火: '退火已完成出炉，等待出炉检验',
  已检验: '已完成出炉检验并归档',
}

const tagType = computed<TagType>(() => (props.stage === null ? 'info' : TYPE_MAP[props.stage]))
const iconComponent = computed<Component>(() => (props.stage === null ? EditPen : ICON_MAP[props.stage]))
const hint = computed<string>(() => (props.stage === null ? '尚无作品阶段' : HINT_MAP[props.stage]))

const FURNACE_TYPE: Record<FurnaceState, TagType> = {
  停窑: 'info',
  升温: 'warning',
  运行: 'success',
  保温: 'primary',
}

const FURNACE_HINT: Record<FurnaceState, string> = {
  停窑: '窑炉已停窑，不能进行取料或退火作业',
  升温: '窑炉正在升温，尚未达到作业温度',
  运行: '窑炉处于运行状态，可正常作业',
  保温: '窑炉保温中，等待下一批作业',
}
</script>

<template>
  <el-tooltip :content="hint" placement="top">
    <span class="stage-tag">
      <el-tag
        v-if="furnaceState"
        :type="FURNACE_TYPE[furnaceState]"
        :size="size === 'small' ? 'small' : 'default'"
        effect="light"
        :title="FURNACE_HINT[furnaceState]"
      >
        {{ furnaceState }}
      </el-tag>
      <el-tag v-else :type="tagType" :size="size === 'small' ? 'small' : 'default'" effect="light">
        <el-icon class="stage-tag__icon"><component :is="iconComponent" /></el-icon>
        <span>{{ stage ?? '未登记' }}</span>
      </el-tag>
      <el-tag v-if="craft" size="small" effect="plain" type="info">{{ craft }}</el-tag>
    </span>
  </el-tooltip>
</template>

<style scoped>
.stage-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.stage-tag__icon {
  margin-right: 3px;
  vertical-align: -2px;
}
</style>
