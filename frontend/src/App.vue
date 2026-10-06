<script setup lang="ts">
/**
 * 应用外壳：顶部导航 + 当前作品上下文 + 内容区 + 页脚
 * 同时负责初始化本地数据库与 Pinia store 的数据订阅。
 */
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Box, DocumentChecked, Odometer, SetUp, Sunrise } from '@element-plus/icons-vue'
import { useFurnaceStore } from '@/stores/furnaceStore'
import { usePieceStore } from '@/stores/pieceStore'
import { useAnnealStore } from '@/stores/annealStore'
import { ROUTES } from '@/router'

const route = useRoute()
const router = useRouter()
const furnaceStore = useFurnaceStore()
const pieceStore = usePieceStore()
const annealStore = useAnnealStore()

const navItems = computed(() => {
  const currentPieceId = pieceStore.currentPieceId
  return [
    { path: ROUTES.furnaces, label: '窑炉料液', icon: SetUp, badge: String(furnaceStore.furnaces.length) },
    { path: ROUTES.pieces, label: '作品登记', icon: Box, badge: String(pieceStore.pieces.length) },
    {
      path: currentPieceId ? ROUTES.steps(currentPieceId) : ROUTES.pieces,
      label: '吹制工序',
      icon: Odometer,
      badge: String(pieceStore.steps.length),
      disabled: currentPieceId === null,
    },
    { path: ROUTES.annealing, label: '退火编排', icon: Sunrise, badge: String(annealStore.anneals.length) },
    { path: ROUTES.export, label: '检验归档', icon: DocumentChecked, badge: String(pieceStore.counts.inspects ?? 0) },
  ]
})

const activePath = computed<string>(() => {
  if (route.path.startsWith('/pieces/')) {
    const id = pieceStore.currentPieceId
    return id === null ? ROUTES.pieces : ROUTES.steps(id)
  }
  return route.path
})

const lowRemain = computed<number>(() => furnaceStore.lowRemainBatches.length)

onMounted(() => {
  void furnaceStore.loadAll()
  void pieceStore.loadAll()
  void annealStore.loadAll()
})

function go(path: string): void {
  void router.push(path)
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header__brand">
        <span class="app-header__mark">玻</span>
        <div>
          <h1 class="app-header__title">玻璃吹制工序与退火窑编排台</h1>
          <p class="app-header__sub">gbglassblow · 窑炉料液 · 逐道工序 · 退火窑位 · 出炉检验</p>
        </div>
      </div>
      <nav class="app-nav">
        <button
          v-for="item in navItems"
          :key="item.label"
          class="app-nav__item"
          :class="{ 'is-active': activePath === item.path, 'is-disabled': item.disabled }"
          type="button"
          :disabled="item.disabled"
          @click="go(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <em v-if="item.badge !== '0'" class="app-nav__badge">{{ item.badge }}</em>
        </button>
      </nav>
      <div class="app-header__meta">
        <el-tag v-if="pieceStore.currentPiece" type="warning" effect="dark">
          当前作品：{{ pieceStore.currentPiece.name }}（{{ pieceStore.currentPiece.state }}）
        </el-tag>
        <el-tag v-else type="info">未选择作品</el-tag>
        <el-tag v-if="lowRemain > 0" type="danger" effect="dark">待补料 {{ lowRemain }} 批</el-tag>
      </div>
    </header>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
    </main>

    <footer class="app-footer">
      <span>数据仅存于本浏览器（IndexedDB 库名 gbglassblow / localStorage），不上传任何服务器。</span>
      <span>
        窑炉 {{ furnaceStore.furnaces.length }} · 料液 {{ furnaceStore.batches.length }} · 作品
        {{ pieceStore.pieces.length }} · 工序 {{ pieceStore.steps.length }} · 结构版本 v{{
          furnaceStore.counts.schemaVersion ?? '-'
        }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 24px;
  background: linear-gradient(120deg, #16243a 0%, #24405e 55%, #3c6b8a 100%);
  color: #eef4fa;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.3);
  font-size: 20px;
  font-weight: 700;
}

.app-header__title {
  margin: 0;
  font-size: 18px;
  letter-spacing: 2px;
}

.app-header__sub {
  margin: 2px 0 0;
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(238, 244, 250, 0.72);
}

.app-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.app-nav__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: #eef4fa;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.app-nav__item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.16);
}

.app-nav__item.is-active {
  background: #eef4fa;
  color: #24405e;
  font-weight: 600;
}

.app-nav__item.is-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.app-nav__badge {
  font-style: normal;
  font-size: 11px;
  padding: 0 6px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
}

.app-header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.app-main {
  flex: 1;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding: 20px 24px 32px;
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 24px 20px;
  font-size: 12px;
  color: #8b95a1;
}
</style>
