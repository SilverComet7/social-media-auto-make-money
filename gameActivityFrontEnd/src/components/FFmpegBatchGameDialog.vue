<template>
 <el-dialog v-model="batchDialogVisible" title="批量视频处理" width="80%">
    <el-alert v-if="unfinishedTasks.length > 0" title="检测到未完成任务" type="warning" :closable="false" show-icon
      style="margin-bottom: 20px;">
      <template #default>
        <div v-for="task in unfinishedTasks" :key="task.taskId"
          style="margin-bottom: 12px; padding: 8px; background: #fff; border-radius: 4px;">
          <div style="font-weight: bold; margin-bottom: 4px;">
            📋 任务: {{ task.taskId }}
          </div>
          <div style="display: flex; gap: 12px; margin-bottom: 8px; font-size: 13px;">
            <span>状态: <el-tag :type="getStatusType(task.status)" size="small">{{ getStatusText(task.status)
                }}</el-tag></span>
            <span>进度: {{ task.progress.processed }}/{{ task.progress.total }}</span>
            <span v-if="task.progress.failed > 0" style="color: #f56c6c;">失败: {{ task.progress.failed }}</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <el-button size="small" type="primary" @click="resumeTask(task.taskId)">恢复任务</el-button>
            <el-button size="small" type="danger" @click="deleteTask(task.taskId)">删除任务</el-button>
          </div>
        </div>
      </template>
    </el-alert>

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
import { ref, watch, defineProps, defineEmits, onMounted } from 'vue'
import ffmpegConfigForm from './ffmpegConfigForm.vue'
import { ElMessage, ElMessageBox } from 'element-plus'


interface GameItem {
  dirPath: string,
  game: string,
  videoList: { name: string, url: string }[],
  privateFFmpegConfig: object,
}

interface TaskProgress {
  taskId: string,
  status: string,
  progress: {
    total: number,
    processed: number,
    failed: number,
    processedFiles: string[],
  }
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

// 新增：未完成任务列表
const unfinishedTasks = ref<TaskProgress[]>([])

// 让父组件可以v-model控制弹窗显示
watch(() => props.batchDialogVisible, (val) => {
  if (val && props.batchGames?.length) {
    activeGameTab.value = props.batchGames[0].dirPath
    // 对话框打开时加载未完成任务
    loadUnfinishedTasks()
  }
})

// 加载未完成任务
const loadUnfinishedTasks = async () => {
  try {
    // 调用后端API获取未完成任务
    const response = await fetch('http://localhost:3000/api/tasks/unfinished')
    if (response.ok) {
      const data = await response.json()
      unfinishedTasks.value = data.tasks || []
    }
  } catch (error) {
    console.error('加载未完成任务失败:', error)
    // 如果后端API还未实现，暂时使用空数组
    unfinishedTasks.value = []
  }
}

// 恢复任务
const resumeTask = async (taskId: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要恢复任务 ${taskId} 吗？`,
      '确认恢复',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    // 调用后端API恢复任务
    const response = await fetch(`http://localhost:3000/api/tasks/${taskId}/resume`, {
      method: 'POST'
    })

    if (response.ok) {
      ElMessage.success('任务恢复成功')
      loadUnfinishedTasks()
    } else {
      ElMessage.error('任务恢复失败')
    }
  } catch (error) {
    // 用户取消或出错
    console.log('取消恢复任务')
  }
}

// 删除任务
const deleteTask = async (taskId: string) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除任务 ${taskId} 吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'error',
      }
    )

    // 调用后端API删除任务
    const response = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
      method: 'DELETE'
    })

    if (response.ok) {
      ElMessage.success('任务删除成功')
      loadUnfinishedTasks()
    } else {
      ElMessage.error('任务删除失败')
    }
  } catch (error) {
    // 用户取消或出错
    console.log('取消删除任务')
  }
}

// 获取状态类型（用于el-tag的type）
const getStatusType = (status: string) => {
  const typeMap: Record<string, string> = {
    pending: 'info',
    processing: 'warning',
    paused: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return typeMap[status] || 'info'
}

// 获取状态文本
const getStatusText = (status: string) => {
  const textMap: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    paused: '已暂停',
    completed: '已完成',
    failed: '失败'
  }
  return textMap[status] || status
}

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
