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

  <el-divider>视频预处理配置</el-divider>
    <el-form-item label="是否开启去重配置">
     <el-switch v-model="localValue.deduplicationConfig.enable"
        @change="$emit('deduplication-change', localValue.deduplicationConfig.enable)" />
      <div v-if="localValue.deduplicationConfig.enable">
        <el-form-item label="变速因子">
          <el-slider v-model="localValue.deduplicationConfig.speedFactor" :min="0.8" :max="1.2" :step="0.05" />
        </el-form-item>

      <el-form-item label="启用镜像">
          <el-switch v-model="localValue.deduplicationConfig.enableMirror" />
        </el-form-item>

      <el-form-item label="启用旋转">
          <el-switch v-model="localValue.deduplicationConfig.enableRotate" />
         <el-input-number v-if="localValue.deduplicationConfig.enableRotate"
            v-model="localValue.deduplicationConfig.rotateAngle" :min="0" :max="360" :step="1" />
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

      <el-form-item label="启用模糊">
          <el-switch v-model="localValue.deduplicationConfig.enableBlur" />
          <el-slider v-if="localValue.deduplicationConfig.enableBlur"
            v-model="localValue.deduplicationConfig.blurRadius" :min="0" :max="1" :step="0.1" />
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
       <!-- 新增：帧率去重配置 -->
        <el-divider content-position="left">帧率去重配置（增强去重效果）</el-divider>
        <el-form-item label="启用帧率去重">
          <el-switch v-model="localValue.deduplicationConfig.enableFrameChange" />
          <el-tooltip content="通过抽帧插帧技术提升视频差异性，增强去重效果" placement="top">
            <el-icon style="margin-left: 8px">
              <InfoFilled />
            </el-icon>
          </el-tooltip>
        </el-form-item>

        <template v-if="localValue.deduplicationConfig.enableFrameChange">
          <el-form-item label="去重强度">
            <el-radio-group v-model="localValue.deduplicationConfig.frameChangeMode">
              <el-radio label="light">轻度 (30→28→30fps)</el-radio>
              <el-radio label="medium">中度 (30→24→30fps)</el-radio>
              <el-radio label="heavy">重度 (30→20→30fps)</el-radio>
              <el-radio label="manual">自定义</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="localValue.deduplicationConfig.frameChangeMode === 'manual'">
            <el-form-item label="抽帧目标帧率">
              <el-input-number v-model="localValue.deduplicationConfig.targetFps" :min="18" :max="25" />
              <span style="margin-left: 8px; color: #909399;">推荐: 20-24</span>
            </el-form-item>
            <el-form-item label="插帧最终帧率">
              <el-input-number v-model="localValue.deduplicationConfig.finalFps" :min="30" :max="60" />
              <span style="margin-left: 8px; color: #909399;">推荐: 30</span>
            </el-form-item>
            <el-form-item label="插值算法">
              <el-select v-model="localValue.deduplicationConfig.interpolateMode">
                <el-option label="运动补偿 (高质量，速度慢)" value="mci" />
                <el-option label="混合模式 (平衡)" value="blend" />
                <el-option label="复制帧 (极速)" value="dup" />
              </el-select>
              <div style="margin-top:8px; color:#909399; font-size:12px;">
                推荐: {{ recommendedInterpolateMode }}（根据抽帧与插帧差距）
              </div>
            </el-form-item>
          </template>


        </template>
        <!-- 新增：overlay （外部遮罩 / 特效）配置 -->
        <el-divider content-position="left">Overlay 特效（可选）</el-divider>
        <el-form-item label="启用 overlay 特效">
          <el-switch v-model="localValue.deduplicationConfig.enableOverlayEffect" />
        </el-form-item>

        <template v-if="localValue.deduplicationConfig.enableOverlayEffect">
          <el-form-item label="overlay 文件路径">
            <el-input v-model="localValue.deduplicationConfig.overlayPath" placeholder="effect.mp4 或 绝对路径" />
            <div style="margin-top:6px; color:#909399; font-size:12px;">默认：项目目录下的 <code>effect.mp4</code></div>
          </el-form-item>

          <el-form-item label="循环 overlay">
            <el-switch v-model="localValue.deduplicationConfig.overlayLoop" />
          </el-form-item>

          <el-form-item label="blend 模式">
            <el-select v-model="localValue.deduplicationConfig.overlayBlendMode">
              <el-option label="lighten（亮部）" value="lighten" />
              <el-option label="screen（滤色）" value="screen" />
              <el-option label="overlay（叠加）" value="overlay" />
              <el-option label="multiply（相乘）" value="multiply" />
            </el-select>
          </el-form-item>

          <el-form-item label="不透明度">
            <el-slider v-model="localValue.deduplicationConfig.overlayOpacity" :min="0" :max="1" :step="0.05" />
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
   </template> <!-- 新增：视频特效配置 -->
    <el-divider>视频特效配置</el-divider>
    <el-form-item label="启用视频特效">
      <el-switch v-model="localValue.effectConfig.enable" />
    </el-form-item>

    <template v-if="localValue.effectConfig.enable">
      <el-form-item label="特效预设">
        <el-radio-group v-model="localValue.effectConfig.preset" @change="onPresetChange">
          <el-radio label="none">无特效</el-radio>
          <el-radio label="dynamic">动感 (加速+锐化)</el-radio>
          <el-radio label="dreamy">梦幻 (模糊+色调)</el-radio>
          <el-radio label="artistic">艺术 (卡通效果)</el-radio>
          <el-radio label="vintage">复古 (褐色+模糊)</el-radio>
          <el-radio label="blackAndWhite">黑白 (灰度+锐化)</el-radio>
          <el-radio label="vibrant">炫彩 (饱和+锐化)</el-radio>
          <el-radio label="slowMo">慢镜头 (减速+模糊)</el-radio>
          <el-radio label="custom">自定义</el-radio>
        </el-radio-group>
      </el-form-item>

      <template v-if="localValue.effectConfig.preset === 'custom'">
        <el-form-item label="选择特效">
          <el-checkbox-group v-model="localValue.effectConfig.selectedEffects">
            <el-checkbox label="mirror">镜像翻转</el-checkbox>
            <el-checkbox label="verticalMirror">竖直翻转</el-checkbox>
            <el-checkbox label="rotate">旋转</el-checkbox>
            <el-checkbox label="blur">模糊</el-checkbox>
            <el-checkbox label="sharpen">锐化</el-checkbox>
            <el-checkbox label="grayscale">灰度</el-checkbox>
            <el-checkbox label="sepia">褐色</el-checkbox>
            <el-checkbox label="cartoon">卡通效果</el-checkbox>
            <el-checkbox label="invert">反色</el-checkbox>
            <el-checkbox label="colorshift">色调偏移</el-checkbox>
            <el-checkbox label="speedUp">加速</el-checkbox>
            <el-checkbox label="slowDown">减速</el-checkbox>
            <el-checkbox label="zoom">缩放</el-checkbox>
            <el-checkbox label="vignette">晕影</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-divider content-position="left">特效参数调整</el-divider>

        <el-form-item label="旋转角度">
          <el-input-number v-model="localValue.effectConfig.params.rotateAngle" :min="0" :max="360" :step="1" />
        </el-form-item>

        <el-form-item label="模糊程度">
          <el-slider v-model="localValue.effectConfig.params.blurAmount" :min="0" :max="50" :step="1" />
        </el-form-item>

        <el-form-item label="锐化程度">
          <el-slider v-model="localValue.effectConfig.params.sharpAmount" :min="0" :max="3" :step="0.1" />
        </el-form-item>

        <el-form-item label="加速倍数">
          <el-slider v-model="localValue.effectConfig.params.speedUpFactor" :min="1" :max="3" :step="0.1" />
          <span style="margin-left: 8px;">{{ localValue.effectConfig.params.speedUpFactor.toFixed(1) }}x</span>
        </el-form-item>

        <el-form-item label="减速倍数">
          <el-slider v-model="localValue.effectConfig.params.slowDownFactor" :min="0.3" :max="1" :step="0.1" />
          <span style="margin-left: 8px;">{{ localValue.effectConfig.params.slowDownFactor.toFixed(1) }}x</span>
        </el-form-item>

        <el-form-item label="色调调整 (0-360)">
          <el-slider v-model="localValue.effectConfig.params.hue" :min="0" :max="360" :step="1" />
        </el-form-item>

        <el-form-item label="饱和度调整">
          <el-slider v-model="localValue.effectConfig.params.saturation" :min="0" :max="2" :step="0.1" />
        </el-form-item>

        <el-form-item label="缩放倍数">
          <el-slider v-model="localValue.effectConfig.params.zoomLevel" :min="1" :max="2" :step="0.1" />
        </el-form-item>
      </template>
      <el-form-item label="合并时应用特效">
        <el-switch v-model="localValue.effectConfig.applyOnMerge" />
        <div style="margin-top: 8px; color: #909399; font-size: 12px;">
          开启后，合并视频时会对整个视频应用特效，而不仅是单个视频
        </div>
      </el-form-item>
   </template>
   <!-- 新增：GPU加速优化 -->
    <el-divider>GPU加速优化</el-divider>
    <el-form-item label="AMD GPU优化模式">
      <el-radio-group v-model="localValue.gpuQuality">
        <el-radio label="speed">极速 (3.5x倍速)</el-radio>
        <el-radio label="balanced">平衡 (2.5x倍速，推荐)</el-radio>
        <el-radio label="quality">高质量 (1.5x倍速)</el-radio>
      </el-radio-group>
      <div style="margin-top: 8px; color: #909399; font-size: 12px;">
        注：NVIDIA GPU会自动使用最优参数，此选项主要针对AMD显卡
      </div>
    </el-form-item>

    <!-- 新增：任务管理（断点续传） -->
    <el-divider>任务管理</el-divider>
    <el-form-item label="启用断点续传">
      <el-switch v-model="localValue.enableResumeTask" />
      <el-tooltip content="任务中断后可自动恢复，避免重复处理" placement="top">
        <el-icon style="margin-left: 8px">
          <InfoFilled />
        </el-icon>
      </el-tooltip>
    </el-form-item>
    <el-form-item v-if="localValue.enableResumeTask" label="自动恢复任务">
      <el-switch v-model="localValue.autoResumeTask" />
      <div style="margin-top: 8px; color: #909399; font-size: 12px;">
        开启后，检测到未完成任务会自动继续处理
     </div>
   </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { allGameList } from '@/state/globalState';
