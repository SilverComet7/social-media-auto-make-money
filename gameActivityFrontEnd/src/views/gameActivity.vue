<template>
  <div class="table-container">
    <el-backtop :right="100" :bottom="100" />

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="四平台游戏活动激励" name="platform">
        <div class="flex justify-between">
          <el-affix :offset="20" class="text-blue-800">
            <h4>公共标签参考</h4>
            <div class=" bg-red-300 h-[5vw] overflow-auto">
              <div>#游戏鉴赏官 #联机游戏</div>
              <div>#二次元 #音乐 #巅峰赛 #故事 #搞笑 #教程</div>
              <div>#MMORPG #古风 #逆水寒</div>
              <div>#射击游戏 #FPS #穿越火线 #无畏契约 #暗区突围 #三角洲行动 #枪战</div>
            </div>
          </el-affix>
          <div class="flex justify-between">
            <!-- 爬虫查询栏 -->
            <div class="operation-group bg-gray-300 p-4 rounded">
              <h3 class="text-lg font-bold mb-2 text-black">爬虫查询操作</h3>
              <div class="flex">
                <el-button type="primary" @click="updateOnePlatData('抖音')">查询视频数据</el-button>
                <el-button type="primary" @click="fetchNewActData">查询B站新活动</el-button>
              </div>
            </div>
            <!-- 视频下载处理栏 -->
            <div class="operation-group bg-blue-300 p-4 rounded">
              <h3 class="text-lg font-bold mb-2 text-black">视频处理操作</h3>
              <div class="flex">
                <el-button type="primary" @click="handleDownloadSettings">下载视频并分组</el-button>
                <el-button type="primary" @click="ffmpegDialogVisible = true">ffmpeg去重处理</el-button>
              </div>
            </div>
            <!-- 定时任务栏 -->
            <div class="operation-group bg-green-300 p-4 rounded">
              <h3 class="text-lg font-bold mb-2 text-black">定时任务操作</h3>
              <div class="flex">
                <el-button type="primary" @click="confirmScheduleJob(true)">执行定时任务</el-button>
                <el-button type="primary" @click="handleManualAccount">执行手动养号</el-button>
              </div>
            </div>
          </div>
          <el-affix :offset="20">
            <el-button type="primary" @click="fetchData">获取后台合并数据</el-button>
          </el-affix>
        </div>
        <el-table v-if="gameTableData.length" :data="gameTableData" style="width: 100%" border>
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="Game Name" width="250" fixed>
            <template #default="scope">
              <div :class="scope.row.notDo ? 'text-red-500' : ''">
                <a :href="scope.row.act_url" target="_blank" :class="scope.row.updateData || scope.row.new ? 'text-green-500 ' : 'text-blue-500'
                  " class="font-bold">
                  {{ scope.row.name }}
                </a>
                <div>
                  <el-button type="primary" @click="handleDownloadSettings(scope.row.name)">下载视频</el-button>
                  <el-button type="primary" @click="
                    ((ffmpegDialogVisible = true), (ffmpegSettings.gameName = scope.row.name))
                    ">ffmpeg处理</el-button>
                </div>
                <p>上一次更新时间 {{ scope.row.updateDate }}</p>
                <el-button type="primary" @click="updateData(scope.row)"
                  v-if="scope.row.searchKeyWord">更新B站数据</el-button>
                <p>任务结束日期 {{ formatDate(scope.row.etime) }}</p>
                <p>添加任务日期 {{ scope.row.addTime }}</p>
                <el-button type="primary" @click="openEditRewardDialog(scope.row.name)">添加平台奖励</el-button>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="allMoney" label="allMoney" width="150" sortable>
            <template #header>
              <el-tooltip class="item" effect="dark" content="总播放<5w,单稿件<10000,点赞<500,最低单稿播放<5000" placement="top">
                <span>allMoney <i class="el-icon-question"></i></span>
              </el-tooltip>
            </template>
            <template #default="scope">
              <span>{{ scope.row.allMoney }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="endDiffDate" label="剩余天数" width="150" sortable>
            <template #default="scope"> {{ getDaysDiff(scope.row.etime * 1000) }} 天 </template>
          </el-table-column>
          <el-table-column label="各平台活动与达标条件" min-width="650">
            <template #default="scope">
              <el-card v-for="(platform, platformIndex) in scope.row.rewards" :key="platformIndex">
                <div class="flex">
                  <div class="w-1/4">
                    <h4 class="font-bold" :class="platform.notDo ? 'text-red-500' : ''">
                      {{ platform.name }}
                    </h4>
                    <el-button type="primary" @click="openEditRewardDialog(scope.row.name, platform)">编辑</el-button>
                    <p class="text-blue-800 font-bold cursor-pointer" @click="copyTag(getSpecialTagAll(platform))">
                      TAG: {{ getSpecialTagAll(platform) }}
                    </p>
                    <p class="text-blue-800 cursor-pointer" v-if="platform.suppleTag"
                      @click="copyTag(platform.suppleTag)">
                      补充TAG: {{ platform.suppleTag }}
                    </p>
                  </div>
                  <div class="flex-1">
                    <template v-for="speReq in platform.specialTagRequirements">
                      <el-card :key="speReq" v-if="
                        speReq.eDate
                          ? getDaysDiff(new Date(speReq.eDate).getTime()) >= 0
                          : getDaysDiff(scope.row.etime * 1000) >= 0
                      ">
                        <div :class="speReq.isNotDo ? 'bg-red-300' : ''">
                          <a :href="speReq.act_url" target="_blank" class="font-bold text-blue-600"
                            v-if="platform.name === 'bilibili'">{{ speReq.name }} {{ speReq.comment }}</a>
                          <h4 class="font-bold" v-else>{{ speReq.name }}</h4>
                          <h4 class="font-bold" v-if="platform.name === 'bilibili'">
                            话题：{{ speReq.topic }}
                          </h4>
                          <el-button type="primary"
                            @click="setScheduleJob(speReq, platform, scope.row)">设置该活动定时执行任务</el-button>
                          <el-button type="info" v-if="
                            BiliBiliScheduleJob.find((e) => e.topicName === speReq.topic) ||
                            DouyinScheduleJob.find((e) => e.topicName === speReq.name)
                          " @click="showScheduleJobDialog(speReq, platform.name)">查看定时任务</el-button>
                          <h4 class="font-bold" v-if="speReq.eDate" :class="getDaysDiff(new Date(speReq.eDate).getTime()) <= 4
                            ? 'text-orange-500'
                            : ''
                            ">
                            活动结束{{ speReq.eDate }} 还剩{{
                              getDaysDiff(new Date(speReq.eDate).getTime())
                            }}天
                          </h4>
                          <div>
                            <p class="text-blue-800 cursor-pointer" @click="copyTag(speReq.specialTag)"
                              v-if="speReq.specialTag">
                              必带TAG:
                              {{ speReq.specialTag }}
                            </p>
                          </div>
                          <p v-if="speReq.minVideoTime">
                            单稿件最低时长：{{ speReq.minVideoTime || 6 }}s
                          </p>
                          <p v-if="speReq.minView">单稿件最低播放量：{{ speReq.minView || 100 }}</p>
                          <div v-for="(req, reqIndex) in speReq.reward" :key="reqIndex">
                            <span v-if="req.time"> 持续时间>={{ req.time }} </span>
                            <span v-if="req.allNum">总投稿数{{ req.allNum }} </span>
                            <span v-if="req.allViewNum" :class="req.allViewNum <= 20000 ? ' text-orange-500' : ''">
                              总播放量{{ req.allViewNum }}
                            </span>
                            <span v-if="req.view"> 单视频播放量{{ req.view }} </span>
                            <span v-if="req.cday"> 投稿天数>={{ req.cday }} </span>
                            <span v-if="req.like"> 单稿件点赞>={{ req.like }} </span>
                            <span v-if="req.allLikeNum"> 总点赞>={{ req.allLikeNum }} </span>
                            <span v-if="req.money" :class="req.money >= 50000 ? ' text-orange-500' : ''">=瓜分{{ req.money
                            }}</span>
                            <span v-if="req.minView">> | 单视频播放量>={{ req.minView }}计入</span>
                            <template v-if="speReq?.videoData">
                              <div v-for="r in speReq.videoData" :key="r">
                                {{ r.userName }}:
                                <el-tooltip effect="dark" placement="top-start"
                                  :content="getTooltipContent(req, r, platform)" v-if="r.userName">
                                  <el-progress :percentage="getCompletionPercentage(req, r).percentage"
                                    :status="getCompletionStatus(req, r)"
                                    :format="(percentage) => formatRequirement(req, percentage, r)" />
                                </el-tooltip>
                              </div>
                            </template>
                          </div>
                        </div>
                      </el-card>
                    </template>
                  </div>
                </div>
              </el-card>
            </template>
          </el-table-column>
          <el-table-column label="Tag All" min-width="400">
            <template #default="scope">
              <p class="text-blue-800 cursor-pointer" @click="copyTag(getCommonTagAll(scope.row))">
                总标签 :{{ getCommonTagAll(scope.row) }}
              </p>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="B站活动激励" name="bilibili" lazy>
        <el-table v-if="bilibiliActTableData.length" :data="bilibiliActTableData" style="width: 100%" border>
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="Activity Name" width="250" fixed>
            <template #default="scope">
              <div :class="scope.row.notDo ? 'text-red-500' : ''">
                <a :href="scope.row.act_url" target="_blank" :class="scope.row.updateData || scope.row.new ? 'text-green-500 ' : 'text-blue-500'
                  " class="font-bold">
                  {{ scope.row.name }}
                </a>
                <p>上一次更新时间 {{ scope.row.updateDate }}</p>
                <el-button type="primary" @click="updateData(scope.row)"
                  v-if="scope.row.searchKeyWord">更新B站数据</el-button>
                <p>视频时长需 {{ scope.row.timeRange ?? '>=30s' }}</p>
                <p>任务结束日期 {{ formatDate(scope.row.etime) }}</p>
                <p>添加任务日期 {{ scope.row.addTime }}</p>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="allMoney" label="allMoney 计入(总播放<5w,单稿件<10000,点赞<500,最低单稿播放<5000)" sortable=""
            width="150" />
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
                    <p class="text-blue-800" @click="copyTag(reward.baseTopic)" v-if="reward.baseTopic">
                      可选话题: {{ reward.baseTopic }}
                    </p>
                    <p class="text-blue-800 font-bold cursor-pointer" @click="copyTag(getSpecialTagAll(reward))">
                      特殊TAG: {{ getSpecialTagAll(reward) || reward.specialTagAll }}
                    </p>

                    <!-- <p class="text-blue-800 font-bold cursor-pointer" @click="copyTag(reward.specialTagAll)"
                      v-if="reward.specialTagAll">该平台通用TAG: {{ reward.specialTagAll }}</p> -->
                  </div>
                  <div class="w-1/2 mx-4" v-if="reward.requirements?.length">
                    <div v-for="(req, reqIndex) in reward.requirements" :key="reqIndex">
                      <span v-if="req.allNum">总投稿数{{ req.allNum }}</span>
                      <span v-if="req.allViewNum" :class="req.allViewNum <= 30000 ? ' text-orange-500' : ''">
                        <span>+</span>总播放量{{ req.allViewNum }}</span>
                      <span v-if="req.view" :class="req.view <= 3000 ? ' text-orange-500' : ''">
                        <span>+</span>单视频播放量{{ req.view }}</span>
                      <span v-if="req.cday"> <span>+</span>投稿天数>={{ req.cday }}</span>
                      <span v-if="req.like" :class="req.like <= 500 ? ' text-orange-500' : ''">
                        <span>+</span>点赞>={{ req.like }}</span>
                      <span v-if="req.money" :class="req.money >= 50000 ? ' text-orange-500' : ''">=瓜分{{ req.money
                      }}</span>
                      <el-tooltip effect="dark" placement="top-start"
                        :content="getTooltipContent(req, scope.row.bilibili)" v-if="scope.row.bilibili">
                        <el-progress :percentage="getCompletionPercentage(req, scope.row.bilibili).percentage"
                          :status="getCompletionStatus(req, scope.row.bilibili)" :format="(percentage) => formatRequirement(req, percentage, scope.row.bilibili)
                            " />
                      </el-tooltip>
                    </div>
                  </div>
                  <div v-if="
                    reward.specialTagRequirements &&
                    ['抖音', '快手', '小红书', 'bilibili'].includes(reward.name)
                  " class="flex-1">
                    <template v-for="(rew, reqIndex) in reward.specialTagRequirements">
                      <el-card :key="reqIndex" v-if="
                        rew.eDate
                          ? getDaysDiff(new Date(rew.eDate).getTime()) >= 0
                          : getDaysDiff(scope.row.etime * 1000) >= 0
                      ">
                        <!-- <h4 class="font-bold" v-if="rew.sDate">活动开始{{ rew.sDate }} </h4> -->
                        <h4 class="font-bold" v-if="rew.eDate" :class="getDaysDiff(new Date(rew.eDate).getTime()) <= 4 ? 'text-orange-500' : ''
                          ">
                          活动结束{{ rew.eDate }} 还剩{{
                            getDaysDiff(new Date(rew.eDate).getTime())
                          }}天
                        </h4>
                        <h4 class="font-bold">{{ rew.name }}</h4>
                        <div>
                          <p class="text-blue-800 cursor-pointer" @click="copyTag(rew.specialTag || rew.specialTagAll)"
                            v-if="rew.specialTag || rew.specialTagAll">
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
                          <span v-if="req.allViewNum" :class="req.allViewNum <= 20000 ? ' text-orange-500' : ''">
                            <span>+</span>总播放量{{ req.allViewNum }}</span>
                          <span v-if="req.view"> <span>+</span>单视频播放量{{ req.view }}</span>
                          <span v-if="req.cday"> <span>+</span>投稿天数>={{ req.cday }}</span>
                          <span v-if="req.like"> <span>+</span>点赞>={{ req.like }}</span>
                          <span v-if="req.money" :class="req.money >= 50000 ? ' text-orange-500' : ''">=瓜分{{ req.money
                          }}</span>

                          <span v-if="req.minView">> | 单视频播放量>={{ req.minView }}计入</span>

                          <!-- 多个账号的完成情况 -->
                          <!-- {{ reward.name }} -->
                          <template v-if="rew?.videoData">
                            <div v-for="r in rew.videoData" :key="r">
                              {{ r.userName }}:
                              <el-tooltip effect="dark" placement="top-start"
                                :content="getTooltipContent(req, r, reward)" v-if="r.userName">
                                <el-progress :percentage="getCompletionPercentage(req, r).percentage"
                                  :status="getCompletionStatus(req, r)"
                                  :format="(percentage) => formatRequirement(req, percentage, r)" />
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
              <p class="text-blue-800 cursor-pointer"
                @click="copyTag(getCommonTagAll(scope.row) || scope.row.commonTagALL)">
                总标签 :{{ getCommonTagAll(scope.row) || scope.row.commonTagALL }}
              </p>
              <div v-if="scope.row?.bilibili?.onePlayNumList.length >= 1">
                <p v-for="(video, index) in scope.row.bilibili.onePlayNumList" :key="index">
                  <a :href="`https://www.bilibili.com/video/${video.bvid}/?spm_id_from=333.337.search-card.all.click&vd_source=c9acef8cde35247caf98fa45c32fe95f`"
                    target="_blank" class="text-blue-500">{{ video.title }}</a>
                  ({{ video.view }} 播放) ({{ video.like }} 点赞) ({{ video.reply }} 回复)
                </p>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="No data available" />
      </el-tab-pane>
      <el-tab-pane label="B站打卡挑战" name="bilibili_daka" lazy>
        <el-affix :offset="20" :right="20" class="right-4">
          <el-button type="primary" @click="fetchNewDakaData">查询新的打卡挑战数据</el-button>
        </el-affix>
        <el-table :data="dakaTableData" style="width: 100%" border>
          <el-table-column prop="title" label="活动标题" width="180">
            <template #default="scope">
              <a :href="`https://member.bilibili.com/york/platform-punch-card/detail?navhide=1&id=${scope.row.act_id}&from=1`"
                target="_blank">
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
              <el-tag v-for="tag in scope.row.detail.act_rule.topic" :key="tag" style="margin-right: 5px">
                {{ tag.name }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="etime" label="结束时间" width="180">
            <template #default="scope">
              <div v-html="getDaysHtml(scope.row.etime)"></div>
              <div v-html="scope.row.detail.task_data?.main?.desc || scope.row.detail.task_data?.desc"></div>
            </template>
          </el-table-column>
          <el-table-column label="规则文本" width="300">
            <template #default="scope">
              <div v-html="scope.row.detail.rule_text.split('\n\n【打卡稿件的要求】\n')[0]" />
            </template>
          </el-table-column>
          <el-table-column label="任务数据" min-width="1000">
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
                            <span :class="scope.row.target_value <= scope.row.target_progress
                              ? 'text-emerald-400'
                              : ''
                              ">{{ scope.row.award_name }}
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
                            <el-progress :percentage="scope.row.target_value !== 0
                              ? Math.round((scope.row.target_progress / scope.row.target_value) * 100)
                              : 0
                              " />
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
                      <span :class="scope.row.target_value <= scope.row.target_progress
                        ? 'text-emerald-400'
                        : ''
                        ">{{ scope.row.award_name }}
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
      <!-- <el-tab-pane label="B站稿件的评论管理">
        <el-button type="primary" @click="fetchUnfavorableReply">查询所有不喜欢的评论</el-button>
        <div v-for="(unfavorableReply, index) in unfavorableReplyList" :key="index">
          {{ unfavorableReply.message }}
          <el-button type="primary" @click="deleteUnfavorableReply(unfavorableReply)"
            >delete</el-button
          >
        </div>
      </el-tab-pane> -->
    </el-tabs>

    <el-dialog title="下载视频和分组区分" v-model="dialogVisible" :before-close="cancelDownloadSettings">
      <el-form :model="downloadSettings" label-width="150px">
        <el-form-item label="下载视频">
          <el-switch v-model="downloadSettings.isDownload" active-text="是" inactive-text="否" />
        </el-form-item>
        <div v-if="downloadSettings.isDownload">
          <el-form-item label="下载策略">
            <el-radio-group v-model="downloadSettings.selectedStrategy">
              <el-radio label="group">按分组下载</el-radio>
              <el-radio label="keyword">关键词下载</el-radio>
              <el-radio label="file">读取download.txt</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="downloadSettings.selectedStrategy === 'keyword'">
            <el-form-item label="关键词">
              <el-input v-model="downloadSettings.keyword" placeholder="输入视频关键词，多个用逗号分隔" />
            </el-form-item>
          </template>

          <template v-if="downloadSettings.selectedStrategy === 'file'">
            <el-form-item label="文件路径">
              <el-input v-model="downloadSettings.filePath" placeholder="输入download.txt完整路径" />
            </el-form-item>
          </template>

          <template v-if="downloadSettings.selectedStrategy === 'group'">
            <el-form-item label="选择分组">
              <el-checkbox v-for="game in allGameList" :key="game.name" v-model="game.checked" :label="game.name" />
            </el-form-item>
          </template>
          <el-form-item label="新旧JSON文件对比">
            <el-switch v-model="downloadSettings.checkNewAdd" active-text="是" inactive-text="否" />
          </el-form-item>
          <el-form-item label="开启全部视频下载">
            <el-switch v-model="downloadSettings.allDownload" active-text="是" inactive-text="否" />
          </el-form-item>

          <el-form-item label="视频开始时间">
            <el-input v-model="downloadSettings.earliest" placeholder="统一下载的最早时间 xx/xx/xx" />
          </el-form-item>
        </div>

        <el-form-item label="分组只检测名称">
          <el-switch v-model="downloadSettings.checkName" active-text="是" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelDownloadSettings">取 消</el-button>
          <el-button type="primary" @click="confirmDownloadSettings">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- ffmpeg dialog -->
    <el-dialog title="FFmpeg 处理设置" v-model="ffmpegDialogVisible">
      <el-form :model="ffmpegSettings" label-width="250px">
        <el-form-item label="名称">
          <el-select v-model="ffmpegSettings.gameName" placeholder="请输入游戏名称" filterable clearable>
            <el-option v-for="game in allGameList" :key="game.name" :label="game.name" :value="game.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="分组">
          <el-select v-model="ffmpegSettings.groupName" placeholder="请选择分组" filterable clearable>
            <el-option label="攻略" value="攻略" />
            <el-option v-for="game in allGameList" :key="game.name" :label="game.name" :value="game.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理地址">
          <el-input v-model="ffmpegSettings.videoDir" placeholder="请输入处理地址" />
        </el-form-item>
        <el-form-item label="添加发布时间">
          <el-switch v-model="ffmpegSettings.addPublishTime" active-text="是" inactive-text="否" />
        </el-form-item>

        <el-form-item label="单独检测名称">
          <el-switch v-model="ffmpegSettings.checkName" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="仅重命名">
          <el-switch v-model="ffmpegSettings.onlyRename" active-text="是" inactive-text="否" />
        </el-form-item>
        <div v-if="!ffmpegSettings.onlyRename && !ffmpegSettings.checkName">
          <el-divider>视频去重配置</el-divider>
          <el-form-item label="是否开启去重配置">
            <el-switch v-model="ffmpegSettings.deduplicationConfig.enable" @change="handleDeduplicationChange" />
            <div v-if="ffmpegSettings.deduplicationConfig.enable">
              <el-form-item label="变速因子">
                <el-slider v-model="ffmpegSettings.deduplicationConfig.speedFactor" :min="0.8" :max="1.2"
                  :step="0.05" />
              </el-form-item>

              <el-form-item label="启用镜像">
                <el-switch v-model="ffmpegSettings.deduplicationConfig.enableMirror" />
              </el-form-item>

              <el-form-item label="启用旋转">
                <el-switch v-model="ffmpegSettings.deduplicationConfig.enableRotate" />
                <el-input-number v-if="ffmpegSettings.deduplicationConfig.enableRotate"
                  v-model="ffmpegSettings.deduplicationConfig.rotateAngle" :min="0" :max="360" :step="1" />
              </el-form-item>

              <el-form-item label="启用模糊">
                <el-switch v-model="ffmpegSettings.deduplicationConfig.enableBlur" />
                <el-slider v-if="ffmpegSettings.deduplicationConfig.enableBlur"
                  v-model="ffmpegSettings.deduplicationConfig.blurRadius" :min="0" :max="1" :step="0.1" />
              </el-form-item>

              <el-form-item label="启用淡入淡出">
                <el-switch v-model="ffmpegSettings.deduplicationConfig.enableFade" />
                <el-input-number v-if="ffmpegSettings.deduplicationConfig.enableFade"
                  v-model="ffmpegSettings.deduplicationConfig.fadeDuration" :min="0" :max="2" :step="0.1" />
              </el-form-item>

              <el-form-item label="亮度调整">
                <el-slider v-model="ffmpegSettings.deduplicationConfig.brightness" :min="-1" :max="1" :step="0.1" />
              </el-form-item>

              <el-form-item label="对比度调整">
                <el-slider v-model="ffmpegSettings.deduplicationConfig.contrast" :min="0" :max="2" :step="0.1" />
              </el-form-item>

              <el-form-item label="饱和度调整">
                <el-slider v-model="ffmpegSettings.deduplicationConfig.saturation" :min="0" :max="2" :step="0.1" />
              </el-form-item>

              <!-- <el-divider>背景虚化设置</el-divider> -->
              <el-form-item label="启用背景虚化">
                <el-switch v-model="ffmpegSettings.deduplicationConfig.enableBgBlur" />
              </el-form-item>

              <template v-if="ffmpegSettings.deduplicationConfig.enableBgBlur">
                <el-form-item label="上部虚化比例">
                  <el-slider v-model="ffmpegSettings.deduplicationConfig.bgBlurTop" :min="0" :max="1" :step="0.1" />
                </el-form-item>

                <el-form-item label="下部虚化比例">
                  <el-slider v-model="ffmpegSettings.deduplicationConfig.bgBlurBottom" :min="0" :max="1" :step="0.1" />
                </el-form-item>
              </template>
            </div>
          </el-form-item>

          <el-divider>基础变换</el-divider>
          <el-form-item label="截取开始时间n秒后">
            <el-input-number v-model="ffmpegSettings.beforeTime" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="帧率">
            <el-input-number v-model="ffmpegSettings.fps" :min="30" :max="60" />
          </el-form-item>
          <el-form-item label="分辨率百分比">
            <el-input-number v-model="ffmpegSettings.scalePercent" :min="0" :max="100" />
          </el-form-item>



          <el-form-item label="单视频替换音乐">
            <el-switch v-model="ffmpegSettings.replaceMusic" active-text="是" inactive-text="否" />
            <el-select v-model="ffmpegSettings.musicName" placeholder="请选择音乐" v-if="ffmpegSettings.replaceMusic">
              <el-option v-for="music in musicOptions" :key="music" :label="music" :value="music" />
            </el-select>
          </el-form-item>

          <!-- 新增合并视频控制选项 -->
          <el-divider>合并视频设置</el-divider>
          <el-form-item label="启用视频合并">
            <el-switch v-model="ffmpegSettings.enableMerge" />
          </el-form-item>

          <el-form-item label="合并时长限制(秒)" v-if="ffmpegSettings.enableMerge">
            <el-input-number v-model="ffmpegSettings.mergedLimitTime" :min="10" :max="60" :step="5" />
          </el-form-item>

          <!-- 合集音乐控制 -->
          <el-form-item label="启用合集音乐" v-if="ffmpegSettings.enableMerge">
            <el-switch v-model="ffmpegSettings.enableMergeMusic" />
            <el-select v-if="ffmpegSettings.enableMergeMusic" v-model="ffmpegSettings.mergeMusicName"
              placeholder="请选择音乐">
              <el-option v-for="music in musicOptions" :key="music" :label="music" :value="music" />
            </el-select>
          </el-form-item>

        </div>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="confirmFFmpegSettings">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 设置奖励dialog -->
    <el-dialog title="编辑奖励" v-model="editRewardDialogVisible" width="50%" :before-close="cancelEditReward">
      <el-form :model="editRewardForm" label-width="150px">
        <el-form-item label="平台名称">
          <el-select v-model="editRewardForm.platformName" placeholder="请选择平台">
            <el-option label="bilibili" value="bilibili" />
            <el-option label="抖音" value="抖音" />
            <el-option label="小红书" value="小红书" />
            <el-option label="快手" value="快手" />
          </el-select>
        </el-form-item>
        <el-form-item label="B站多标签引流" v-if="editRewardForm.platformName === 'bilibili'">
          <el-input v-model="editRewardForm.suppleTag" placeholder="请输入支撑标签" />
        </el-form-item>
        <el-form-item label="活动赛道">
          <div v-for="(specialTagRequirement, index) in editRewardForm.specialTagRequirements" :key="index">
            <el-card>
              <el-form-item label="活动名称">
                <el-input v-model="specialTagRequirement.name" placeholder="请输入活动名称" />
              </el-form-item>
              <!-- el-switch 不做该任务（展示但整个框标橙色） 参与人数多|奖励少 -->
              <el-form-item label="不做该任务">
                <el-switch v-model="specialTagRequirement.isNotDo" active-text="是" inactive-text="否" />
              </el-form-item>
              <el-form-item label="视频最低时长">
                <el-input-number v-model="specialTagRequirement.minVideoTime" />
              </el-form-item>
              <el-form-item label="视频最低观看量">
                <el-input-number v-model="specialTagRequirement.minView" />
              </el-form-item>
              <el-form-item label="B站活动话题" v-if="editRewardForm.platformName === 'bilibili'">
                <el-input v-model="specialTagRequirement.topic" placeholder="请输入活动话题" />
              </el-form-item>
              <el-form-item label="必带标签">
                <el-input v-model="specialTagRequirement.specialTag" placeholder="请输入必带标签" />
              </el-form-item>
              <el-form-item label="结束时间">
                <el-date-picker v-model="specialTagRequirement.eDate" type="date" placeholder="选择结束时间"
                  format="YYYY/MM/DD" value-format="YYYY/MM/DD" />
              </el-form-item>
              <el-form-item label="奖励参数">
                <div v-for="(reward, rewardIndex) in specialTagRequirement.reward" :key="rewardIndex">
                  <el-form-item label="投稿数">
                    <el-input-number v-model="reward.allNum" :min="0" :max="1000" />
                  </el-form-item>
                  <el-form-item label="视频总观看量(w)">
                    <el-input-number v-model="reward.allViewNum" :min="0" :max="100" />
                    <span v-if="reward.allViewNum">{{ reward.allViewNum * 10000 }}</span>
                  </el-form-item>
                  <el-form-item label="视频最低播放量计入">
                    <el-input-number v-model="reward.minView" :min="0" />
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

                  <el-button type="danger" @click="removeReward(index, rewardIndex)">删除</el-button>
                </div>
                <el-button type="primary" @click="addReward(index)">添加奖励</el-button>
              </el-form-item>

              <el-button type="danger" @click="removeSpecialTagRequirement(index)">删除活动赛道</el-button>
            </el-card>
          </div>
          <el-button type="primary" @click="addSpecialTagRequirement">添加活动赛道</el-button>
        </el-form-item>
        <!-- <el-form-item label="不做该任务（展示但整个框标橙色） 参与人数多|奖励少 ">
          <el-switch v-model="editRewardForm.isNotDo" active-text="是" inactive-text="否" />
        </el-form-item> -->
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelEditReward">取 消</el-button>
          <el-button type="primary" @click="confirmEditReward">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 设置定时上传任务 -->
    <el-dialog title="设置定时上传任务" v-model="scheduleDialogVisible" :before-close="cancelScheduleJob">
      <el-form :model="scheduleForm" label-width="120px">
        <el-form-item label="游戏名称">
          <el-input v-model="scheduleForm.gameName" placeholder="请输入游戏名称" />
        </el-form-item>
        <el-form-item label="活动名称">
          <el-input v-model="scheduleForm.topicName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="视频目录">
          <el-input v-model="scheduleForm.videoDir" placeholder="请输入视频所在目录路径" />
        </el-form-item>
        <!-- 活动结束时间 -->
        <el-form-item label="活动结束时间">
          <el-date-picker v-model="scheduleForm.etime" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
        <el-form-item label="特殊赛道标签组">
          <el-select v-model="selectedTrack" placeholder="选择特殊赛道" @change="handleTrackChange"
            style="margin-bottom: 10px" clearable>
            <el-option v-for="(config, track) in specialTrackConfigs" :key="track" :label="track" :value="track">
              <div>
                <div>{{ track }}</div>
                <small class="text-gray-500">
                  {{ config.baseTags.join(' ') }}
                </small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="scheduleForm.tag" type="textarea" :rows="3" placeholder="标签将根据选择的赛道自动生成，也可以手动编辑" />
        </el-form-item>

        <el-form-item label="开始时间">
          <el-date-picker v-model="scheduleForm.startTime" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="上传间隔(小时)">
          <el-input-number v-model="scheduleForm.intervalHours" :min="1" :max="24" placeholder="请输入上传间隔" />
        </el-form-item>



        <template v-if="scheduleForm.platform === 'bilibili'">
          <el-form-item label="分区选择">
            <el-select v-model="scheduleForm.selectedArea" placeholder="请选择分区" @change="handleAreaChange">
              <el-option v-for="area in bilibiliTid" :key="area.name" :label="area.name" :value="area.name" />
            </el-select>
            <el-select v-model="scheduleForm.tid" placeholder="请选择子分区">
              <el-option v-for="subArea in getSubAreas" :key="subArea.tid" :label="subArea.name" :value="subArea.tid" />
            </el-select>
          </el-form-item>
          <el-form-item label="活动ID">
            <el-input v-model="scheduleForm.missionId" placeholder="请输入活动ID" />
          </el-form-item>
        </template>




      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="cancelScheduleJob">取 消</el-button>
          <el-button type="primary" @click="confirmScheduleJob(false)">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 定时任务查看弹窗 -->
    <el-dialog title="定时任务列表" v-model="scheduleJobDialogVisible" width="70%">
      <template v-if="currentScheduleJob">
        <h3 class="mb-4">活动名称: {{ currentScheduleJob.topicName }}</h3>
        <el-table :data="currentScheduleJob.scheduleJob" style="width: 100%">
          <el-table-column label="视频文件" min-width="300">
            <template #default="scope">
              {{ getFileName(scope.row.videoPath) }}
            </template>
          </el-table-column>
          <el-table-column label="执行时间" width="200">
            <template #default="scope">
              {{ formatDateTime(scope.row.execTime) }}
            </template>
          </el-table-column>
          <el-table-column label="已执行账号" min-width="200">
            <template #default="scope">
              <el-tag v-for="account in scope.row.successExecAccount" :key="account" class="mr-2">
                {{ account }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>
      <template v-else>
        <el-empty description="未找到相关定时任务" />
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
// import topicJson from '../../public/topic.json'
import bilibiliTid from '../../public/bilibiliTid.json'

interface BilibiliArea {
  name: string
  children: {
    tid: number
    name: string
  }[]
}

interface VideoData {
  userName: string
  allNum: number
  onePlayNumList: Array<{
    view: number
    like: number
    reply: number
    ctime: number
    title: string
    bvid: string
  }>
  allViewNum: number
  allLike: number
}

interface Reward {
  allNum?: number
  allViewNum?: number
  joinedPerson?: number
  view?: number
  like?: number
  allLikeNum?: number
  cday?: number
  minView?: number
  money?: number
  isGet: boolean
}

interface SpecialTagRequirement {
  name: string
  specialTag: string
  eDate: string
  isNotDo?: boolean
  minVideoTime?: number
  minView?: number
  topic?: string
  reward: Reward[]
  videoData?: VideoData[]
}

interface PlatformReward {
  name: string
  specialTagRequirements: SpecialTagRequirement[]
  suppleTag?: string
}

interface GameActivity {
  name: string
  act_url: string
  etime: number
  addTime: string
  rewards: PlatformReward[]
  updateDate?: string
  searchKeyWord?: string
  notDo?: boolean
  new?: boolean
  updateData?: boolean
  bilibili?: VideoData
}

interface ScheduleForm {
  gameName: string
  platform: string
  tag: string
  topicName: string
  videoDir: string
  tid: number
  missionId: string
  startTime: Date | null
  intervalHours: number
  immediately: boolean
  selectedArea: string
  etime: Date | null  // 添加活动结束时间字段
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000)
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
}

// 计算天数差
const getDaysDiff = (timeStamp1: number, timeStamp2: number = new Date().getTime()): number => {
  const diffTime = timeStamp1 - timeStamp2
  const endDiffDate = diffTime / (1000 * 60 * 60 * 24)
  return Math.ceil(endDiffDate)
}

const copyTag = (tag: string): void => {
  navigator.clipboard.writeText(tag)
  ElMessage.success('复制成功')
}

// 新增的响应式变量
const scheduleDialogVisible = ref(false)
const scheduleForm = ref<ScheduleForm>({
  gameName: '',
  topicName: '',
  videoDir: '',
  tag: '',
  tid: 172,
  missionId: '',
  startTime: null,
  intervalHours: 24,
  platform: '',
  immediately: false,
  selectedArea: '游戏区',
  etime: null  // 初始化活动结束时间
})

// 打开定时任务设置弹窗
const setScheduleJob = (
  rew: SpecialTagRequirement,
  platform: PlatformReward,
  row: GameActivity,
) => {
  const { topic, specialTag, eDate } = rew
  const missionId = topicJson.value.find((item: any) => item.topic_name === topic)?.mission_id

  // B站平台 如果没有找到对应的 missionId
  if (!missionId && platform.name === 'bilibili') {
    ElMessage.error('没有找到对应的 missionId')
    return
  }

  // 生成全量标签：活动标签 + 支撑标签 + 游戏名称
  const allTag = [
    ...new Set([
      '#' + row.name,
      ...(specialTag?.split(/\s+/) || []),
      ...(platform.suppleTag?.split(/\s+/) || []),
    ]),
  ]
    .filter(Boolean)
    .map((t) => {
      if (platform.name === 'bilibili') {
        return t.startsWith('#') ? t.slice(1) : t
      }
      return t.startsWith('#') ? t : `#${t}`
    })
    .join(platform.name === 'bilibili' ? ',' : ' ')

  scheduleForm.value = {
    gameName: row.name,
    topicName: topic || rew.name,
    platform: platform.name,
    tag: allTag,
    missionId: missionId || '',
    startTime: null,
    intervalHours: 24,
    immediately: false,
    selectedArea: '游戏区',
    tid: 172,
    videoDir: '',
    etime: eDate ? new Date(eDate) : null  // 设置活动结束时间
  }

  scheduleDialogVisible.value = true
}

// 取消设置
const cancelScheduleJob = () => {
  scheduleDialogVisible.value = false
}

// 确认设置
const confirmScheduleJob = async (immediately = false) => {
  try {
    const response = await fetch('http://localhost:3000/scheduleUpload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...scheduleForm.value, immediately }),
    })

    if (!response.ok) {
      throw new Error('设置失败')
    }

    const result = await response.json()
    if (result.code === 200) {
      ElMessage.success('定时任务设置成功')
      scheduleDialogVisible.value = false
      fetchData()
    } else {
      ElMessage.error(result.msg || '设置失败')
    }
  } catch (error) {
    console.error('设置定时任务失败:', error)
    ElMessage.error('设置定时任务失败')
  }
}
const activeTab = ref('platform')

const editRewardDialogVisible = ref(false)
const editRewardForm = ref({
  platformName: '',
  specialTagRequirements: [
    {
      name: '',
      // minVideoTime: 6,
      // minView: 100,
      // topic: '',
      specialTag: '',
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
          minView: undefined,
          money: undefined,
          isGet: false,
        },
      ],
    },
  ],
})

