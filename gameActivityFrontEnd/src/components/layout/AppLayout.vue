<template>
  <el-container class="layout-container">
    <el-aside :width="isCollapse ? '64px' : '200px'" class="aside">
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        :collapse="isCollapse"
        @select="handleSelect"
        background-color="#ffffff"
        text-color="#333333"
        active-text-color="#409EFF"
      >
        <el-menu-item v-for="route in routes" :key="route.path" :index="route.path">
          <el-icon><component :is="route.icon" /></el-icon>
          <template #title>{{ route.name }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <div>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="toggle-button" @click="toggleSidebar">
            <Expand v-if="isCollapse" />
            <Fold v-else />
          </el-icon>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </div>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { routes } from '@/router/routes'

const route = useRoute()
const router = useRouter()
const isCollapse = ref(false)

const activeMenu = computed(() => route.path)

const handleSelect = (index: string) => {
  router.push(index)
}

const toggleSidebar = () => {
  isCollapse.value = !isCollapse.value
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  background-color: #f5f7fa;
}

.aside {
  background-color: #ffffff;
  transition: width 0.3s;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
  z-index: 10;
}

.main-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.el-menu-vertical {
  height: 100%;
  border-right: none;
}

.el-menu-vertical:not(.el-menu--collapse) {
  width: 200px;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 48px;
  box-shadow: 0 1px 4px rgba(0,21,41,0.08);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-title {
  margin-left: 16px;
  font-size: 14px;
  color: #67c23a;
}

.toggle-button {
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s;
  color: #606266;
}

.toggle-button:hover {
  color: #409EFF;
}

.main-content {
  padding: 20px;
  background-color: #f5f7fa;
}

:deep(.el-menu--collapse) {
  width: 64px;
}

:deep(.el-menu-item) {
  height: 50px;
  line-height: 50px;
  padding: 0 20px !important;
}

:deep(.el-menu-item.is-active) {
  background-color: #ecf5ff !important;
  color: #409EFF !important;
  border-right: 2px solid #409EFF;
}

:deep(.el-menu-item:hover) {
  background-color: #ecf5ff !important;
}

:deep(.el-menu-item .el-icon) {
  font-size: 18px;
  margin-right: 12px;
  vertical-align: middle;
}

:deep(.el-menu--collapse .el-menu-item .el-icon) {
  margin: 0;
}
</style>
