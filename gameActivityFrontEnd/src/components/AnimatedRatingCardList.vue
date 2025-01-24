<template>
  <div class="min-h-screen bg-gray-900 p-10 flex flex-col items-center justify-center">
    <!--  w-[1920px] h-[1080px] -->

    <!-- <audio :src="`${voice}`"></audio> -->
    <audio ref="audioPlayer" src="../../public/五月天 - 后来的我们.mp3"
     ></audio>


    <!-- <audio ref="audioPlayer" :src="audioSource" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata"></audio> -->


    <div class="w-full  max-w-[84rem] mx-auto">
      <h1 class="text-3xl font-black text-white mb-3 text-center">{{ videoTitle }}</h1>
      <div :class="`relative ${isOverHidden ? 'overflow-hidden' : 'overflow-auto'}`">
        <div class="flex" :style="{
          'transition-property': 'transform',
          transform: `translateX(-${currentIndex * 25}%)`,
        }">

          <RatingCard v-for="(card, index) in cards" :key="index" v-bind="card" :number="cards.length - index"
            :isCardEdit="isCardEdit" class="w-[24.7%] flex-shrink-0 mr-1">
            <div v-if="isCardEdit" @click="cards.splice(index, 1)" class=" bg-red-600">删除这个卡片</div>
          </RatingCard>
        </div>
      </div>
    </div>
    <div class="my-10 flex flex-col text-white">
      <button @click="nextCard">move</button>
      <!-- <button @click="startAutoMove">
        {{ isRecording ? 'Recording...' : 'Start Recording Move' }}
      </button> -->
      <button @click="resetMove">reset</button>
      <!-- <button @click="isOverHidden = !isOverHidden">滚轮查看</button> -->
      <button @click="isOverHidden = !isOverHidden; isCardEdit = !isCardEdit">滚轮查看+观察文本+编辑卡片</button>

      <div class=" flex ">
        <input type="number" v-model="num" class="text-black" />
        <button @click="cards = cards.slice(cards.length - num)">截取排名前N位</button>
        <button @click="cards = cards.slice(0, num).reverse()" class="mx-2">截取排名后N位</button>
        <!-- <button @click="cards = cards.filter((item, index) => index == Math.random(0,cards.length))">截取随机N位</button> -->
      </div>

      <div class="flex">
        page: <input v-model="page" class="text-black" />
        pageNum: <input v-model="pageNum" class="text-black" />
      </div>
      <div class=" flex ">
        nodeId: <input v-model="nodeValue" class="text-black" />
        <button @click="getNodeList()" class=" bg-blue-500">查询</button>
        <!-- <button @click="getNodeList()">每页100查询</button> -->
      </div>
    </div>
    <div v-if="recordedVideoUrl" class="mt-4">
      <video ref="videoPlayer" controls class="w-full max-w-lg mx-auto">
        <source :src="recordedVideoUrl" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <button @click="saveToDesktop" class="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
        Save to Desktop
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import RatingCard from './RatingCard.vue'

// 1. 绑定value  2.调速value  3. 切分（）并排序按钮  4. start自动DIV录屏  5. 自动贴曲目  6.首帧图  7. 滚轮查看是否超出文本

