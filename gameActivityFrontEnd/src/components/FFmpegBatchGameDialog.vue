<template>
  <el-dialog v-model="batchDialogVisible" title="批量视频处理">

    <h4>公共FFmpeg配置</h4>
    <ffmpegConfigForm v-model="publicFFmpegConfig" @deduplication-change="handleDeduplicationChange" />
    <h4>当前不同有任务的game私有FFmpeg配置</h4>
    <el-tabs v-model="activeGameTab">
      <el-tab-pane v-for="game in batchGames" :key="game.dirPath" :label="game.game">
        <h4>视频列表</h4>
        <div style="display: flex; flex-wrap: wrap;">
          <div v-for="video in game.videoList" :key="video.name" style="margin: 10px;">
            <video :src="video.url" controls width="240" />
            <div>{{ video.name }}</div>
          </div>
        </div>
        <ffmpegConfigForm v-model="game.privateFFmpegConfig" @deduplication-change="handleDeduplicationChange" />
      </el-tab-pane>
    </el-tabs>
    <template #footer>
      <el-button @click="batchDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="handleBatchProcess">批量处理</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, defineProps, defineEmits } from 'vue'
import ffmpegConfigForm from './ffmpegConfigForm.vue'


interface GameItem {
  dirPath: string,
  game: string,
  videoList: { name: string, url: string }[],
  privateFFmpegConfig: object,
}

const props = defineProps({
  batchDialogVisible: Boolean,
  batchGames: Array<GameItem>,
  publicFFmpegConfig: Object,
})
const batchDialogVisible = ref(props.batchDialogVisible)
const publicFFmpegConfig = ref(props.publicFFmpegConfig)

const emit = defineEmits(['update:batchDialogVisible', 'batch-process'])
const activeGameTab = ref(props.batchGames?.[0]?.dirPath || '')

// 让父组件可以v-model控制弹窗显示
watch(() => props.batchDialogVisible, (val) => {
  if (val && props.batchGames?.length) {
    activeGameTab.value = props.batchGames[0].dirPath
  }
})

const handleBatchProcess = () => {
  // 收集所有配置，传递给父组件
  emit('batch-process', {
    publicFFmpegConfig: props.publicFFmpegConfig,
    games: props.batchGames.map(game => ({
      dirPath: game.dirPath,
      privateConfig: game.privateConfig,
      videoList: game.videoList,
      game: game.game,
    }))
  })
  emit('update:batchDialogVisible', false)
}
</script>
