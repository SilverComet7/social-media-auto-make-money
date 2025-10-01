<template>
  <div class="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-8">
    <h2 class="text-2xl font-bold mb-4">上下分区排序排版演示</h2>
    <div class="flex gap-4 mb-4">
      <el-button type="primary" @click="shuffleRows">随机打乱每一行顺序</el-button>
      <span class="text-gray-700">当前顺序：
        {{layout.map(row => row.map(i => i.type).join('-')).join(' | ')}}
      </span>
    </div>
    <div class="layout-2rows">
      <div v-for="(row, rowIdx) in layout" :key="rowIdx" class="row">
        <div v-for="(item) in row" :key="item.type" :class="['block', item.type]">
          <template v-if="item.type === 'image'">
            <img :src="item.content" alt="图片" class="max-h-24 max-w-full object-contain" />
          </template>
          <template v-else-if="item.type === 'text'">
            <div class="text-lg font-semibold text-gray-800">{{ item.content }}</div>
          </template>
          <template v-else-if="item.type === 'list'">
            <ul class="list-disc pl-4 text-gray-700">
              <li v-for="li in item.content" :key="li">{{ li }}</li>
            </ul>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// 二维数组：第一行两个对象，第二行一个对象
const layout = ref([
  [
    { type: 'image', content: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b3/e3/e8/b3e3e82d-4969-48e8-1fff-8d2dbed0ab37/AppIcon-1x_U007emarketing-0-7-0-85-220-0.png/300x300bb.png' },
    { type: 'text', content: '这里是文本内容' }
  ],
  [
    { type: 'list', content: ['列表项1', '列表项2', '列表项3'] }
  ]
])

// 随机打乱每一行的顺序
function shuffleRows() {
  layout.value = layout.value.map(row =>
    row
      .map(v => ({ v, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ v }) => v)
  )
}
</script>

<style scoped>
.layout-2rows {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
}

.row {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.block {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  border: 1px solid #888;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 8px;
}

.block.image img {
  max-width: 100%;
  max-height: 80px;
  object-fit: contain;
}

.block.text {
  font-size: 18px;
  color: #222;
}

.block.list ul {
  margin: 0;
  padding: 0 0 0 1em;
  list-style: disc inside;
}

@media (max-width: 600px) {
  .layout-2rows {
    gap: 8px;
  }

  .row {
    flex-direction: column;
    gap: 8px;
  }
}
</style>
