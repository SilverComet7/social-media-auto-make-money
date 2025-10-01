<template>
  <div class="bg-black/60 rounded-lg overflow-hidden backdrop-blur h-full flex flex-col">
    <!-- Number header -->
    <div class="text-white text-center text-xl font-bold py-2 bg-black/40">NO.{{ number }}<slot></slot>
    </div>

    <!-- Main content -->
    <div class="p-3 flex-grow flex flex-col">
      <!-- Image section -->
      <div class="aspect-video rounded-lg mb-3 overflow-hidden" :class="company ? 'h-[20vw]' : 'h-[16vw]'">
        <img :src="imageUrl" :alt="title" class="w-full h-full object-contain" />
      </div>

      <!-- Title -->
      <div class="text-lg text-white text-center font-bold mb-2 bg-gray-700 h-[2vw] flex items-center justify-center">
        {{ title }}
      </div>

      <!-- Rating section -->
      <div class="flex items-center  bg-red-900 py-1 px-2 mb-3 mt-auto h-[3vw] "
        :class="company ? 'justify-center' : 'justify-between'" v-if="!company">
        <span class="text-red-300 text-xs font-black">{{ ratings }}人评分</span>
        <div class="flex items-baseline">
          <span class="text-yellow-400 text-2xl font-black">{{ score }}</span>
          <span class="text-yellow-400 text-xs ml-1">分</span>
        </div>
      </div>


      <!-- Bottom text -->
      <div
        class="text-gray-300 h-[12vw] p-2 bg-gray-700 flex items-center justify-center py-2 font-black bg-black/20 rounded"
        :class="company ? 'text-3xl' : 'text-2xs'" style="word-break: break-all">
        <!-- {{ !company ?

          isCardEdit ? (`$`) : description : }} -->
        <div v-if="company">
          {{ (description * 7.27).toFixed(0) }}
          <span class="text-yellow-300 text-2xl ml-2">￥</span>
        </div>
        <div v-else>
          <!-- <input v-show="isCardEdit" v-model="des" /> -->
          {{ description }}
          <!-- <span v-show="!isCardEdit">{{ description }}</span> -->
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
const props = defineProps({
  number: Number,
  isCardEdit: Boolean,
  index: Number,
  company: String,
  imageUrl: String,
  title: String,
  ratings: Number,
  score: Number,
  description: String,
})


const des = ref(props.description)
console.log(des.value);

</script>