const addSpecialTagRequirement = () => {
  editRewardForm.value.specialTagRequirements.push({
    name: '',
    specialTag: '',
    eDate: '',
    reward: [],
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
    minView: undefined,
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
          minView: undefined,
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
    ...platform,
    platformName: platform?.name || '抖音',
    isUpdate: !!platform,
    specialTagRequirements: specialTagRequirements,
  }
  editRewardForm.value.gameName = gameName
  editRewardDialogVisible.value = true
}

const confirmEditReward = async () => {
  const filteredReward = JSON.parse(JSON.stringify(editRewardForm.value))
  filteredReward.specialTagRequirements = filteredReward.specialTagRequirements.map(
    (specialTagRequirement) => {
      // specialTagRequirement.name = specialTagRequirement.name
      // delete specialTagRequirement.name
      specialTagRequirement.reward = specialTagRequirement.reward
        .filter((reward) =>
          // 过滤出起码有一个值的参数
          Object.values(reward).some((value) => value !== 0 && value !== false && value !== ''),
        )
        .map((e) => {
          if (e.allViewNum) e.allViewNum = e.allViewNum * 10000
          if (e.view) e.view = e.view * 10000
          if (e.money) e.money = e.money * 10000
          // 删除未填写的参数
          Object.keys(e).forEach((key) => {
            // null undefined 空字符串 空数组 空对象
            if (e[key] === undefined || e[key] === null) {
              delete e[key]
            }
          })
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
  selectedStrategy: 'group',
  keyword: '',
  filePath: '',
  checkNewAdd: false,
  allDownload: false,
  checkName: false,
  earliest: '2025/01/01', // 近两个月
  currentUpdateGameList: [],
})

const ffmpegDialogVisible = ref(false)
const musicOptions = ref(['billll', '难却'])
// 定义不同类别的默认去重配置
const defaultDeduplicationConfigs = {
  攻略: {
    speedFactor: 0.9,
    enableMirror: false,
    enableRotate: true,
    rotateAngle: 0.5,
    enableBlur: false,
    blurRadius: 0.2,
    enableFade: false,
    fadeDuration: 0.5,
    brightness: 0.05,
    contrast: 1.02,
    saturation: 1.04,
    enableBgBlur: false,
    bgBlurTop: 0.1,
    bgBlurBottom: 0.1,
  },
  coser: {
    speedFactor: 0.9,
    enableMirror: false,
    enableRotate: true,
    rotateAngle: 0.5,
    enableBlur: false,
    blurRadius: 0.2,
    enableFade: false,
    fadeDuration: 0.5,
    brightness: 0.05,
    contrast: 1.02,
    saturation: 1.04,
    enableBgBlur: false,
    bgBlurTop: 0.1,
    bgBlurBottom: 0.1,
  },
}
const ffmpegSettings = ref({
  onlyRename: false,
  checkName: false,
  beforeTime: 1,
  fps: 30,
  scalePercent: 0,  // 1920X1080
  replaceMusic: false,
  musicName: 'billll',
  gameName: '',
  groupName: '',
  addPublishTime: false,
  deduplicationConfig: {
    enable: false,
    ...defaultDeduplicationConfigs.coser,
  },

  enableMerge: false,
  mergedLimitTime: 30,
  enableMergeMusic: false,
  mergeMusicName: 'billll',
})

// 处理去重开关变化
const handleDeduplicationChange = (value) => {
  if (value) {
    // 根据分组类型设置默认配置
    const isCoser = ffmpegSettings.value.groupName.includes('coser')
    const defaultConfig = isCoser
      ? defaultDeduplicationConfigs.coser
      : defaultDeduplicationConfigs.攻略

    // 更新去重配置
    ffmpegSettings.value.deduplicationConfig = {
      enable: true,
      ...defaultConfig,
    }
  }
}
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

  await fetch(`http://localhost:3000/downloadVideosAndGroup`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ downloadSettings: downloadSettings.value }),
  }).then((res) => {
    if (res.ok) {
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

  return [...new Set([row.name].concat(specialTagArr.concat(suppleTag)))].join(' ')
}

const bilibiliActTableData = ref([])
const gameTableData = ref([])
const dakaTableData = ref([])
const BiliBiliScheduleJob = ref([])
const DouyinScheduleJob = ref([])
const topicJson = ref([])

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
    gameTableData.value = res.gameData
    allGameList.value = res.allGameList.map((e) => ({ name: e, checked: false }))
    BiliBiliScheduleJob.value = res.scheduleJob.BiliBiliScheduleJob
    DouyinScheduleJob.value = res.scheduleJob.DouyinScheduleJob
    topicJson.value = res.topicJson

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

const handleManualAccount = async () => {
  try {
    const response = await fetch('http://localhost:3000/manualAccount')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const res = await response.json()
    if (res.code === 200) {
      ElMessage.success('手动养号成功')
    } else {
      ElMessage.error(res.msg || '手动养号失败')
    }
  } catch (error) {
    console.error('Error handling manual account:', error)
    ElMessage.error('手动养号失败')
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
  await fetch(`http://localhost:3000/getPlatformData`, {
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

// 添加新的响应式变量
const scheduleJobDialogVisible = ref(false)
const currentScheduleJob = ref(null)

// 添加新的方法
const showScheduleJobDialog = async (speReq?: any, platformType: string) => {
  try {
    let scheduleJob
    const { topic, name } = speReq
    if (platformType === 'bilibili') {
      scheduleJob = BiliBiliScheduleJob.value.find((e) => e.topicName === topic)
    } else if (platformType === '抖音') {
      scheduleJob = DouyinScheduleJob.value.find((e) => e.topicName === name)
    }
    currentScheduleJob.value = scheduleJob
    scheduleJobDialogVisible.value = true
  } catch (error) {
    console.error('获取定时任务失败:', error)
    ElMessage.error('获取定时任务失败')
  }
}

const getFileName = (path) => {
  return path.split('\\').pop()
}

const formatDateTime = (dateStr) => {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 添加计算属性获取子分区列表
const getSubAreas = computed(() => {
  const selectedArea = (bilibiliTid as BilibiliArea[]).find(
    (area) => area.name === scheduleForm.value.selectedArea,
  )
  return selectedArea ? selectedArea.children : []
})

// 处理分区变化
const handleAreaChange = () => {
  scheduleForm.value.tid = 0 // 清空子分区选择
}

interface SpecialTrackConfig {
  baseTags: string[]
  extraTags: string[]
}

interface SpecialTrackConfigs {
  [key: string]: SpecialTrackConfig
}

const selectedTrack = ref<string>('')

const specialTrackConfigs: SpecialTrackConfigs = {
  'coser本人': {
    baseTags: ['#coser', '#cos正片', '#cos', '#写真'],
    extraTags: ['#coser本人']
  },
  'coser同行': {
    baseTags: ['#coser', '#cos正片', '#cos', '#写真'],
    extraTags: ['#coser同行']
  },
  '搞笑': {
    baseTags: ['#搞笑', '#游戏搞笑', '#沙雕'],
    extraTags: ['#沙雕剪辑']
  }
}

// 使用 computed 属性计算特殊赛道的标签
const computedTrackTags = computed(() => {
  if (!selectedTrack.value || !scheduleForm.value?.gameName) {
    return ''
  }

  const config = specialTrackConfigs[selectedTrack.value]
  if (!config) return ''

  // 合并基础标签、额外标签和游戏名称
  const allTags = [
    ...new Set([
      `#${scheduleForm.value.gameName}`,
      ...config.baseTags,
      ...config.extraTags
    ])
  ]

  // 根据平台格式化标签
  return formatTagsByPlatform(allTags, scheduleForm.value.platform)
})

// 格式化标签函数
const formatTagsByPlatform = (tags: string[], platform: string): string => {
  const formattedTags = tags.map(tag => {
    if (platform === 'bilibili') {
      return tag.startsWith('#') ? tag.slice(1) : tag
    }
    return tag.startsWith('#') ? tag : `#${tag}`
  })

  return formattedTags.join(platform === 'bilibili' ? ',' : ' ')
}

// 处理赛道选择变化
const handleTrackChange = (value: string): void => {
  if (!value) {
    scheduleForm.value.tag = ''
    return
  }

  // 使用计算好的标签
  scheduleForm.value.tag = computedTrackTags.value
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

.operation-group {
  width: 32%;
  min-width: 300px;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.text-gray-500 {
  color: #6b7280;
  font-size: 12px;
}
</style>
