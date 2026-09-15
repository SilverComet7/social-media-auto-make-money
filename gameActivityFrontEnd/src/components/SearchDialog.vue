<template>
  <el-dialog title="选择搜索网站" v-model="visible" width="450px" @close="handleClose">
    <div class="search-options">
      <p class="mb-4 text-gray-600">搜索游戏：<span class="font-bold text-blue-600">{{ gameName }}</span></p>

      <div class="flex gap-2 mb-4">
        <el-button type="info" size="small" @click="selectAll">全选</el-button>
        <el-button type="info" size="small" @click="clearAll">清空</el-button>
      </div>

      <el-checkbox-group v-model="selectedWebsites" class="checkbox-group">
        <el-checkbox
          v-for="website in searchWebsites"
          :key="website.name"
          :label="website.name"
          class="website-checkbox"
        >
          <span class="mr-2">{{ website.icon }}</span>{{ website.name }}
        </el-checkbox>
      </el-checkbox-group>

      <div class="text-sm text-gray-500 mt-3 mb-4">
        已选择 {{ selectedWebsites.length }} / {{ searchWebsites.length }} 个网站
      </div>
    </div>

    <template #footer>
      <span class="dialog-footer">
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" @click="openAllSelected" :disabled="selectedWebsites.length === 0">
          打开所有 ({{ selectedWebsites.length }})
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface SearchWebsite {
  name: string
  baseUrl: string
  icon: string
}

interface Props {
  modelValue: boolean
  gameName: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
  gameName: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const searchWebsites: SearchWebsite[] = [
  { name: '抖音', baseUrl: 'https://www.douyin.com/search/', icon: '🎵' },
  {
    name: '抖音热度指数',
    baseUrl: 'https://creator.douyin.com/creator-micro/creator-count/arithmetic-index/analysis?source=creator&keyword=',
    icon: '📈',
  },
  {
    name: '抖音视频搜索',
    baseUrl: 'https://creator.douyin.com/creator-micro/creator-count/arithmetic-index/videosearch?query=',
    icon: '🎬',
  },
  { name: '小红书', baseUrl: 'https://www.xiaohongshu.com/search_result?keyword=', icon: '📸' },
  { name: '哔哩哔哩', baseUrl: 'https://search.bilibili.com/all?keyword=', icon: '📺' },
  { name: 'TapTap', baseUrl: 'https://www.taptap.cn/search/', icon: '🎮' },
  { name: 'Pixiv', baseUrl: 'https://www.pixiv.net/tags/', icon: '🎨' },
  { name: 'Google', baseUrl: 'https://www.google.com/search?q=', icon: '🔍' },
  // { name: 'Liblib', baseUrl: 'https://www.liblib.art/search?keyword=', icon: '🎭' },
]

// 默认选中抖音相关网站
const selectedWebsites = ref<string[]>(searchWebsites
  .filter(website => website.name.startsWith('抖音'))
  .map(website => website.name))

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value)
})

const selectAll = () => {
  selectedWebsites.value = searchWebsites.map(w => w.name)
}

const clearAll = () => {
  selectedWebsites.value = []
}

const openAllSelected = () => {
  selectedWebsites.value.forEach(websiteName => {
    const website = searchWebsites.find(w => w.name === websiteName)
    if (website) {
      const encodedGame = encodeURIComponent(props.gameName)
      const url = website.baseUrl + encodedGame
      window.open(url, '_blank')
    }
  })
  visible.value = false
}

const handleClose = () => {
  visible.value = false
}
</script>

<style scoped>
.search-options {
  padding: 10px 0;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.website-checkbox {
  font-size: 14px;
  padding: 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.website-checkbox:hover {
  background-color: #f5f7fa;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
