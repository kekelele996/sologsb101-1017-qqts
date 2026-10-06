<script setup lang="ts">
/**
 * <EmptyPanel> 空数据引导与新建入口
 * 被全部列表页复用；/pieces/:id/steps 查不到作品时也用它兜底，避免白屏。
 */
withDefaults(
  defineProps<{
    title: string
    description?: string
    actionText?: string
  }>(),
  {
    description: '',
    actionText: '',
  }
)

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="empty-panel">
    <el-empty :description="title">
      <template #description>
        <div class="empty-panel__text">
          <p class="empty-panel__title">{{ title }}</p>
          <p v-if="description" class="empty-panel__desc">{{ description }}</p>
        </div>
      </template>
      <div class="empty-panel__actions">
        <el-button v-if="actionText" type="primary" @click="emit('action')">
          <el-icon><Plus /></el-icon>
          <span>{{ actionText }}</span>
        </el-button>
        <slot name="extra" />
      </div>
    </el-empty>
  </div>
</template>

<style scoped>
.empty-panel {
  padding: 18px 12px;
  background: #ffffff;
  border: 1px dashed #ddd5c6;
  border-radius: 12px;
}

.empty-panel__text {
  max-width: 520px;
}

.empty-panel__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #2f2a24;
}

.empty-panel__desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #8c8479;
}

.empty-panel__actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
