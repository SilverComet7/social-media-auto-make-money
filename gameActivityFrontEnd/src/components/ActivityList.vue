<template>
  <div class="table-container">
    <el-tabs type="card">
      <el-tab-pane label="四平台游戏活动激励">
        <div class="flex justify-between">
          <el-image
            src="/public/douyin.jpg"
            alt=""
            srcset=""
            class="w-500 h-[5vw]"
            preview-src="/public/douyin.jpg"
          />
          <el-affix :offset="20" class="text-blue-800">
            <div class="bg-slate-300 h-[5vw] overflow-auto">
              <div>#游戏鉴赏官 #联机游戏</div>
              <div>#二次元 #coser #完美身材 #美女</div>
              <div>#MMORPG #古风 #逆水寒</div>
              <div>#沙雕#故事#整活#搞笑</div>
              <div>#电子竞技 #教程攻略</div>
              <div>#射击游戏 #FPS #穿越火线 #无畏契约 #暗区突围 #三角洲行动</div>
              <div>#Steam游戏 #单机游戏</div>
              <div>
                #手机游戏
                蛋仔派对，和平精英，暗区突围，王者荣耀，原神，火影忍者，CF手游，光遇，英雄联盟，崩坏星穹铁道，原神
                永劫无间 鸣潮 明日方舟，第五人格，崩坏3 和平精英
              </div>
            </div>
          </el-affix>
          <div>
            <div>
              <el-button type="primary" @click="updateOnePlatData('抖音')"
                >更新所有平台最新播放数据</el-button
              >
              <el-button type="primary" @click="fetchNewActData">查询B站是否有新活动</el-button>
            </div>
            <div>
              <el-button type="primary" @click="handleDownloadSettings">下载视频并分组</el-button>
              <el-button type="primary" @click="ffmpegDialogVisible = true"
                >ffmpeg去重处理</el-button
              >
            </div>
            <el-affix :offset="20">
              <el-button type="primary" @click="fetchData">获取最新的后台合并数据</el-button>
            </el-affix>
          </div>
        </div>
        <el-table v-if="gameTableData.length" :data="gameTableData" style="width: 100%" border>
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="Event Name" width="250" fixed>
            <template #default="scope">
              <div :class="scope.row.notDo ? 'text-red-500' : ''">
                <a
                  :href="scope.row.act_url"
                  target="_blank"
                  :class="
                    scope.row.updateData || scope.row.new ? 'text-green-500 ' : 'text-blue-500'
                  "
                  class="font-bold"
                >
                  {{ scope.row.name }}
                </a>
                <div>
                  <el-button type="primary" @click="handleDownloadSettings(scope.row.name)"
                    >下载视频</el-button
                  >
                  <el-button
                    type="primary"
                    @click="
                      ((ffmpegDialogVisible = true), (ffmpegSettings.gameName = scope.row.name))
                    "
                    >ffmpeg处理</el-button
                  >
                </div>
                <p>上一次更新时间 {{ scope.row.updateDate }}</p>
                <el-button
                  type="primary"
                  @click="updateData(scope.row)"
                  v-if="scope.row.searchKeyWord"
                  >更新B站数据</el-button
                >
                <!-- <p>视频时长至少需 {{ scope.row.timeRange ?? '>=30s' }}</p> -->
                <p>任务结束日期 {{ formatDate(scope.row.etime) }}</p>
                <!-- <p>添加任务日期 {{ scope.row.addTime }}</p> -->
                <el-button type="primary" @click="openEditRewardDialog(scope.row.name)"
                  >添加平台奖励</el-button
                >
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="allMoney"
            label="allMoney 计入(总播放<5w,单稿件<10000,点赞<500,最低单稿播放<5000)"
            sortable=""
            width="150"
          />
          <el-table-column prop="comment" label="Comment" width="150" copyable />
          <el-table-column prop="endDiffDate" label="Days Left" width="100" sortable>
            <template #default="scope"> {{ getDaysDiff(scope.row.etime * 1000) }} 天 </template>
          </el-table-column>

          <el-table-column label="Rewards" min-width="800">
            <template #default="scope">
              <el-card v-for="(reward, rewardIndex) in scope.row.rewards" :key="rewardIndex">
                <div class="flex">
                  <div class="w-1/4">
                    <h4 class="font-bold" :class="reward.notDo ? 'text-red-500' : ''">
                      {{ reward.name }}
                    </h4>
                    <!-- 编辑平台活动 -->
                    <el-button type="primary" @click="openEditRewardDialog(scope.row.name, reward)"
                      >编辑</el-button
                    >

                    <!-- <p
                      class="text-blue-800"
                      @click="copyTag(reward.baseTopic)"
                      v-if="reward.baseTopic"
                    >
                      选择话题名称: {{ reward.baseTopic }}
                    </p> -->
                    <p
                      class="text-blue-800 font-bold cursor-pointer"
                      @click="copyTag(getSpecialTagAll(reward))"
                    >
                      TAG: {{ getSpecialTagAll(reward) }}
                    </p>
                  </div>

                  <div
                    v-if="
                      reward.specialTagRequirements &&
                      ['抖音', '快手', '小红书', 'bilibili'].includes(
                        reward.name || reward.platformName,
                      )
                    "
                    class="flex-1"
                  >
                    <template
                      v-for="(rew, reqIndex) in reward.specialTagRequirements"
                      :key="reqIndex"
                    >
                      <el-card
                        v-if="
                          rew.eDate
                            ? getDaysDiff(new Date(rew.eDate).getTime()) >= 0
                            : getDaysDiff(scope.row.etime * 1000) >= 0
                        "
                      >
                        <a
                          :href="rew.act_url"
                          target="_blank"
                          class="font-bold text-blue-600"
                          v-if="reward.name === 'bilibili'"
                          >{{ rew.name }} {{ rew.comment }}</a
                        >

                        <h4 class="font-bold" v-else>{{ rew.name }}</h4>
                        <h4 class="font-bold" v-if="reward.name === 'bilibili'">话题：{{ rew.topic }}</h4>
                        <!-- <h4 class="font-bold" v-if="rew.sDate">活动开始{{ rew.sDate }} </h4> -->
                        <h4
                          class="font-bold"
                          v-if="rew.eDate"
                          :class="
                            getDaysDiff(new Date(rew.eDate).getTime()) <= 4 ? 'text-orange-500' : ''
                          "
                        >
                          活动结束{{ rew.eDate }} 还剩{{
                            getDaysDiff(new Date(rew.eDate).getTime())
                          }}天
                        </h4>
                        <div>
                          <p
                            class="text-blue-800 cursor-pointer"
                            @click="copyTag(rew.specialTag || rew.specialTagAll)"
                            v-if="rew.specialTag || rew.specialTagAll"
                          >
                            必带TAG:
                            {{ reward.specialTagRequirements.map((e) => e.specialTag).join(' ') }}
                          </p>
                        </div>
                        <p v-if="rew.minVideoTime">单稿件最低时长：{{ rew.minVideoTime || 6 }}s</p>
                        <p v-if="rew.minView">单稿件最低播放量：{{ rew.minView || 100 }}</p>
                        <div v-for="(req, reqIndex) in rew.reward" :key="reqIndex">
                          <span v-if="req.time"> 持续时间>={{ req.time }} </span>
                          <span v-if="req.allNum">总投稿数{{ req.allNum }} </span>
                          <span
                            v-if="req.allViewNum"
                            :class="req.allViewNum <= 20000 ? ' text-orange-500' : ''"
                          >
                            总播放量{{ req.allViewNum }}
                          </span>
                          <span v-if="req.view"> 单视频播放量{{ req.view }} </span>
                          <span v-if="req.cday"> 投稿天数>={{ req.cday }} </span>
                          <span v-if="req.like"> 单稿件点赞>={{ req.like }} </span>
                          <span v-if="req.allLikeNum"> 总点赞>={{ req.allLikeNum }} </span>
                          <span
                            v-if="req.money"
                            :class="req.money >= 50000 ? ' text-orange-500' : ''"
                            >=瓜分{{ req.money }}</span
                          >

                          <span v-if="req.minView">> | 单视频播放量>={{ req.minView }}计入</span>

                          <template v-if="rew?.videoData">
                            <div v-for="r in rew.videoData" :key="r">
                              {{ r.userName }}:
                              <el-tooltip
                                effect="dark"
                                placement="top-start"
                                :content="getTooltipContent(req, r, reward)"
                                v-if="r.userName"
                              >
                                <el-progress
                                  :percentage="getCompletionPercentage(req, r).percentage"
                                  :status="getCompletionStatus(req, r)"
                                  :format="(percentage) => formatRequirement(req, percentage, r)"
                                />
                              </el-tooltip>
                            </div>
                          </template>
                        </div>
                      </el-card>
                    </template>
                  </div>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column label="Video Detail" min-width="750">
            <template #default="scope">
              <p
                class="text-blue-800 cursor-pointer"
                @click="copyTag(getCommonTagAll(scope.row))"
              >
                总标签 :{{ getCommonTagAll(scope.row) }}
              </p>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="B站活动激励">
        <el-table
          v-if="bilibiliActTableData.length"
          :data="bilibiliActTableData"
          style="width: 100%"
          border
        >
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="Event Name" width="250" fixed>
            <template #default="scope">
              <div :class="scope.row.notDo ? 'text-red-500' : ''">
                <a
                  :href="scope.row.act_url"
                  target="_blank"
                  :class="
                    scope.row.updateData || scope.row.new ? 'text-green-500 ' : 'text-blue-500'
                  "
                  class="font-bold"
                >
                  {{ scope.row.name }}
                </a>
                <p>上一次更新时间 {{ scope.row.updateDate }}</p>
                <el-button
                  type="primary"
                  @click="updateData(scope.row)"
                  v-if="scope.row.searchKeyWord"
                  >更新B站数据</el-button
                >
                <p>视频时长需 {{ scope.row.timeRange ?? '>=30s' }}</p>
                <p>任务结束日期 {{ formatDate(scope.row.etime) }}</p>
                <p>添加任务日期 {{ scope.row.addTime }}</p>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            prop="allMoney"
            label="allMoney 计入(总播放<5w,单稿件<10000,点赞<500,最低单稿播放<5000)"
            sortable=""
            width="150"
          />
          <el-table-column prop="comment" label="Comment" width="150" copyable />
          <el-table-column prop="endDiffDate" label="Days Left" width="100" sortable>
            <template #default="scope"> {{ getDaysDiff(scope.row.etime * 1000) }} 天 </template>
          </el-table-column>
          <!-- <el-table-column prop="bilibili.allNum" label="Total Videos" width="100" /> -->
          <!-- <el-table-column prop="bilibili.allViewNum" label="Total Views" width="100" copyable /> -->
          <el-table-column label="Rewards" min-width="800">
            <template #default="scope">
              <el-card v-for="(reward, rewardIndex) in scope.row.rewards" :key="rewardIndex">
                <div class="flex">
                  <div class="w-1/4">
                    <h4 class="font-bold" :class="reward.notDo ? 'text-red-500' : ''">
                      {{ reward.name }}
                    </h4>
                    <p
                      class="text-blue-800"
                      @click="copyTag(reward.baseTopic)"
                      v-if="reward.baseTopic"
                    >
                      可选话题: {{ reward.baseTopic }}
                    </p>
                    <p
                      class="text-blue-800 font-bold cursor-pointer"
                      @click="copyTag(getSpecialTagAll(reward))"
                    >
                      特殊TAG: {{ getSpecialTagAll(reward) || reward.specialTagAll }}
                    </p>

                    <!-- <p class="text-blue-800 font-bold cursor-pointer" @click="copyTag(reward.specialTagAll)"
                      v-if="reward.specialTagAll">该平台通用TAG: {{ reward.specialTagAll }}</p> -->
                  </div>
                  <div class="w-1/2 mx-4" v-if="reward.requirements?.length">
                    <div v-for="(req, reqIndex) in reward.requirements" :key="reqIndex">
                      <span v-if="req.allNum">总投稿数{{ req.allNum }}</span>
                      <span
                        v-if="req.allViewNum"
                        :class="req.allViewNum <= 30000 ? ' text-orange-500' : ''"
                      >
                        <span>+</span>总播放量{{ req.allViewNum }}</span
                      >
                      <span v-if="req.view" :class="req.view <= 3000 ? ' text-orange-500' : ''">
                        <span>+</span>单视频播放量{{ req.view }}</span
                      >
                      <span v-if="req.cday"> <span>+</span>投稿天数>={{ req.cday }}</span>
                      <span v-if="req.like" :class="req.like <= 500 ? ' text-orange-500' : ''">
                        <span>+</span>点赞>={{ req.like }}</span
                      >
                      <span v-if="req.money" :class="req.money >= 50000 ? ' text-orange-500' : ''"
                        >=瓜分{{ req.money }}</span
                      >
                      <el-tooltip
                        effect="dark"
                        placement="top-start"
                        :content="getTooltipContent(req, scope.row.bilibili)"
                        v-if="scope.row.bilibili"
                      >
                        <el-progress
                          :percentage="getCompletionPercentage(req, scope.row.bilibili).percentage"
                          :status="getCompletionStatus(req, scope.row.bilibili)"
                          :format="
                            (percentage) => formatRequirement(req, percentage, scope.row.bilibili)
                          "
                        />
                      </el-tooltip>
                    </div>
                  </div>
                  <div
                    v-if="
                      reward.specialTagRequirements &&
                      ['抖音', '快手', '小红书', 'bilibili'].includes(reward.name)
                    "
                    class="flex-1"
                  >
                    <template
                      v-for="(rew, reqIndex) in reward.specialTagRequirements"
                      :key="reqIndex"
                    >
                      <el-card
                        v-if="
                          rew.eDate
                            ? getDaysDiff(new Date(rew.eDate).getTime()) >= 0
                            : getDaysDiff(scope.row.etime * 1000) >= 0
                        "
                      >
                        <!-- <h4 class="font-bold" v-if="rew.sDate">活动开始{{ rew.sDate }} </h4> -->
                        <h4
                          class="font-bold"
                          v-if="rew.eDate"
                          :class="
                            getDaysDiff(new Date(rew.eDate).getTime()) <= 4 ? 'text-orange-500' : ''
                          "
                        >
                          活动结束{{ rew.eDate }} 还剩{{
                            getDaysDiff(new Date(rew.eDate).getTime())
                          }}天
                        </h4>
                        <h4 class="font-bold">{{ rew.name }}</h4>
                        <div>
                          <p
                            class="text-blue-800 cursor-pointer"
                            @click="copyTag(rew.specialTag || rew.specialTagAll)"
                            v-if="rew.specialTag || rew.specialTagAll"
                          >
                            特殊TAG:
                            {{
                              rew.specialTag ||
                              rew.specialTagAll ||
                              reward.specialTagRequirements.map((e) => e.specialTag).join(' ')
                            }}
                          </p>
                        </div>
                        <p v-if="rew.minVideoTime">单稿件最低时长：{{ rew.minVideoTime || 6 }}s</p>
                        <!-- <p v-if="rew.minPhoto">最少图片数量{{ rew.minPhoto }}</p> -->
                        <p v-if="rew.minView">单稿件最低播放量：{{ rew.minView || 100 }}</p>
                        <div v-for="(req, reqIndex) in rew.reward" :key="reqIndex">
                          <span v-if="req.time"> <span>+</span>持续时间>={{ req.time }}</span>
                          <span v-if="req.allNum">总投稿数{{ req.allNum }}</span>
                          <span
                            v-if="req.allViewNum"
                            :class="req.allViewNum <= 20000 ? ' text-orange-500' : ''"
                          >
                            <span>+</span>总播放量{{ req.allViewNum }}</span
                          >
                          <span v-if="req.view"> <span>+</span>单视频播放量{{ req.view }}</span>
                          <span v-if="req.cday"> <span>+</span>投稿天数>={{ req.cday }}</span>
                          <span v-if="req.like"> <span>+</span>点赞>={{ req.like }}</span>
                          <span
                            v-if="req.money"
                            :class="req.money >= 50000 ? ' text-orange-500' : ''"
                            >=瓜分{{ req.money }}</span
                          >

                          <span v-if="req.minView">> | 单视频播放量>={{ req.minView }}计入</span>

                          <!-- 多个账号的完成情况 -->
                          <!-- {{ reward.name }} -->
                          <template v-if="rew?.videoData">
                            <div v-for="r in rew.videoData" :key="r">
                              {{ r.userName }}:
                              <el-tooltip
                                effect="dark"
                                placement="top-start"
                                :content="getTooltipContent(req, r, reward)"
                                v-if="r.userName"
                              >
                                <el-progress
                                  :percentage="getCompletionPercentage(req, r).percentage"
                                  :status="getCompletionStatus(req, r)"
                                  :format="(percentage) => formatRequirement(req, percentage, r)"
                                />
                              </el-tooltip>
                            </div>
                          </template>
                        </div>
                      </el-card>
                    </template>
                  </div>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column label="Video Detail" min-width="750">
            <template #default="scope">
              <p
                class="text-blue-800 cursor-pointer"
                @click="copyTag(getCommonTagAll(scope.row) || scope.row.commonTagALL)"
              >
                总标签 :{{ getCommonTagAll(scope.row) || scope.row.commonTagALL }}
              </p>
              <div v-if="scope.row?.bilibili?.onePlayNumList.length >= 1">
                <p v-for="(video, index) in scope.row.bilibili.onePlayNumList" :key="index">
                  <a
                    :href="`https://www.bilibili.com/video/${video.bvid}/?spm_id_from=333.337.search-card.all.click&vd_source=c9acef8cde35247caf98fa45c32fe95f`"
                    target="_blank"
                    class="text-blue-500"
                    >{{ video.title }}</a
                  >
                  ({{ video.view }} 播放) ({{ video.like }} 点赞) ({{ video.reply }} 回复)
                </p>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="No data available" />
      </el-tab-pane>
      <el-tab-pane label="B站打卡挑战">
        <el-affix :offset="20" :right="20" class="right-4">
          <el-button type="primary" @click="fetchNewDakaData">查询新的打卡挑战数据</el-button>
        </el-affix>
        <el-table :data="dakaTableData" style="width: 100%">
          <el-table-column prop="title" label="活动标题" width="180">
            <template #default="scope">
              <a
                :href="`https://member.bilibili.com/york/platform-punch-card/detail?navhide=1&id=${scope.row.act_id}&from=1`"
                target="_blank"
              >
                {{ scope.row.title }}
                <div v-if="scope.row.icon_state === 1">立即投稿</div>
                <div v-else class="text-red-500">去报名</div>
              </a>
              <div>
                <el-tag v-for="tag in scope.row.act_tags" :key="tag" style="margin-right: 5px">
                  {{ tag }}
                </el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="话题" width="150">
            <template #default="scope">
              <el-tag
                v-for="tag in scope.row.detail.act_rule.topic"
                :key="tag"
                style="margin-right: 5px"
              >
                {{ tag.name }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="etime" label="结束时间" width="180">
            <template #default="scope">
              <div v-html="getDaysHtml(scope.row.etime)"></div>
              <div
                v-html="scope.row.detail.task_data?.main?.desc || scope.row.detail.task_data?.desc"
              ></div>
            </template>
          </el-table-column>
          <el-table-column label="规则文本" width="300">
            <template #default="scope">
              <div v-html="scope.row.detail.rule_text.split('\n\n【打卡稿件的要求】\n')[0]" />
            </template>
          </el-table-column>
          <el-table-column label="任务数据">
            <template #default="scope">
              <div v-if="scope.row.detail.task_data.weeks">
                <el-table :data="scope.row.detail.task_data.weeks">
                  <el-table-column prop="now_week" label="当前周">
                    <template #default="scope">
                      {{ scope.row.now_week ? '是' : '否' }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="task_state" label="任务状态" />
                  <el-table-column prop="etime" label="结束时间">
                    <template #default="scope">
                      <div v-html="getDaysHtml(scope.row.etime)"></div>
                    </template>
                  </el-table-column>
                  <el-table-column label="任务详情" min-width="600">
                    <template #default="scope">
                      <el-table :data="scope.row.tasks">
                        <el-table-column prop="award_name" label="奖励名称">
                          <template #default="scope">
                            <span
                              :class="
                                scope.row.target_value <= scope.row.target_progress
                                  ? 'text-emerald-400'
                                  : ''
                              "
                              >{{ scope.row.award_name }}
                            </span>
                          </template>
                        </el-table-column>
                        <el-table-column prop="target_type" label="目标类型">
                          <template #default="scope">
                            <span v-if="scope.row.target_type === 'av_num'">投稿数 </span>
                            <span v-if="scope.row.target_type === 'av_day'">投稿天数 </span>
                            <span v-if="scope.row.target_type === 'view'">播放量 </span>
                          </template>
                        </el-table-column>
                        <el-table-column prop="target_value" label="目标值" />
                        <el-table-column prop="target_progress" label="进度">
                          <template #default="scope">
                            <el-progress
                              :percentage="
                                (
                                  (scope.row.target_progress / scope.row.target_value) *
                                  100
                                ).toFixed(0)
                              "
                            />
                          </template>
                        </el-table-column>
                      </el-table>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
              <div v-else-if="scope.row.detail.task_data.tasks">
                <el-table :data="scope.row.detail.task_data.tasks" style="width: 100%">
                  <el-table-column prop="award_name" label="奖励名称" width="120">
                    <template #default="scope">
                      <span
                        :class="
                          scope.row.target_value <= scope.row.target_progress
                            ? 'text-emerald-400'
                            : ''
                        "
                        >{{ scope.row.award_name }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="target_type" label="目标类型" width="120">
                    <template #default="scope">
                      <span v-if="scope.row.target_type === 'av_num'">投稿数 </span>
                      <span v-if="scope.row.target_type === 'av_day'">投稿天数 </span>
                      <span v-if="scope.row.target_type === 'view'">播放量 </span>
                    </template>
                  </el-table-column>
                  <el-table-column prop="target_value" label="目标值" width="100" />
                  <el-table-column prop="target_progress" label="进度" width="100" />
                </el-table>
              </div>
              <div v-else>无任务数据</div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="B站(目前)已投稿件的评论管理">
        <el-button type="primary" @click="fetchUnfavorableReply">查询新的所有不利评论</el-button>
        <div v-for="(unfavorableReply, index) in unfavorableReplyList" :key="index">
          {{ unfavorableReply.message }}
          <el-button type="primary" @click="deleteUnfavorableReply(unfavorableReply)"
            >delete</el-button
          >
        </div>
      </el-tab-pane>
    </el-tabs>
    <el-backtop :right="100" :bottom="100" />

    <!-- 下载视频 dialog -->
    <el-dialog
      title="下载视频和分组区分"
      v-model="dialogVisible"
      width="30%"
      :before-close="cancelDownloadSettings"
    >
      <el-form :model="downloadSettings" label-width="150px">
        <el-form-item label="选择游戏">
          <div>
            <el-checkbox
              v-for="game in allGameList"
              :key="game.name"
              v-model="game.checked"
              :label="game.name"
            />
          </div>
        </el-form-item>
        <el-form-item label="是否单独检测名称">
          <el-switch v-model="downloadSettings.checkName" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="下载视频">
          <el-switch v-model="downloadSettings.isDownload" active-text="是" inactive-text="否" />
        </el-form-item>
        <div v-if="downloadSettings.isDownload">
          <el-form-item label="新旧JSON文件对比">
            <el-switch v-model="downloadSettings.checkNewAdd" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="开启全部视频下载">
            <el-switch v-model="downloadSettings.allDownload" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="视频开始时间">
            <el-input
              v-model="downloadSettings.earliest"
              placeholder="统一下载的最早时间 xx/xx/xx"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelDownloadSettings">取 消</el-button>
          <el-button type="primary" @click="confirmDownloadSettings">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- ffmpeg dialog -->
    <el-dialog
      title="FFmpeg 处理设置"
      v-model="ffmpegDialogVisible"
      :before-close="cancelFFmpegSettings"
    >
      <el-form :model="ffmpegSettings" label-width="250px">
        <el-form-item label="名称">
          <el-select v-model="ffmpegSettings.gameName" placeholder="请输入游戏名称" filterable>
            <el-option
              v-for="game in allGameList"
              :key="game.name"
              :label="game.name"
              :value="game.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="ffmpegSettings.groupName" placeholder="请选择分组" filterable>
            <!-- <el-option label="coser本人" value="coser本人" /> -->
            <!-- <el-option label="coser同行" value="coser同行" /> -->
            <el-option label="攻略" value="攻略" />
            <el-option
              v-for="game in allGameList"
              :key="game.name"
              :label="game.name"
              :value="game.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="是否单独检测名称">
          <el-switch v-model="ffmpegSettings.checkName" active-text="是" inactive-text="否" />
        </el-form-item>
        <div v-if="ffmpegSettings.groupName !== '攻略'">
          <!-- <el-form-item label="仅重命名（coser组给B站打卡用）">
            <el-switch v-model="ffmpegSettings.onlyRename" active-text="是" inactive-text="否" />
          </el-form-item> -->
          <el-form-item label="Before Time">
            <el-input-number v-model="ffmpegSettings.beforeTime" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="FPS">
            <el-input-number v-model="ffmpegSettings.fps" :min="30" :max="60" />
          </el-form-item>
          <el-form-item label="Scale Percent (%)">
            <el-input-number v-model="ffmpegSettings.scalePercent" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="是否替换音乐">
            <el-switch v-model="ffmpegSettings.replaceMusic" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="选择音乐">
            <el-select v-model="ffmpegSettings.musicName" placeholder="请选择音乐">
              <el-option v-for="music in musicOptions" :key="music" :label="music" :value="music" />
            </el-select>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <!-- <el-button @click="cancelFFmpegSettings">取 消</el-button> -->
          <el-button type="primary" @click="confirmFFmpegSettings">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 奖励dialog -->
    <el-dialog
      title="编辑奖励"
      v-model="editRewardDialogVisible"
      width="50%"
      :before-close="cancelEditReward"
    >
      <el-form :model="editRewardForm" label-width="150px">
        <el-form-item label="平台名称">
          <el-select v-model="editRewardForm.platformName" placeholder="请选择平台">
            <el-option label="bilibili" value="bilibili" />
            <el-option label="抖音" value="抖音" />
            <el-option label="小红书" value="小红书" />
            <el-option label="快手" value="快手" />
          </el-select>
        </el-form-item>
        <el-form-item label="活动赛道">
          <div
            v-for="(specialTagRequirement, index) in editRewardForm.specialTagRequirements"
            :key="index"
          >
            <el-card>
              <el-form-item label="活动名称">
                <el-input v-model="specialTagRequirement.name" placeholder="请输入活动名称" />
              </el-form-item>
              <el-form-item label="视频最低时长">
                <el-input-number v-model="specialTagRequirement.minVideoTime"  />
              </el-form-item>
              <el-form-item label="视频最低观看量">
                <el-input-number v-model="specialTagRequirement.minView"  />
              </el-form-item>
              <el-form-item label="B站活动话题" v-if="editRewardForm.platformName === 'bilibili'">
                <el-input v-model="specialTagRequirement.topic" placeholder="请输入活动话题" />
              </el-form-item>
              <el-form-item label="B站多标签引流" v-if="editRewardForm.platformName === 'bilibili'">
                <el-input v-model="specialTagRequirement.suppleTag" placeholder="请输入支撑标签" />
              </el-form-item>
              <el-form-item label="必带标签">
                <el-input v-model="specialTagRequirement.specialTag" placeholder="请输入必带标签" />
              </el-form-item>
              <el-form-item label="结束时间">
                <el-date-picker
                  v-model="specialTagRequirement.eDate"
                  type="date"
                  placeholder="选择结束时间"
                  format="YYYY/MM/DD"
                  value-format="YYYY/MM/DD"
                />
              </el-form-item>
              <el-form-item label="奖励参数">
                <div
                  v-for="(reward, rewardIndex) in specialTagRequirement.reward"
                  :key="rewardIndex"
                >
                  <el-form-item label="投稿数">
                    <el-input-number v-model="reward.allNum" :min="0" :max="1000" />
                  </el-form-item>
                  <el-form-item label="视频总观看量(w)">
                    <el-input-number v-model="reward.allViewNum" :min="0" :max="100" />
                    <span v-if="reward.allViewNum">{{ reward.allViewNum * 10000 }}</span>
                  </el-form-item>
                  <el-form-item label="参与人数">
                    <el-input-number v-model="reward.joinedPerson" :min="0" :max="10000" />
                  </el-form-item>
                  <el-form-item label="视频单稿观看量(w)">
                    <el-input-number v-model="reward.view" :min="0" :max="100" />
                    <span v-if="reward.view">{{ reward.view * 10000 }}</span>
                  </el-form-item>
                  <el-form-item label="单稿件点赞">
                    <el-input-number v-model="reward.like" :min="0" :max="100000" />
                  </el-form-item>
                  <el-form-item label="稿件总点赞量">
                    <el-input-number v-model="reward.allLikeNum" :min="0" :max="1000000" />
                  </el-form-item>
                  <el-form-item label="投稿天数">
                    <el-input-number v-model="reward.cday" :min="0" :max="100" />
                  </el-form-item>
                  <el-form-item label="奖励金额(w)">
                    <el-input-number v-model="reward.money" :min="0" :max="100" />
                    <span v-if="reward.money">{{ reward.money * 10000 }}</span>
                  </el-form-item>
                  <el-form-item label="是否达标">
                    <el-switch v-model="reward.isGet" active-text="是" inactive-text="否" />
                  </el-form-item>
                  <el-button type="danger" @click="removeReward(index, rewardIndex)"
                    >删除</el-button
                  >
                </div>
                <el-button type="primary" @click="addReward(index)">添加奖励</el-button>
              </el-form-item>
              <el-button type="danger" @click="removeSpecialTagRequirement(index)"
                >删除活动赛道</el-button
              >
            </el-card>
          </div>
          <el-button type="primary" @click="addSpecialTagRequirement">添加活动赛道</el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelEditReward">取 消</el-button>
          <el-button type="primary" @click="confirmEditReward">确 定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElTable, ElTableColumn, ElProgress, ElEmpty } from 'element-plus'
import { ElMessage } from 'element-plus'

// 格式化成为 YYYY-MM-DD 的字符串
const formatDate = (timestamp) => {
  const date = new Date(timestamp * 1000)
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
}

// 计算天数差
const getDaysDiff = (timeStamp1, timeStamp2 = new Date().getTime()) => {
  const diffTime = timeStamp1 - timeStamp2
  const endDiffDate = diffTime / (1000 * 60 * 60 * 24)
  return Math.ceil(endDiffDate)
}

const copyTag = (tag) => {
  navigator.clipboard.writeText(tag)
  ElMessage.success('复制成功')
}

const editRewardDialogVisible = ref(false)
const editRewardForm = ref({
  platformName: '',
  specialTagRequirements: [
    {
      name: '',
      // minVideoTime: 6,
      // minView: 100,
      specialTag: '',
      // topic: '',
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

const addSpecialTagRequirement = () => {
  editRewardForm.value.specialTagRequirements.push({
    name: '',
    // minVideoTime: 6,
    // minView: 100,
    // topic: '',
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
  })
}

const removeSpecialTagRequirement = (index) => {
  editRewardForm.value.specialTagRequirements.splice(index, 1)
}

const addReward = (index) => {
  editRewardForm.value.specialTagRequirements[index].reward.push({
    allNum: undefined,
    allViewNum: undefined,
    joinedPerson: undefined,
    view: undefined,
    like: undefined,
    allLikeNum: undefined,
    cday: undefined,
    money: undefined,
    isGet: false,
  })
}

const removeReward = (index, rewardIndex) => {
  editRewardForm.value.specialTagRequirements[index].reward.splice(rewardIndex, 1)
}

const openEditRewardDialog = (gameName, platform) => {
  let specialTagRequirements = [
    {
      name: '',
      // minVideoTime: 6,
      // minView: 100,
      specialTag: '',
      // topic: '',
      eDate: '',
      reward: [
        {
          allNum: undefined,
          allViewNum: undefined,
          joinedPerson: undefined,
          view: undefined,
          like: undefined,
          allLikeNum: undefined,
          cday: undefined,
          money: undefined,
          isGet: false,
        },
      ],
    },
  ]
  if (platform?.specialTagRequirements) {
    specialTagRequirements = JSON.parse(JSON.stringify(platform?.specialTagRequirements))?.map(
      (specialTagRequirement) => {
        specialTagRequirement.reward = specialTagRequirement.reward
          .filter((reward) =>
            Object.values(reward).some((value) => value !== 0 && value !== false && value !== ''),
          )
          .map((e) => {
            if (e.allViewNum) e.allViewNum = e.allViewNum / 10000
            if (e.view) e.view = e.view / 10000
            if (e.money) e.money = e.money / 10000
            return e
          })
        return specialTagRequirement
      },
    )
  }
  editRewardForm.value = {
    platformName: platform?.name || '抖音',
    isUpdate: !!platform,
    specialTagRequirements: specialTagRequirements,
  }
  editRewardForm.value.gameName = gameName
  editRewardDialogVisible.value = true
}

const confirmEditReward = async () => {
  // 过滤掉未填写的参数
  const filteredReward = JSON.parse(JSON.stringify(editRewardForm.value))
  filteredReward.specialTagRequirements = filteredReward.specialTagRequirements.map(
    (specialTagRequirement) => {
      // specialTagRequirement.name = specialTagRequirement.name
      // delete specialTagRequirement.name
      specialTagRequirement.reward = specialTagRequirement.reward
        .filter((reward) =>
          Object.values(reward).some((value) => value !== 0 && value !== false && value !== ''),
        )
        .map((e) => {
          if (e.allViewNum) e.allViewNum = e.allViewNum * 10000
          if (e.view) e.view = e.view * 10000
          if (e.money) e.money = e.money * 10000
          return e
        })
      return specialTagRequirement
    },
  )
  // 发送后端请求更新奖励
  await fetch(`http://localhost:3000/addPlatformReward`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platformData: filteredReward }),
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

const allGameList = ref([])
const dialogVisible = ref(false)
const downloadSettings = ref({
  isDownload: true,
  checkNewAdd: false,
  allDownload: false,
  checkName: false,
  earliest: '2024/9/19',
  currentUpdateGameList: [],
})

const ffmpegDialogVisible = ref(false)
const musicOptions = ref(['billll', '难却'])
const ffmpegSettings = ref({
  onlyRename: true,
  checkName: false,
  beforeTime: 1,
  fps: 30,
  scalePercent: 0,
  replaceMusic: false,
  musicName: 'billll',
  gameName: '火影忍者',
  groupName: '攻略',
})

const handleDownloadSettings = (name) => {
  dialogVisible.value = true
  const gameItem = allGameList.value.find((item) => item.name === name)
  if (gameItem) {
    gameItem.checked = true
  }
}

const confirmDownloadSettings = async () => {
  downloadSettings.value.currentUpdateGameList = allGameList.value
    .filter((game) => game.checked)
    .map((game) => game.name)

  // 发送后端请求下载
  await fetch(`http://localhost:3000/downloadVideosAndGroup`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ downloadSettings: downloadSettings.value }),
  }).then((res) => {
    if (res.ok) {
      // fetchData()
      dialogVisible.value = false
      ElMessage.success('成功下载')
    }
  })
}
const confirmFFmpegSettings = async () => {
  // 发送后端请求下载
  await fetch(`http://localhost:3000/ffmpegHandleVideos`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ffmpegSettings: ffmpegSettings.value }),
  }).then((res) => {
    if (res.ok) {
      // fetchData()
      dialogVisible.value = false
      ElMessage.success('ffmpeg成功处理视频')
    } else {
      ElMessage.error('ffmpeg处理视频失败')
    }
  })
}