import type { ScheduleJob } from '@/views/gameActivity.vue';
import { ref, watch, toRaw, computed } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

interface FFMpegConfig {
  [key: string]: ScheduleJob
}

const props = defineProps<{
  modelValue: FFMpegConfig,
  musicOptions?: string[]
}>()
const emit = defineEmits(['update:modelValue', 'deduplication-change'])

const localValue = ref({ ...props.modelValue })

// 特效预设配置
const effectPresets = {
  dynamic: {
    effects: ['speedUp', 'sharpen'],
    params: { speedUpFactor: 1.2, sharpAmount: 1.2 }
  },
  dreamy: {
    effects: ['blur', 'colorshift'],
    params: { blurAmount: 3, hue: 45, saturation: 1.2 }
  },
  artistic: {
    effects: ['cartoon', 'sharpen'],
    params: { sharpAmount: 0.8 }
  },
  vintage: {
    effects: ['sepia', 'blur'],
    params: { blurAmount: 2 }
  },
  blackAndWhite: {
    effects: ['grayscale', 'sharpen'],
    params: { sharpAmount: 1.5 }
  },
  vibrant: {
    effects: ['colorshift', 'sharpen'],
    params: { hue: 0, saturation: 1.5, sharpAmount: 1.2 }
  },
  slowMo: {
    effects: ['slowDown', 'blur'],
    params: { slowDownFactor: 0.5, blurAmount: 1 }
  },
  none: {
    effects: [],
    params: {}
  }
}

// 预设变化时更新选择和参数
const onPresetChange = (preset) => {
  if (preset !== 'custom' && effectPresets[preset]) {
    localValue.value.effectConfig.selectedEffects = [...effectPresets[preset].effects]
    localValue.value.effectConfig.params = { ...effectPresets[preset].params }
  }
}

const recommendedInterpolateMode = computed(() => {
  const target = Number(localValue.value?.deduplicationConfig?.targetFps) || 24;
  const final = Number(localValue.value?.deduplicationConfig?.finalFps) || 30;
  const gap = final - target;
  if (gap <= 6) return 'blend';
  if (gap <= 12) return 'mci';
  return 'dup';
})

watch(localValue, (val) => {
  emit('update:modelValue', toRaw(val))
}, { deep: true })
</script>
