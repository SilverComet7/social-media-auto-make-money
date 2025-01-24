<template>
  <!-- 其他代码 -->
  <el-dialog
    title="编辑奖励"
    v-model="editRewardDialogVisible"
    width="50%"
    :before-close="cancelEditReward"
  >
    <el-form :model="editRewardForm" label-width="150px">
      <el-form-item label="平台名称">
        <el-select v-model="editRewardForm.name" placeholder="请选择平台">
          <el-option label="抖音" value="抖音" />
          <el-option label="小红书" value="小红书" />
          <el-option label="快手" value="快手" />
        </el-select>
      </el-form-item>
      <el-form-item label="话题名称">
        <el-input v-model="editRewardForm.specialTagRequirements[0].name" placeholder="请输入话题名称" />
      </el-form-item>
      <el-form-item label="视频时长">
        <el-input-number v-model="editRewardForm.specialTagRequirements[0].minVideoTime" :min="1" :max="300" />
      </el-form-item>
      <el-form-item label="视频观看量">
        <el-input-number v-model="editRewardForm.specialTagRequirements[0].minView" :min="1" :max="100000" />
      </el-form-item>
      <el-form-item label="特殊标签">
        <el-input v-model="editRewardForm.specialTagRequirements[0].specialTag" placeholder="请输入特殊标签" />
      </el-form-item>
      <el-form-item label="结束时间">
        <el-date-picker
          v-model="editRewardForm.specialTagRequirements[0].eDate"
          type="date"
          placeholder="选择结束时间"
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
        />
      </el-form-item>
      <el-form-item label="奖励参数">
        <el-button type="primary" @click="addReward">添加奖励</el-button>
        <div v-for="(reward, index) in editRewardForm.specialTagRequirements[0].reward" :key="index">
          <el-form-item label="投稿数">
            <el-input-number v-model="reward.allNum" :min="0" :max="1000" />
          </el-form-item>
          <el-form-item label="视频总观看量">
            <el-input-number v-model="reward.allViewNum" :min="0" :max="1000000" />
          </el-form-item>
          <el-form-item label="参与人数">
            <el-input-number v-model="reward.joinedPerson" :min="0" :max="10000" />
          </el-form-item>
          <el-form-item label="视频单稿观看量">
            <el-input-number v-model="reward.view" :min="0" :max="100000" />
          </el-form-item>
          <el-form-item label="点赞">
            <el-input-number v-model="reward.like" :min="0" :max="100000" />
          </el-form-item>
          <el-form-item label="视频总点赞量">
            <el-input-number v-model="reward.allLikeNum" :min="0" :max="1000000" />
          </el-form-item>
          <el-form-item label="投稿天数">
            <el-input-number v-model="reward.cday" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="奖励金额">
            <el-input-number v-model="reward.money" :min="0" :max="1000000" />
          </el-form-item>
          <el-form-item label="是否达标">
            <el-switch v-model="reward.isGet" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-button type="danger" @click="removeReward(index)">删除</el-button>
        </div>
      </el-form-item>
    </el-form>
    <template #footer>
      <span class="dialog-footer">
        <el-button @click="cancelEditReward">取 消</el-button>
        <el-button type="primary" @click="confirmEditReward">确 定</el-button>
      </span>
    </template>
  </el-dialog>
  <!-- 其他代码 -->
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElTable, ElTableColumn, ElProgress, ElEmpty } from 'element-plus'
import { ElMessage } from 'element-plus'

// 其他代码

const editRewardDialogVisible = ref(false)
const editRewardForm = ref({
  name: '',
  specialTagRequirements: [
    {
      name: '',
      minVideoTime: 6,
      minView: 100,
      specialTag: '',
      eDate: '',
      reward: [
        {
          allNum: 0,
          allViewNum: 0,
          joinedPerson: 0,
          view: 0,
          like: 0,
          allLikeNum: 0,
          cday: 0,
          money: 0,
          isGet: false,
        },
      ],
    },
  ],
})

const addReward = () => {
  editRewardForm.value.specialTagRequirements[0].reward.push({
    allNum: 0,
    allViewNum: 0,
    joinedPerson: 0,
    view: 0,
    like: 0,
    allLikeNum: 0,
    cday: 0,
    money: 0,
    isGet: false,
  })
}

const removeReward = (index) => {
  editRewardForm.value.specialTagRequirements[0].reward.splice(index, 1)
}

const openEditRewardDialog = (reward) => {
  editRewardForm.value = JSON.parse(JSON.stringify(reward))
  editRewardDialogVisible.value = true
}

const confirmEditReward = async () => {
  // 过滤掉未填写的参数
  const filteredReward = JSON.parse(JSON.stringify(editRewardForm.value))
  filteredReward.specialTagRequirements[0].reward = filteredReward.specialTagRequirements[0].reward.filter(
    (reward) =>
      Object.values(reward).some((value) => value !== 0 && value !== false && value !== '')
  )

  // 发送后端请求更新奖励
  await fetch(`http://localhost:3000/updateReward`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filteredReward),
  }).then((res) => {
    if (res.ok) {
      fetchData()
      editRewardDialogVisible.value = false
      ElMessage.success('奖励更新成功')
    }
  })
}

const cancelEditReward = () => {
  editRewardDialogVisible.value = false
}

// 其他代码
</script>

<style scoped>
/* 其他样式 */
</style>