const cancelDownloadSettings = () => {
  dialogVisible.value = false
}

const getDaysHtml = (etime) => {
  return `活动结束${formatDate(etime)} <br> 还剩  <span class="${getDaysDiff(etime * 1000) < 7 && getDaysDiff(etime * 1000) > 0 ? 'text-red-500' : ''}"> ${getDaysDiff(etime * 1000)}天`
}

const getSpecialTagAll = (reward) => {
  if (!reward?.specialTagRequirements) {
    return ''
  }
  const a = [
    ...new Set(reward.specialTagRequirements.map((e) => e.specialTag.split(' ')).flat()),
  ].join(' ')
  return a
}

const getCommonTagAll = (row) => {
  const rewards = row.rewards
  if (!rewards) {
    return ''
  }
  const specialTagArr = [
    ...new Set(
      rewards
        .map((item) => getSpecialTagAll(item))
        .join(' ')
        .split(' '),
    ),
  ]
  const suppleTag = row?.suppleTag ? row.suppleTag.split(' ') : [] // 补充Tag,给B站/小红书提供

  return [...new Set( [row.name].concat(specialTagArr.concat(suppleTag)))].join(' ')
}

const bilibiliActTableData = ref([])
const gameTableData = ref([])
const dakaTableData = ref([])

const fetchData = async () => {
  try {
    const response = await fetch('http://localhost:3000/data')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const res = await response.json()
    bilibiliActTableData.value = res.bilibiliActData.filter((item) => {
      if (item.show) {
        return true
      }
      return item.etime > new Date().getTime() / 1000 && !item.notDo
    })
    dakaTableData.value = res.dakaData
    gameTableData.value = res.gameData.filter((item) => {
      // if (item.show) {
      return true
      // }
      return item.etime > new Date().getTime() / 1000
    })
    allGameList.value = res.allGameList.map((e) => ({ name: e, checked: false }))
    ElMessage.success('数据刷新成功')
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

const fetchNewActData = async () => {
  try {
    const response = await fetch('http://localhost:3000/getNewActData')
    const res = await response.json()
    if (res.code == -101) {
      return ElMessage.error('请先登录')
    }
    fetchData()
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

const fetchNewDakaData = async () => {
  try {
    const response = await fetch('http://localhost:3000/getNewDakaData')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    fetchData()
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

// 获取不友好的评论  评论接口 http://localhost:3000/unfavorableReply

const unfavorableReplyList = ref([])
const fetchUnfavorableReply = async () => {
  try {
    const response = await fetch('http://localhost:3000/unfavorableReply')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const res = await response.json()
    unfavorableReplyList.value = res
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

onMounted(() => {
  fetchData()
  // fetchUnfavorableReply()
})

const updateData = async (row, specialTag) => {
  await fetch(`http://localhost:3000/updateDataOne`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...row, specialTag }),
  }).then((res) => {
    if (res.ok) {
      fetchData()
    }
  })
}

const updateOnePlatData = async (rewardName) => {
  await fetch(`http://localhost:3000/updateOnePlatData`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rewardName }),
  }).then((res) => {
    if (res.ok) {
      fetchData()
    }
  })
}

const getCompletionPercentage = (requirement, videoData) => {
  let totalRequirements = 0
  let completedRequirements = 0
  const details = []
  const currentValues = {}
  const targetValues = {}

  for (const key in requirement) {
    if (key === 'money' || key === 'isGet' || key === 'minView' || key === 'joinedPerson') continue

    totalRequirements++
    const currentValue = getCurrentValue(key, videoData, requirement)
    const isCompleted = currentValue >= requirement[key]
    if (isCompleted) {
      completedRequirements++
    }
    details.push({
      key,
      required: requirement[key],
      current: currentValue,
      completed: isCompleted,
    })
    currentValues[key] = currentValue
    targetValues[key] = requirement[key]
  }

  return {
    percentage:
      totalRequirements === 1
        ? Math.min(
            (currentValues[Object.keys(requirement)[0]] /
              targetValues[Object.keys(requirement)[0]]) *
              100,
            100,
          )
        : (completedRequirements / totalRequirements) * 100,
    details,
    currentValues,
    targetValues,
  }
}

function getCurrentValue(key, data, requirement) {
  switch (key) {
    case 'allNum':
      return data.allNum
    case 'view':
      return Math.max(...data.onePlayNumList.map((item) => item.view))
    case 'cday':
      return calculateCday(data.onePlayNumList)
    case 'like':
      return data.onePlayNumList.reduce((sum, item) => sum + item.like, 0)
    case 'allLike':
      return data.allLike
    case 'allViewNum':
      return requirement?.minView
        ? data.onePlayNumList
            .filter((i) => i.view >= requirement?.minView)
            .reduce((sum, item) => sum + item.view, 0)
        : data.allViewNum
    default:
      return 0
  }
}

function calculateCday(onePlayNumList) {
  const uniqueDates = new Set()

  onePlayNumList.forEach((item) => {
    const dateString = formatDate(item.ctime) // Get YYYY-MM-DD format
    uniqueDates.add(dateString)
  })

  return uniqueDates.size
}

const getTooltipContent = (requirement, videoData) => {
  const completionInfo = getCompletionPercentage(requirement, videoData)
  let tooltipContent = ''

  completionInfo.details.forEach((detail) => {
    tooltipContent += `${detail.key}: ${detail.current}/${detail.required}`
    if (!detail.completed) {
      tooltipContent += ' (未完成)'
    }
    tooltipContent += '\n'
  })

  return tooltipContent.trim()
}

const getCompletionStatus = (requirement, videoData) => {
  const percentage = getCompletionPercentage(requirement, videoData)
  return percentage.percentage >= 100 ? 'success' : 'exception'
}

const formatRequirement = (requirement) => {
  if (requirement.allNum) {
    return `${requirement.allNum} videos`
  } else if (requirement.allViewNum) {
    return `${requirement.allViewNum} total views`
  } else if (requirement.view) {
    return `${requirement.view} views on one video`
  } else if (requirement.cday) {
    return `${requirement.cday} consecutive days`
  }
  return ''
}

const deleteUnfavorableReply = async (row) => {
  await fetch(`http://localhost:3000/deleteUnfavorableReply`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...row }),
  }).then((res) => {
    if (res.ok) {
      ElMessage.success('删除成功')
    }
  })
}
</script>

<style scoped>
.table-container {
  /* max-width: 1200px; */
  margin: 0 auto;
  padding: 20px;
}

h1 {
  font-size: 24px;
  margin-bottom: 20px;
}

h4 {
  margin-top: 10px;
  margin-bottom: 5px;
}

.el-progress {
  margin-bottom: 5px;
}
</style>