const cards = ref(
  [
    {
      title: '王者荣耀',
      description: '138434263',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/b3/e3/e8/b3e3e82d-4969-48e8-1fff-8d2dbed0ab37/AppIcon-1x_U007emarketing-0-7-0-85-220-0.png/300x300bb.png',
      company: '腾讯',
    },
    {
      title: '和平精英',
      description: '75862087',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/08/9f/8c089f20-2783-9c2d-4103-2a5e7d11b63c/AppIcon-1x_U007emarketing-0-10-0-85-220-0.png/300x300bb.png',
      company: '腾讯',
    },
    {
      title: '地下城与勇士：起源',
      description: '54557181',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/e2/8f/94/e28f94f1-f9c5-ec97-e227-e04fc728eead/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/300x300bb.png',
      company: '腾讯',
    },
    {
      title: '无尽冬日',
      description: '33028674',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/43/49/18/43491802-23b3-e8c5-60da-6923ac1d0652/AppIcon-1x_U007emarketing-0-7-0-85-220-0.png/300x300bb.png',
      company: '上海青笛',
    },
    {
      title: '英雄联盟手游',
      description: '26822546',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a7/f8/0b/a7f80bb7-21b0-a642-38b1-612b34fbb4d3/AppIcon-1x_U007emarketing-0-7-0-0-85-220-0.png/300x300bb.png',
      company: '腾讯',
    },
    {
      title: '梦幻西游',
      description: '25581498',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/80/3d/b2/803db251-c539-60a2-84fd-66d80a1618a8/AppIcon-0-0-1x_U007emarketing-0-9-0-85-220.png/300x300bb.png',
      company: '网易移动游戏',
    },
    {
      title: '金铲铲之战',
      description: '22999131',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/3c/dd/71/3cdd71d8-a20a-c846-07fa-53343ebe4b5a/AppIcon-1x_U007emarketing-0-7-0-85-220-0.png/300x300bb.png',
      company: '腾讯',
    },
    {
      title: '第五人格',
      description: '22472721',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/97/97/b7/9797b7ab-17c7-2ecb-2311-3fb97ae909c9/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/300x300bb.png',
      company: '网易移动游戏',
    },
    {
      title: '三国志·战略版',
      description: '19371025',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/9b/0f/66/9b0f66c5-0103-3559-9bda-e94c0e9945d4/AppIcon-cn-0-0-1x_U007emarketing-0-7-0-85-220.png/300x300bb.png',
      company: 'Lingxi Games Inc.',
    },
    {
      title: '三国：谋定天下',
      description: '17119626',
      imageUrl:
        'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/37/8d/33/378d33e3-8024-8f48-5d86-1740e70782be/AppIcon-0-0-1x_U007emarketing-0-7-0-85-220.png/300x300bb.png',
      company: 'Shanghai Hode Information Technology Co.,Ltd.',
    },

    // {
    //   imageUrl: '/placeholder.svg?height=200&width=300',
    //   title: '赵六',
    //   ratings: 2000,
    //   score: 9.0,
    //   description: '惊艳全场',
    // },
  ].reverse(),
)

const currentIndex = ref(0)
const autoMoveInterval = ref(null)
const videoTitle = ref('2024.11月手游流水TOP10')
const isOverHidden = ref(true)
const isCardEdit = ref(false)

const recordedVideoUrl = ref(null)
const num = ref(20)

const audioPlayer = ref(null);
const nextCard = () => {
  if (currentIndex.value < cards.value.length - 4) {
    currentIndex.value += 0.0015
  }

  // 打开随机音乐
  audioPlayer.value.play()

  autoMoveInterval.value = window.requestAnimationFrame(nextCard)
}



const resetMove = () => {

  // 关闭音乐,重置到第一秒
  audioPlayer.value.pause()
  audioPlayer.value.currentTime = 0

  window.cancelAnimationFrame(autoMoveInterval.value)
  currentIndex.value = 0
  autoMoveInterval.value = null

}
const nodeValue = ref(11139732)
const pageNum = ref(100)
const page = ref(1)
const queryType = ref('hot')
const saveToDesktop = () => {
  console.log(recordedVideoUrl.value)

  if (recordedVideoUrl.value) {
    const a = document.createElement('a')
    a.href = recordedVideoUrl.value
    a.download = `{videoTitle.value}.mp4`
    a.click()
  }
}
onMounted(() => {
  getNodeList()
})

onUnmounted(() => {
  resetMove()
})

function getNodeList() {
  fetch(
    `https://games.mobileapi.hupu.com/1/8.1.6/bplcommentapi/bff/bpl/score_tree/groupAndSubNodes?pageSize=${pageNum.value}&page=${page.value}&nodeId=${nodeValue.value}&queryType=hot`,
    {
      headers: {
        'Cookie': 'cpck=eyJpZGZhIjoiIiwiY2xpZW50IjoiYTEwNTVlZTRlYWFmYzZjNyIsInByb2plY3RJZCI6MX0%3D',
      },
    }
  )
    .then((response) => {
      return response.json()
    })
    .then((res) => {
      videoTitle.value = res.data.groupInfo.name
      const list = res.data.nodePageResult.data
        .filter((item) => item.node.hottestComments[0]?.length > 0 && item.node.scorePersonCount > 5)
        .map((e) => {
          return {
            imageUrl: e.node.image[0],
            title: e.node.name,
            ratings: e.node.scorePersonCount,
            score: e.node.scoreAvg,
            description: e.node.hottestComments[0] || '暂无评论',
          }
        })

      cards.value = list.sort((a, b) => a.score - b.score)
      // Process the data and update the cards array accordingly
    })
    .catch((error) => {
      console.error('Error fetching data:', error)
    })
}
</script>

<style scoped>
/* Add any custom styles here if needed */
</style>
