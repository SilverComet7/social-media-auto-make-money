<template>
  <el-form :model="localValue" label-width="250px">
    <el-form-item label="名称">
      <el-select v-model="localValue.gameName" placeholder="请输入游戏名称" filterable clearable>
        <el-option v-for="game in allGameList" :key="game.name" :label="game.name" :value="game.name" />
      </el-select>
    </el-form-item>
    <el-form-item label="分组">
      <el-select v-model="localValue.groupName" placeholder="请选择分组" filterable clearable>
        <el-option label="攻略" value="攻略" />
        <el-option v-for="game in allGameList.slice(0, 2)" :key="game.name" :label="game.name" :value="game.name" />
      </el-select>
    </el-form-item>
    <el-form-item label="处理地址">
      <el-input v-model="localValue.videoDir" placeholder="请输入处理地址" />
    </el-form-item>

    <el-divider>标题相关</el-divider>

    <el-form-item label="是否开启重命名">
      <el-switch v-model="localValue.enableRename" active-text="是" inactive-text="否" />
      <div v-if="localValue.enableRename">
        <el-form-item label="预检查名称（避免相同名称）">
          <el-switch v-model="localValue.checkName" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="添加发布时间（避免相同名称）">
          <el-switch v-model="localValue.addPublishTime" active-text="是" inactive-text="否" />
        </el-form-item>
      </div>
    </el-form-item>

    <div>
      <el-divider>视频预处理配置</el-divider>
      <el-form-item label="是否开启去重配置">
        <el-switch v-model="localValue.deduplicationConfig.enable" @change="$emit('deduplication-change', localValue.deduplicationConfig.enable)" />
        <div v-if="localValue.deduplicationConfig.enable">
          <el-form-item label="变速因子">
            <el-slider v-model="localValue.deduplicationConfig.speedFactor" :min="0.8" :max="1.2" :step="0.05" />
          </el-form-item>

          <el-form-item label="启用镜像">
            <el-switch v-model="localValue.deduplicationConfig.enableMirror" />
          </el-form-item>

          <el-form-item label="启用旋转">
            <el-switch v-model="localValue.deduplicationConfig.enableRotate" />
            <el-input-number v-if="localValue.deduplicationConfig.enableRotate" v-model="localValue.deduplicationConfig.rotateAngle" :min="0" :max="360" :step="1" />
          </el-form-item>

          <el-form-item label="启用模糊">
            <el-switch v-model="localValue.deduplicationConfig.enableBlur" />
            <el-slider v-if="localValue.deduplicationConfig.enableBlur" v-model="localValue.deduplicationConfig.blurRadius" :min="0" :max="1" :step="0.1" />
          </el-form-item>

          <el-form-item label="亮度调整">
            <el-slider v-model="localValue.deduplicationConfig.brightness" :min="-1" :max="1" :step="0.1" />
          </el-form-item>

          <el-form-item label="对比度调整">
            <el-slider v-model="localValue.deduplicationConfig.contrast" :min="0" :max="2" :step="0.1" />
          </el-form-item>

          <el-form-item label="饱和度调整">
            <el-slider v-model="localValue.deduplicationConfig.saturation" :min="0" :max="2" :step="0.1" />
          </el-form-item>

          <el-form-item label="启用背景虚化">
            <el-switch v-model="localValue.deduplicationConfig.enableBgBlur" />
          </el-form-item>

          <template v-if="localValue.deduplicationConfig.enableBgBlur">
            <el-form-item label="上部虚化比例">
              <el-slider v-model="localValue.deduplicationConfig.bgBlurTop" :min="0" :max="1" :step="0.1" />
            </el-form-item>
            <el-form-item label="下部虚化比例">
              <el-slider v-model="localValue.deduplicationConfig.bgBlurBottom" :min="0" :max="1" :step="0.1" />
            </el-form-item>
          </template>
        </div>
      </el-form-item>
      <el-form-item label="是否开启视频变换">
        <el-switch v-model="localValue.enableTransform" />
        <template v-if="localValue.enableTransform">
          <el-form-item label="截取开始n秒后">
            <el-input-number v-model="localValue.beforeTime" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="截取结尾n秒前">
            <el-input-number v-model="localValue.afterTime" :min="0" :max="100" />
          </el-form-item>

          <el-form-item label="添加固定片尾">
            <el-switch v-model="localValue.addEnding" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="帧率">
            <el-input-number v-model="localValue.fps" :min="30" :max="60" />
          </el-form-item>
          <el-form-item label="分辨率百分比">
            <el-input-number v-model="localValue.scalePercent" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="单视频替换音乐">
            <el-switch v-model="localValue.replaceMusic" active-text="是" inactive-text="否" />
            <el-select v-model="localValue.musicName" placeholder="请选择音乐" v-if="localValue.replaceMusic">
              <el-option v-for="music in musicOptions" :key="music" :label="music" :value="music" />
            </el-select>
          </el-form-item>
        </template>
      </el-form-item>
      <el-divider>合并视频设置</el-divider>
      <el-form-item label="启用视频合并">
        <el-switch v-model="localValue.enableMerge" />
      </el-form-item>
      <template v-if="localValue.enableMerge">
        <el-form-item label="合并视频最小时长(秒)">
          <el-input-number v-model="localValue.mergedMinTime" :min="8" :max="60" />
        </el-form-item>
        <el-form-item label="每个分镜秒数">
          <el-input-number v-model="localValue.segmentDuration" :min="1" :max="60" />
          需要{{ Math.ceil(localValue.mergedMinTime / localValue.segmentDuration) }}个大于该分镜秒数的视频文件
        </el-form-item>
        <el-form-item label="混剪数量">
          <el-input-number v-model="localValue.mixCount" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="启用合集音乐">
          <el-switch v-model="localValue.enableMergeMusic" />
          <el-select v-if="localValue.enableMergeMusic" v-model="localValue.mergeMusicName" placeholder="请选择音乐">
            <el-option v-for="music in musicOptions" :key="music" :label="music" :value="music" />
          </el-select>
        </el-form-item>
      </template>
    </div>
  </el-form>
</template>

<script setup lang="ts">
import { allGameList } from '@/state/globalState';
import type { ScheduleJob } from '@/views/gameActivity.vue';
import { defineProps, defineEmits, ref, watch, toRaw } from 'vue'

interface FFMpegConfig {
  [key: string]: ScheduleJob
}

const props = defineProps<{
  modelValue: FFMpegConfig,
  musicOptions?: string[]
}>()
const emit = defineEmits(['update:modelValue', 'deduplication-change'])

const localValue = ref({ ...props.modelValue })

// watch(() => props.modelValue, (val) => {
//   localValue.value = { ...val }
// }, { deep: true })

watch(localValue, (val) => {
  emit('update:modelValue', toRaw(val))
}, { deep: true })
</script>
