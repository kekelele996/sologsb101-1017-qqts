/**
 * 全局设置：取料扣减方式
 * - estimate（默认）：系统按设计高度与壁厚估算单件用料，取料工序完成时直接扣减
 * - actual：操作工必须在取料工序里填实际取料量，未填则拦下不允许完成
 * 纯前端应用，设置保存在 localStorage。
 */
import { ref } from 'vue'

/** 取料扣减方式 */
export type ConsumeMode = 'estimate' | 'actual'

export const CONSUME_MODE_OPTIONS: { value: ConsumeMode; label: string; hint: string }[] = [
  { value: 'estimate', label: '系统估料', hint: '按设计高度与壁厚估算单件用料，取料完成时直接扣减' },
  { value: 'actual', label: '实际取料', hint: '操作工在取料工序填实际取料量，未填写则拦下不允许完成' },
]

const STORAGE_KEY = 'gbglassblow:consumeMode'

function readMode(): ConsumeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'actual' ? 'actual' : 'estimate'
  } catch {
    return 'estimate'
  }
}

/** 当前取料扣减方式（响应式，跨页共享） */
export const consumeMode = ref<ConsumeMode>(readMode())

/** 切换取料扣减方式并持久化 */
export function setConsumeMode(mode: ConsumeMode): void {
  consumeMode.value = mode
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* 隐私模式下写入失败时静默降级 */
  }
}
