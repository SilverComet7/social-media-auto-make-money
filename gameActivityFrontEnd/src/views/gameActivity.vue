<template>
  <div class="table-container">
    <!-- 固定在顶层的标签面板 -->
    <div v-if="showTagPanel" class="fixed-tag-panel">
      <div class="panel-header">
        <h3>📌 标签速查面板</h3>
        <div class="panel-controls">
          <el-button size="small" type="info" @click="toggleTagPanelExpand">
            {{ tagPanelExpanded ? '收起' : '展开' }}
          </el-button>
          <el-button size="small" type="danger" @click="showTagPanel = false">
            关闭
          </el-button>
        </div>
      </div>

      <!-- 展开状态显示所有标签 -->
      <div v-if="tagPanelExpanded" class="panel-content">
        <!-- 赛道标签区域 -->
        <div class="track-tags-section">
          <div class="section-title">🎮 赛道标签库</div>
          <div class="track-controls">
            <el-button size="small" type="info" @click="toggleAllTracks">
              {{ expandedTracks.size === Object.keys(specialTrackTagConfigs).length ? '全部收起' : '全部展开' }}
            </el-button>
          </div>

          <div v-for="(trackConfig, trackName) in specialTrackTagConfigs" :key="trackName" class="track-group">
            <div class="track-header">
              <div class="track-header-left" @click="toggleTrack(trackName)">
                <span class="track-toggle">{{ expandedTracks.has(trackName) ? '▼' : '▶' }}</span>
                <span class="track-title">{{ trackName }}</span>
                <span class="tag-count">({{ trackConfig.baseTags.length + trackConfig.extraTags.length }})</span>
              </div>
              <el-button size="small" type="primary" class="track-copy-btn"
                @click="copyTrackTags(trackName, trackConfig)">
                复制
              </el-button>
            </div>

            <div v-if="expandedTracks.has(trackName)" class="track-content">
              <div class="tags-wrapper">
                <div v-for="tag in [...trackConfig.baseTags, ...trackConfig.extraTags]" :key="tag" class="tag-item"
                  @click="copyTag(tag)">
                  {{ tag }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 游戏对应的平台标签区域 -->
        <div v-if="currentGameName" class="game-section">
          <div class="section-title">🎯 游戏: {{ currentGameName }}</div>

          <!-- 按平台分组显示标签 -->
          <div v-for="platformTags in groupedTagsByPlatform" :key="platformTags.platform" class="platform-group">
            <div class="platform-header">
              <div class="platform-name">{{ platformTags.platform }}</div>
              <el-button size="small" type="primary" class="platform-copy-btn"
                @click="copyPlatformTags(platformTags.platform, platformTags.tags)">
                复制
              </el-button>
            </div>
            <div class="tags-wrapper">
              <div v-for="tag in platformTags.tags" :key="tag" class="tag-item" @click="copyTag(tag)">
                {{ tag }}
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">
          <p>选择游戏后显示标签</p>
        </div>
      </div>

      <!-- 收起状态仅显示摘要 -->
      <div v-else class="panel-summary">
        <span v-if="currentGameName">{{ currentGameName }}</span>
        <span v-else class="text-gray-400">未选择游戏</span>
      </div>
    </div>

    <!-- 显示/隐藏标签面板按钮 -->
    <el-button v-if="!showTagPanel" size="small" type="primary" class="open-tag-panel-btn" @click="showTagPanel = true">
      📌 打开标签速查
    </el-button>

    <el-backtop :right="100" :bottom="100" />
    <!-- 通用标签 -->

    <el-tabs v-model="activeTab" type="card">
      <el-tab-pane label="四平台游戏活动激励" name="platform">
        <div class="flex justify-between">
          <!-- 查询栏 -->
          <div class="operation-group bg-gray-300 p-4 rounded">
            <h3 class="text-lg font-bold mb-2 text-black">爬虫查询操作</h3>
            <div class="flex">
              <el-button type="primary" @click="platformDialogVisible = true">查询全平台视频数据</el-button>

              <!-- 平台选择弹窗 -->
              <el-dialog title="选择平台" v-model="platformDialogVisible">
                <el-checkbox-group v-model="selectedPlatformList">
                  <el-checkbox label="抖音">抖音</el-checkbox>
                  <el-checkbox label="小红书">小红书</el-checkbox>
                  <el-checkbox label="bilibili">bilibili</el-checkbox>
                </el-checkbox-group>
                <div class="mt-4 pt-4 border-t">
                  <el-checkbox v-model="clearPreviousData">
                    <span class="text-yellow-600 font-semibold">清除过往数据，仅使用新爬取数据重新计算</span>
                  </el-checkbox>
                  <div class="text-gray-500 text-sm mt-2 ml-6">
                    ⚠️ 勾选此项将清空选定平台所有用户的历史视频数据，仅保留本次爬取的数据进行统计
                  </div>
                </div>
                <template v-slot:footer>
                  <span class="dialog-footer">
                    <el-button @click="platformDialogVisible = false">取消</el-button>
                    <el-button type="primary" @click="confirmUpdatePlatforms">确定</el-button>
                  </span>
                </template>
              </el-dialog>
              <el-button type="primary" @click="fetchNewBiliBiliActivityData">查询B站新活动与Topic</el-button>
              <el-button type="primary" @click="fetchNewXhsActivityData">查询小红书新活动</el-button>
            </div>
          </div>
          <!-- 视频下载处理栏 -->
          <div class="operation-group bg-blue-300 p-4 rounded">
            <h3 class="text-lg font-bold mb-2 text-black">视频处理操作</h3>
            <div class="flex">
              <el-button type="primary" @click="handleDownloadSettings">下载视频后分组</el-button>
              <el-button type="primary" @click="batchFFmpegDialogVisible = true">批处理视频</el-button>
            </div>
          </div>
          <!-- 定时任务栏 -->
          <div class="operation-group bg-green-300 p-4 rounded">
            <h3 class="text-lg font-bold mb-2 text-black">定时任务操作</h3>
            <div class="flex">
              <el-button type="primary" @click="showUnfinishedTasksDialog">执行定时任务</el-button>
              <el-button type="primary" @click="handleManualAccount">执行手动养号</el-button>
            </div>
          </div>
        </div>

        <div class="flex  mb-4">
          <div class="space-y-3 p-3">
            <el-checkbox v-model="filterSettings.hideNoRewardGames">隐藏无奖励游戏</el-checkbox>
            <div class="flex items-center gap-2">
              <span class='text-black'>allMoney</span>
              <el-input-number v-model="filterSettings.allMoneyMin" :min="0" size="small" placeholder="最小"
                controls-position="right" />
              <span class='text-black'>~</span>
              <el-input-number v-model="filterSettings.allMoneyMax" :min="0" size="small" placeholder="最大"
                controls-position="right" />
            </div>
            <div class="flex items-center gap-2">
              <span class='text-black'>剩余天数</span>
              <el-input-number v-model="filterSettings.daysLeftMin" :min="0" size="small" placeholder="最小"
                controls-position="right" />
              <span class='text-black'>~</span>
              <el-input-number v-model="filterSettings.daysLeftMax" :min="0" size="small" placeholder="最大"
                controls-position="right" />
            </div>
            <div class="flex  gap-2">
              <el-button size="small" @click="resetFilterSettings">重置</el-button>
              <el-button type="primary" size="small">确定</el-button>
            </div>
          </div>

        </div>

        <el-table v-if="filteredGameTableData.length" :data="filteredGameTableData" style="width: 100%" border
          :default-sort="{ prop: 'endDiffDate', order: 'ascending' }">
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="Game Name" width="250" fixed>
            <template #default="scope">
              <div :class="scope.row.notDo ? 'text-red-500' : ''">
                <span :class="scope.row.updateData || scope.row.new ? 'text-green-500 ' : 'text-blue-500'
                  " class="font-bold cursor-pointer hover:underline"
                  @click="openSearchDialog(scope.row.name); handleGameNameClick(scope.row.name)">
                  {{ scope.row.name }}
                </span>
                <div>
                  <el-button type="primary" @click="handleDownloadSettings(scope.row.name)">下载视频</el-button>
                  <el-button type="primary" @click="
                    ((ffmpegDialogVisible = true), (ffmpegSettings.gameName = scope.row.name))
                    ">ffmpeg处理</el-button>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="allMoney" label="allMoney" width="150" sortable>
            <template #header>
              <div class="flex items-center">
                <el-tooltip class="item" effect="dark" content="总播放<5w,单稿件<10000,点赞<500,最低单稿播放<5000" placement="top">
                  <span>allMoney </span>
                </el-tooltip>
                <el-popover trigger="click" placement="bottom" width="260">
                  <div class="p-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <span>最小</span>
                      <el-input-number v-model="filterSettings.allMoneyMin" :min="0" size="mini"
                        controls-position="right" />
                    </div>
                    <div class="flex items-center gap-2">
                      <span>最大</span>
                      <el-input-number v-model="filterSettings.allMoneyMax" :min="0" size="mini"
                        controls-position="right" />
                    </div>
                    <div class="flex justify-end gap-2">
                      <el-button size="mini" @click="resetFilterSettings">重置</el-button>
                      <el-button type="primary" size="mini">确定</el-button>
                    </div>
                  </div>
                  <template #reference>
                    <el-icon>
                      <Filter />
                    </el-icon>
                  </template>
                </el-popover>
              </div>
            </template>
            <template #default="scope">
              <span>{{ scope.row.allMoney }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="endDiffDate" label="剩余天数" width="180" sortable>
            <template #header>
              <div class="flex items-center">
                <span>剩余天数</span>
                <el-popover trigger="click" placement="bottom" width="260">
                  <div class="p-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <span>最小</span>
                      <el-input-number v-model="filterSettings.daysLeftMin" :min="0" size="mini"
                        controls-position="right" />
                    </div>
                    <div class="flex items-center gap-2">
                      <span>最大</span>
                      <el-input-number v-model="filterSettings.daysLeftMax" :min="0" size="mini"
                        controls-position="right" />
                    </div>
                    <div class="flex justify-end gap-2">
                      <el-button size="mini" @click="resetFilterSettings">重置</el-button>
                      <el-button type="primary" size="mini">确定</el-button>
                    </div>
                  </div>
                  <template #reference>
                    <el-icon>
                      <Filter />
                    </el-icon>
                  </template>
                </el-popover>
              </div>
            </template>
            <template #default="scope"> {{ getDaysDiff(scope.row.etime * 1000) }} 天 </template>
          </el-table-column>
          <el-table-column label="各平台活动与达标条件" min-width="650">
            <template #default="scope">
              <el-card
                v-for="(platform, platformIndex) in scope.row.rewards.filter(p => p.activityRequirements.filter(e => !e.isNotDo).length > 0)"
                :key="platformIndex">
                <div class="flex">
                  <div class="w-1/4">
                    <h4 class="font-bold" :class="platform.notDo ? 'text-red-500' : ''">
                      {{ platform.name }}
                    </h4>
                    <el-button type="primary" @click="openEditRewardDialog(scope.row.name, platform)">编辑平台活动</el-button>
                    <p class="text-blue-800 font-bold cursor-pointer" @click="copyTag(getSpecialTagAll(platform))"
                      v-show="getSpecialTagAll(platform)">
                      平台全活动汇总标签: <span> {{ getSpecialTagAll(platform) }}</span>
                    </p>
                    <p class="text-blue-800 font-bold cursor-pointer" v-if="platform.suppleTag"
                      @click="copyTag(platform.suppleTag)">
                      平台标签: <span> {{ platform.suppleTag }}</span>
                    </p>
                    <!-- <p class="text-blue-800 font-bold cursor-pointer" v-if="platform.wyczjTag"
                      @click="copyTag(platform.wyczjTag)">
                      创作匠TAG: <span>{{ platform.wyczjTag }}</span>
                    </p> -->
                  </div>
                  <div class="flex-1">
                    <template
                      v-for="act in platform.activityRequirements.filter(a => !a.isNotDo && (a.eDate ? getDaysDiff(new Date(a.eDate).getTime()) >= 0 : getDaysDiff(scope.row.etime * 1000) >= 0))"
                      :key="act">
                      <el-card>
                        <div :class="act.isNotDo ? 'bg-red-300' : ''">
                          <a v-if="act.act_url" :href="act.act_url" target="_blank"
                            class="font-bold text-blue-600">活动名称：{{
                              act.name }} <br /> 参与人数：{{ act.comment }}</a>
                          <h4 class="font-bold text-blue-600" v-else>
                            活动名称：{{ act.name }}
                            <br /> 参与人数：
                            <span v-if="act.participantCount">{{ act.participantCount + "人参加"
                              }}</span>
                          </h4>
                          <h4 class="text-blue-800 cursor-pointer" v-if="platform.name === 'bilibili'"
                            @click="copyTag(act.topic, true)">
                            B站话题：{{ act.topic }} 总播放量：{{ act.arc_play_vv }}
                          </h4>
                          <el-button type="primary" @click="setScheduleJob(act, platform, scope.row)">设置定时任务</el-button>
                          <el-button :type="getScheduleJobButtonType(act, platform.name)" v-if="scheduleJobMap[platform.name]?.find((e) => e.topicName === act.topic || e.topicName === act.name)
                          " @click="showScheduleJobDialog(act, platform.name)">{{ getScheduleJobButtonType(act,
                            platform.name) === 'danger' ? '查看未完成任务' : '查看定时任务' }}</el-button>
                          <h4 v-if="act.eDate" class="font-bold" :class="getDaysDiff(new Date(act.eDate).getTime()) <= 10
                            ? 'text-orange-500'
                            : ''
                            ">

                            活动结束日期：{{ act.eDate }} 还剩{{
                              getDaysDiff(new Date(act.eDate).getTime())
                            }}天
                          </h4>
                          <p class="text-blue-800 cursor-pointer" v-if="act.specialTag">
                            <span @click="copyTag(act.specialTag, true)">活动必带标签（可跳转）：</span>
                            <span @click="copyTag(act.specialTag)">{{ act.specialTag }}</span>
                          </p>

                          <p v-if="act.hasRank">是否存在榜单：{{ act.hasRank ? '是' : "否" }}</p>
                          <p v-if="act.minVideoTime">
                            单稿件最低时长：{{ act.minVideoTime || 6 }}s
                          </p>
                          <P v-if="act.minImageCount" class="text-red-500">图片类型内容的最少张数：{{ act.minImageCount }}</P>
                          <p v-if="act.minView">单稿件最低播放量计入：{{ act.minView || 100 }}</p>
                          <P v-if="act.minLike">单稿件最低点赞量计入：{{ act.minLike || 0 }}</P>
                          <el-divider />
                          <div v-for="(req, reqIndex) in act.reward" :key="reqIndex">
                            <span v-if="req.allNum">总投稿数>={{ req.allNum }} </span>
                            <span v-if="req.view"> 单视频播放量>={{ req.view }} </span>
                            <span v-if="req.allViewNum" :class="req.allViewNum <= 20000 ? ' text-orange-500' : ''">
                              总播放量>={{ req.allViewNum }}
                            </span>
                            <span v-if="req.cday"> 投稿天数>={{ req.cday }} </span>
                            <span v-if="req.like"> 单稿件点赞>={{ req.like }} </span>
                            <span v-if="req.allLikeNum"> 总点赞>={{ req.allLikeNum }} </span>
                            <span v-if="req.allInteractionNum"> 总互动量>={{ req.allInteractionNum }} </span>
                            <span v-if="req.money" :class="req.money >= 50000 ? ' text-orange-500' : ''">=瓜分{{ req.money
                              }}</span>

                            <template v-if="act?.videoData">
                              <div v-for="vData in act.videoData" :key="vData">
                                {{ vData.userName }}:
                                <el-tooltip effect="dark" placement="top-start"
                                  :content="getTooltipContent(req, vData, act)" v-if="vData.userName">
                                  <el-progress :percentage="getCompletionPercentage(req, vData, act).percentage"
                                    :status="getCompletionStatus(req, vData, act)"
                                    :format="(percentage) => formatRequirement(req, percentage, vData, act)" />
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
              <el-button type="primary" @click="openEditRewardDialog(scope.row.name)">添加平台活动</el-button>
            </template>
          </el-table-column>
          <el-table-column label="Tag All" min-width="400">
            <template #default="scope">
              <p class="text-blue-800 cursor-pointer" @click="copyTag(getCommonTagAll(scope.row))">
                全平台活动标签汇总 :{{ getCommonTagAll(scope.row) }}
              </p>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="No data available" />
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
                  <div v-if="reward.activityRequirements
                  " class="flex-1">
                    <template v-for="(rew, reqIndex) in reward.activityRequirements">
                      <el-card :key="reqIndex" v-if="
                        rew.eDate
                          ? getDaysDiff(new Date(rew.eDate).getTime()) >= 0
                          : getDaysDiff(scope.row.etime * 1000) >= 0
                      ">
                        <!-- <h4 class="font-bold" v-if="rew.sDate">活动开始{{ rew.sDate }} </h4> -->
                        <h4 class="font-bold" v-if="rew.eDate" :class="getDaysDiff(new Date(rew.eDate).getTime()) <= 15 ? 'text-orange-500' : ''
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
  reward.activityRequirements.map((e) => e.specialTag).join(' ')
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
              <div v-if="scope.row?.bilibili?.videoList.length >= 1">
                <p v-for="(video, index) in scope.row.bilibili.videoList" :key="index">
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

      <el-tab-pane label="小红书活动激励" name="xhs" lazy>
        <el-table v-if="xhsActTableData.length" :data="xhsActTableData" border>
          <el-table-column type="index" label="No." width="50" fixed />
          <el-table-column prop="name" label="活动名称" width="250" fixed />
          <el-table-column prop="stime" label="开始" width="120">
            <template #default="scope">
              {{ new Date(scope.row.stime * 1000).toLocaleDateString() }}
            </template>
          </el-table-column>
          <el-table-column prop="etime" label="结束" width="120">
            <template #default="scope">
              {{ scope.row.etime ? new Date(scope.row.etime * 1000).toLocaleDateString() : '' }}
            </template>
          </el-table-column>
          <el-table-column prop="act_url" label="链接">
            <template #default="scope">
              <a :href="scope.row.act_url" target="_blank">查看</a>
            </template>
          </el-table-column>
          <el-table-column prop="allMoney" label="估算" width="100" sortable>
            <template #header>
              <el-tooltip class="item" effect="dark" content="总播放<5w" placement="top">
                <span>allMoney </span>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="No data available" />
      </el-tab-pane>
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
              <el-radio label="checkNewAdd">新旧JSON文件对比下载（新增账号时使用）</el-radio>
              <el-radio label="all">账号全部启用下载</el-radio>
              <!-- <el-radio label="keyword">关键词下载</el-radio> -->
              <el-radio label="filePath">读取download.txt</el-radio>
            </el-radio-group>
          </el-form-item>

          <template v-if="downloadSettings.selectedStrategy === 'group'">
            <el-form-item label="选择分组">
              <el-checkbox v-for="game in allGameList" :key="game.name" v-model="game.checked" :label="game.name" />
            </el-form-item>
          </template>



          <template v-if="downloadSettings.selectedStrategy === 'keyword'">
            <el-form-item label="关键词">
              <el-input v-model="downloadSettings.keyword" placeholder="输入视频关键词" />
            </el-form-item>
          </template>

          <template v-if="downloadSettings.selectedStrategy === 'filePath'">
            <el-form-item label="文件路径">
              <el-input v-model="downloadSettings.filePath" placeholder="输入download.txt完整路径" />
            </el-form-item>
          </template>

          <template v-if="!['keyword', 'filePath'].includes(downloadSettings.selectedStrategy)">
            <el-form-item label="视频开始时间">
              <el-input v-model="downloadSettings.earliest" placeholder="统一下载的最早时间 xx/xx/xx" />
            </el-form-item>
            <el-form-item label="视频结束时间">
              <el-input v-model="downloadSettings.latest" placeholder="统一下载的截止时间 xx/xx/xx" />
            </el-form-item>
          </template>
          <el-form-item label="视频最小时长（秒）">
            <div class="flex items-center">
              <el-input-number v-model="downloadSettings.minDuration" :min="0" :max="600" placeholder="默认30秒" />
              <el-button size="mini" class="ml-2" @click="downloadSettings.minDuration = 6">6s</el-button>
              <el-button size="mini" class="ml-2" @click="downloadSettings.minDuration = 30">30s</el-button>
              <span class="ml-2 text-gray-500">只下载时长大于等于此值的视频</span>
            </div>
          </el-form-item>
        </div>
        <el-form-item label="分组目录" v-else>
          <el-input v-model="downloadSettings.groupDir" placeholder="请输入分组目录" />
        </el-form-item>
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

    <el-dialog title="FFmpeg 处理设置" v-model="ffmpegDialogVisible">
      <ffmpegConfigForm v-model="ffmpegSettings" @deduplication-change="handleDeduplicationChange" />
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="confirmFFmpegSettings">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog title="平台奖励" v-model="editRewardDialogVisible" width="50%">
      <el-form :model="editRewardForm" label-width="150px">
        <el-form-item label="平台名称">
          <el-select v-model="editRewardForm.platformName" placeholder="请选择平台">
            <el-option label="bilibili" value="bilibili" />
            <el-option label="抖音" value="抖音" />
            <el-option label="小红书" value="小红书" />
            <el-option label="快手" value="快手" />
            <el-option label="网易创作匠" value="网易创作匠" />
            <el-option label="腾讯游可爱" value="腾讯游可爱" />
          </el-select>
        </el-form-item>
        <el-form-item label="平台标签">
          <el-input v-model="editRewardForm.suppleTag" placeholder="请输入平台标签" />
        </el-form-item>



        <el-form-item label="活动赛道">
          <el-card v-for="(activityRequirement, index) in editRewardForm.activityRequirements" :key="index"
            class="w-full mb-4">
            <el-form-item label="不做该任务">
              <el-switch v-model="activityRequirement.isNotDo" active-text="是" inactive-text="否" />
            </el-form-item>
            <el-form-item label="活动名称">
              <el-input v-model="activityRequirement.name" placeholder="请输入活动名称" />
            </el-form-item>

            <el-form-item label="B站活动话题">
              <el-input v-model="activityRequirement.topic" placeholder="请输入活动话题" />
            </el-form-item>
            <el-form-item label="B站话题播放量">
              {{ activityRequirement.arc_play_vv }}
            </el-form-item>

            <el-form-item label="活动标签">
              <el-input v-model="activityRequirement.specialTag" placeholder="请输入活动标签" />
            </el-form-item>

            <el-form-item label="是否存在榜单">
              <el-switch v-model="activityRequirement.hasRank" active-text="是" inactive-text="否" />
            </el-form-item>
            <el-form-item label="参与人数">
              <el-input-number v-model="activityRequirement.participantCount" :min="0" />
            </el-form-item>
            <el-form-item label="结束时间">
              <el-date-picker v-model="activityRequirement.eDate" type="date" placeholder="选择结束时间" format="YYYY/MM/DD"
                value-format="YYYY/MM/DD" />
            </el-form-item>
            <el-form-item label="定时任务上传目录">
              <el-input v-model="activityRequirement.videoDir" placeholder="请输入上传目录" />
            </el-form-item>
            <el-divider>单条有效内容计入限制条件</el-divider>
            <el-form-item label="视频最低时长(秒)">
              <el-input-number v-model="activityRequirement.minVideoTime" :step='6' />
            </el-form-item>
            <el-form-item label="图片最少张数">
              <el-input-number v-model="activityRequirement.minImageCount" :step='2' />
            </el-form-item>
            <el-form-item label="稿件最低观看量">
              <el-input-number v-model="activityRequirement.minView" :min="0" />
            </el-form-item>
            <el-form-item label="单稿最低点赞量">
              <el-input-number v-model="activityRequirement.minLike" :min="0" :max="20" />
            </el-form-item>
            <el-form-item label="活动ID" v-if="editRewardForm.platformName === 'bilibili'">
              <el-input v-model="activityRequirement.mission_id" placeholder="请输入活动ID" />
            </el-form-item>
            <el-form-item label="话题ID" v-if="editRewardForm.platformName === 'bilibili'">
              <el-input v-model="activityRequirement.topic_id" placeholder="请输入话题ID" />
            </el-form-item>
            <el-form-item label="内容类型">
              <el-select v-model="activityRequirement.type" placeholder="请选择过滤类型">
                <el-option label="不过滤" value="all" />
                <el-option label="仅视频" value="video" />
                <el-option label="仅图文" value="image" />
              </el-select>
            </el-form-item>
            <el-form-item label="达标奖">
              <div v-for="(reward, rewardIndex) in activityRequirement.reward" :key="rewardIndex">
                <el-form-item label="总投稿数">
                  <el-input-number v-model="reward.allNum" :min="0" :max="1000" />
                </el-form-item>
                <el-form-item label="单稿播放量(w)">
                  <el-input-number v-model="reward.view" :min="0" />
                  <span v-if="reward.view">{{ reward.view * 10000 }}</span>
                </el-form-item>
                <el-form-item label="总稿播放量(w)">
                  <el-input-number v-model="reward.allViewNum" :min="0" />
                  <span v-if="reward.allViewNum">{{ reward.allViewNum * 10000 }}</span>
                </el-form-item>
                <el-form-item label="单稿点赞量">
                  <el-input-number v-model="reward.like" :min="0" />
                </el-form-item>
                <el-form-item label="稿件总和点赞量">
                  <el-input-number v-model="reward.allLikeNum" :min="0" :max="1000000" />
                </el-form-item>
                <el-form-item label="持续投稿天数">
                  <el-input-number v-model="reward.cday" :min="0" :max="100" />
                </el-form-item>
                <el-form-item label="总互动量（点赞+收藏+评论）">
                  <el-input-number v-model="reward.allInteractionNum" :min="0" />
                </el-form-item>
                <el-form-item label="奖励金额(w)">
                  <el-input-number v-model="reward.money" :min="0" :max="100" />
                  <span v-if="reward.money">{{ reward.money * 10000 }}</span>
                </el-form-item>
                <el-button type="danger" @click="removeReward(index, rewardIndex)">删除当前达标奖</el-button>
              </div>
              <el-button type="primary" @click="addReward(index)">添加达标奖</el-button>
            </el-form-item>
            <el-button type="danger" @click="removeSpecialTagRequirement(index)">删除当前赛道</el-button>
            <el-button type="success" @click="duplicateLastTrack(index)">复制当前赛道</el-button>
          </el-card>
          <el-button type="primary" @click="addSpecialTagRequirement">添加活动赛道</el-button>
        </el-form-item>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editRewardDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="confirmEditReward">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog title="定时任务查看" v-model="scheduleViewerDialogVisible" width="80%">
      <div>
        <el-row style="margin-bottom: 10px" :gutter="8">
          <el-col :span="6">
            <el-select v-model="viewerPlatformFilter" clearable placeholder="平台过滤">
              <el-option label="全部" :value="''" />
              <el-option label="抖音" value="抖音" />
              <el-option label="bilibili" value="bilibili" />
              <el-option label="小红书" value="小红书" />
            </el-select>
          </el-col>
          <el-col :span="8">
            <el-date-picker v-model="scheduleViewerTimeRange" type="datetimerange" range-separator="至"
              start-placeholder="开始时间" end-placeholder="结束时间" align="right" style="width:100%" />
          </el-col>
          <el-col :span="6">
            <el-button @click="selectVideosByRange" type="warning">按时间范围勾选</el-button>
            <el-button @click="clearRangeSelection" class="ml-2">清除选择</el-button>
          </el-col>
          <el-col :span="4" style="text-align: right">
            <el-input v-model="viewerFilter" placeholder="搜索活动/游戏/平台" clearable style="width:100%" />
          </el-col>
        </el-row>
        <el-row style="margin-bottom: 10px">
          <el-col :span="18"></el-col>
          <el-col :span="6" style="text-align: right">
            <el-button type="primary" @click="dispatchSelectedVideos">开始分发7日内活动({{
              totalSelectedCount }})</el-button>
            <el-button @click="scheduleViewerDialogVisible = false">关闭</el-button>
          </el-col>
        </el-row>

        <el-table :data="filteredViewerJobs" style="width: 100%" row-key="jobKey" :default-expand-all="true">
          <el-table-column type="expand">
            <template #default="{ row }">
              <div>
                <el-row style="margin-bottom:8px;">
                  <el-col :span="12">活动: <strong>{{ row.topicName }}</strong> &nbsp; 平台: {{ row.platform }}</el-col>
                  <el-col :span="12" style="text-align:right">已分发: {{ row.dispatchedCount }} / {{ row.totalCount }}
                    &nbsp; 剩余天数: {{ row.daysLeft }}</el-col>
                </el-row>
                <el-table :data="row.scheduleJob" style="width: 100%"
                  @selection-change="(selection) => onSelectionChange(row.jobKey, selection)" row-key="videoPath"
                  :row-class-name="(r) => r.successExecAccount && r.successExecAccount.length > 0 ? 'row-dispatched' : ''"
                  :ref="(el) => setTableRef(row.jobKey, el)">
                  <el-table-column type="selection" width="55" />
                  <el-table-column prop="videoPath" label="视频文件" min-width="300">
                    <template #default="{ row: r }">{{ getFileName(r.videoPath) }}</template>
                  </el-table-column>
                  <el-table-column prop="execTime" label="执行时间" width="200">
                    <template #default="{ row: r }">{{ formatDateTime(r.execTime) }}</template>
                  </el-table-column>
                  <el-table-column label="已执行账号" min-width="200">
                    <template #default="{ row: r }">
                      <el-tag v-for="account in r.successExecAccount" :key="account" class="mr-2">{{ account }}</el-tag>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="topicName" label="活动/话题" />
          <el-table-column prop="platform" label="平台" width="100" />
          <el-table-column label="视频数" width="100">
            <template #default="{ row }">{{ row.totalCount }}</template>
          </el-table-column>
          <el-table-column label="已分发/总视频" width="160">
            <template #default="{ row }">{{ row.dispatchedCount }} / {{ row.totalCount }}</template>
          </el-table-column>
          <el-table-column label="剩余天数" width="100">
            <template #default="{ row }">{{ row.daysLeft }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <el-dialog title="设置定时任务" v-model="scheduleDialogVisible">
      <el-form :model="scheduleForm" label-width="120px">
        <el-form-item label="游戏名称">
          <el-input v-model="scheduleForm.gameName" placeholder="请输入游戏名称" />
        </el-form-item>
        <el-form-item label="活动名称">
          <el-input v-model="scheduleForm.topicName" placeholder="请输入活动名称" />
        </el-form-item>
        <el-form-item label="稿件目录">
          <el-input v-model="scheduleForm.videoDir" placeholder="请输入视频所在目录路径" />
        </el-form-item>
        <el-form-item label="活动结束时间">
          <el-date-picker v-model="scheduleForm.etime" type="datetime" placeholder="选择结束时间" />
        </el-form-item>
        <el-form-item label="标签组">
          <el-select v-model="selectedTrack" multiple placeholder="选择标签组（支持多选）" @change="handleTrackChange"
            style="margin-bottom: 10px" clearable>
            <el-option v-for="(config, track) in specialTrackTagConfigs" :key="track"
              :label="track + ' ' + config.baseTags.join(' ') + (config.extraTags && config.extraTags.length ? ' 附加:' + config.extraTags.join(' ') : '')"
              :value="track">
              <template #default>
                <div>{{ track }}</div>
                <small class="text-gray-500 block">
                  {{ config.baseTags.join(' ') }}
                </small>
                <small v-if="config.extraTags && config.extraTags.length" class="text-gray-500 block">
                  附加: {{ config.extraTags.join(' ') }}
                </small>
              </template>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="scheduleForm.tag" :disabled="scheduleForm.disabledTag" type="textarea" :rows="3"
            placeholder="标签将根据选择的赛道自动生成，也可以手动编辑" />
        </el-form-item>
        <el-form-item label="稿件开始时间">
          <el-date-picker v-model="scheduleForm.startTime" type="datetime" placeholder="选择开始时间" />
        </el-form-item>
        <el-form-item label="上传间隔(小时)">
          <el-input-number v-model="scheduleForm.intervalHours" :min="1" :max="24" placeholder="请输入上传间隔" />
        </el-form-item>
        <el-form-item label="待分发账号">
          <el-select v-model="scheduleForm.needExecAccounts" multiple placeholder="请选择要使用的账号" style="width: 100%">
            <el-option v-for="account in allPlatformAccounts[platformToKey[scheduleForm.platform]]" :key="account.id"
              :label="account.accountName" :value="account.accountName">
            </el-option>
          </el-select>
        </el-form-item>
        <!-- 增加抖音平台的标题输入控制与游戏绑定控制 -->
        <template v-if="scheduleForm.platform === '抖音'">
          <el-form-item label="标题控制">
            <el-switch v-model="scheduleForm.douyinTitleControl" active-text="输入标题" inactive-text="不输入标题" />
          </el-form-item>
          <el-form-item label="游戏绑定">
            <el-switch v-model="scheduleForm.douyinGameBinding" active-text="绑定游戏" inactive-text="不绑定游戏" />
          </el-form-item>
        </template>
        <!-- B站平台活动ID控制 -->
        <template v-if="scheduleForm.platform === 'bilibili'">
          <el-form-item label="分区选择">
            <el-select v-model="scheduleForm.selectedArea" placeholder="请选择分区" @change="handleAreaChange">
              <el-option v-for="area in bilibiliTid" :key="area.name" :label="area.name" :value="area.name" />
            </el-select>
            <el-select v-model="scheduleForm.tid" placeholder="请选择子分区">
              <el-option v-for="subArea in getSubAreas" :key="subArea.tid" :label="subArea.name" :value="subArea.tid" />
            </el-select>
          </el-form-item>
          <el-form-item label="活动ID(大ID)">
            <el-input v-model="scheduleForm.missionId" placeholder="请输入活动ID" />
          </el-form-item>
          <el-form-item label="话题ID(小ID)">
            <el-input v-model="scheduleForm.topicId" placeholder="请输入话题ID" />
          </el-form-item>
        </template>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="scheduleDialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="confirmScheduleJob(false)">确 定</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 合并后的定时任务查看弹窗已替代原有两个弹窗 -->

    <BatchGameFFmpegDialog v-model="batchFFmpegDialogVisible" :publicFFmpegConfig="publicFFmpegConfig"
      :batchDialogVisible="batchFFmpegDialogVisible">
    </BatchGameFFmpegDialog>

    <!-- 搜索网站选择对话框 -->
    <SearchDialog v-model="searchDialogVisible" :gameName="currentGameForSearch" />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import bilibiliTid from '../../public/bilibiliTid.json' // B站分区数据
import BatchGameFFmpegDialog from '../components/FFmpegBatchGameDialog.vue'
import ffmpegConfigForm from '@/components/ffmpegConfigForm.vue'
import SearchDialog from '../components/SearchDialog.vue'
import { allGameList } from '@/state/globalState'



// gameActivity接口定义
interface GameActivity {
  name: string
  gameName: string
  // 用来搜索的名
  searchName: string
  // 厂商
  manufacturer?: string
  rewards: PlatformReward[]
  // 结束时间戳（秒）
  etime?: number
  // 汇总金额
  allMoney?: number
  suppleTag?: string
  new?: boolean
  // videoAuthor: author[]
  updateDate?: string
}


type PlatformName = 'bilibili' | '抖音' | '小红书' | '快手'

interface PlatformReward {
  name: PlatformName
  activityRequirements: ActivityRequirement[]
  suppleTag?: string
  wyczjTag?: string

}

interface ActivityRequirement {
  name: string
  topic?: string
  specialTag: string
  videoDir?: string  // 定时任务上传目录
  eDate: string
  reward: Reward[]
  videoData?: VideoData[]
  scheluleJob?: ScheduleJob[]
  isNotDo?: boolean   // 是否不做该任务（展示但整个框标橙色）
  hasRank?: boolean   // 是否有榜单
  participantCount?: number // 参与人数
  minVideoTime?: number
  minImageCount?: number
  minView?: number
  minLike?: number
  type?: 'all' | 'video' | 'image'
  mission_id?: string
  topic_id?: string
}

interface Reward {
  allNum?: number   // 总投稿数
  view?: number   // 单稿件播放数
  allViewNum?: number   // 总播放数
  like?: number   // 单稿件点赞数
  allLikeNum?: number  // 总点赞数
  cday?: number     // 投稿持续天数
  allInteractionNum?: number // 总互动量（点赞+收藏+评论）
  money?: number  // 瓜分金额
  isGet: boolean  // 是否达标
}

interface VideoData {
  userName: string
  allNum: number
  allViewNum: number
  allLikeNum: number
  videoList: Array<{
    view: number
    like: number
    reply: number
    ctime: number
    title: string
  }>
}

// 定时任务
interface ScheduleForm {
  gameName: string
  platform: PlatformName
  tag: string
  disabledTag: boolean  // 无法修改的标签状态
  topicName: string
  videoDir: string
  missionId: string
  startTime: Date | null
  intervalHours: number
  immediately: boolean  // 是否立即执行
  selectedArea: string //  分区Id
  tid: number  // 子分区ID
  etime: Date | null // 添加活动结束时间字段
  needExecAccounts: string[]
  douyinTitleControl: boolean
  douyinGameBinding: boolean
}


interface BilibiliArea {
  name: string
  children: {
    tid: number
    name: string
  }[]
}




const formatDate = (timestamp?: number, splitStr: string = '-'): string => {
  const date = timestamp ? new Date(timestamp * 1000) : new Date()
  return date.getFullYear() + splitStr + (date.getMonth() + 1) + splitStr + date.getDate()
}


const getDaysDiff = (timeStamp1: number, timeStamp2: number = new Date().getTime()): number => {
  const diffTime = timeStamp1 - timeStamp2
  const endDiffDate = diffTime / (1000 * 60 * 60 * 24)
  return Math.ceil(endDiffDate)
}

const copyTag = (tag: string, openTag: boolean = false): void => {

  navigator.clipboard.writeText(tag)
  ElMessage.success('复制成功')


  // TAG 多平台搜索（抖音、快手、B站、小红书），方便查看相同的作品
  if (!openTag) {
    return
  }
  const keyword = tag
  // const kuaishouSearchUrl =
  //   'https://www.kuaishou.com/search/' + encodeURIComponent(keyword) + '?source=NewReco';
  const bilibiliSearchUrl = 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(keyword);
  const xhsSearchUrl =
    'https://www.xiaohongshu.com/search_result?keyword=' +
    encodeURIComponent(keyword) +
    '&source=web_search_result_notes';
  const douyinSearchUrl = 'https://www.douyin.com/search/' + encodeURIComponent(keyword);
  // window.open(kuaishouSearchUrl, '_blank', 'noopener');
  window.open(bilibiliSearchUrl, '_blank', 'noopener');
  window.open(xhsSearchUrl, '_blank', 'noopener');
  window.open(douyinSearchUrl, '_blank', 'noopener');
}


// 标签速查面板相关状态
const showTagPanel = ref(false)
const tagPanelExpanded = ref(true)
const currentGameName = ref('')
const expandedTracks = ref<Set<string>>(new Set())

// 切换单个赛道展开/收起
const toggleTrack = (trackName: string) => {
  if (expandedTracks.value.has(trackName)) {
    expandedTracks.value.delete(trackName)
  } else {
    expandedTracks.value.add(trackName)
  }
  // 触发响应式更新
  expandedTracks.value = new Set(expandedTracks.value)
}

// 全部展开/收起赛道
const toggleAllTracks = () => {
  if (expandedTracks.value.size === Object.keys(specialTrackTagConfigs).length) {
    // 全部收起
    expandedTracks.value.clear()
  } else {
    // 全部展开
    expandedTracks.value = new Set(Object.keys(specialTrackTagConfigs))
  }
  expandedTracks.value = new Set(expandedTracks.value)
}

// 复制所有赛道标签
const copyAllTrackTags = () => {
  const allTags: string[] = []
  Object.values(specialTrackTagConfigs).forEach((config: any) => {
    allTags.push(...config.baseTags, ...config.extraTags)
  })
  const tagsText = [...new Set(allTags)].join(' ')
  navigator.clipboard.writeText(tagsText)
  ElMessage.success(`已复制 ${[...new Set(allTags)].length} 个标签`)
}

// 复制单个赛道的所有标签
const copyTrackTags = (trackName: string, trackConfig: any) => {
  const trackTags = [...trackConfig.baseTags, ...trackConfig.extraTags]
  const tagsText = trackTags.join(' ')
  navigator.clipboard.writeText(tagsText)
  ElMessage.success(`已复制 ${trackName} 分组的 ${trackTags.length} 个标签`)
}

// 复制单个平台的所有标签
const copyPlatformTags = (platformName: string, tags: string[]) => {
  const tagsText = tags.join(' ')
  navigator.clipboard.writeText(tagsText)
  ElMessage.success(`已复制 ${platformName} 的 ${tags.length} 个标签`)
}

// 获取当前游戏的所有信息
const currentGameData = computed((): GameActivity | null => {
  if (!currentGameName.value) return null
  const game = gameTableData.value.find((game: GameActivity) => game.name === currentGameName.value)
  return game || null
})

// 按平台分组标签
const groupedTagsByPlatform = computed((): Array<{ platform: string; tags: string[] }> => {
  const gameData = currentGameData.value
  if (!gameData) return []

  const platformGroups: Record<string, Set<string>> = {
    'bilibili': new Set(),
    '抖音': new Set(),
    '小红书': new Set(),
    '快手': new Set(),
    "网易创作匠": new Set(),
  }

  // 添加游戏名称作为基础标签
  Object.keys(platformGroups).forEach((platform: string) => {
    platformGroups[platform].add(`#${gameData.name}`)
  })

  // 从每个奖励平台的活动要求中收集标签
  gameData.rewards?.forEach((platform: PlatformReward) => {
    const platformName = platform.name

    // 添加平台补充标签
    if (platform.suppleTag) {
      platform.suppleTag.split(/\s+/).forEach((tag: string) => {
        if (tag) {
          platformGroups[platformName].add(tag.startsWith('#') ? tag : `#${tag}`)
        }
      })
    }

    // 添加活动特殊标签
    platform.activityRequirements?.forEach((act: ActivityRequirement) => {
      if (act.specialTag && !act.isNotDo) {
        act.specialTag.split(/\s+/).forEach((tag: string) => {
          if (tag) {
            platformGroups[platformName].add(tag.startsWith('#') ? tag : `#${tag}`)
          }
        })
      }
    })
  })

  // 转换为数组格式，应用平台特定的格式规则
  return Object.entries(platformGroups)
    .filter(([_, tags]: [string, Set<string>]) => tags.size > 0)
    .map(([platform, tags]: [string, Set<string>]) => {
      let formattedTags = Array.from(tags)

      // 根据平台格式化标签
      if (platform === 'bilibili') {
        formattedTags = formattedTags.map((tag: string) => tag.startsWith('#') ? tag.slice(1) : tag)
      } else {
        formattedTags = formattedTags.map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`)
      }

      return {
        platform,
        tags: formattedTags.sort()
      }
    })
})

// 切换面板展开/收起
const toggleTagPanelExpand = () => {
  tagPanelExpanded.value = !tagPanelExpanded.value
}

// 监听表格行的游戏名称点击，更新标签面板
const handleGameNameClick = (gameName: string) => {
  currentGameName.value = gameName
  showTagPanel.value = true
  tagPanelExpanded.value = true
}

const scheduleDialogVisible = ref(false)
const scheduleForm = ref<ScheduleForm>({
  gameName: '',
  topicName: '',
  videoDir: '',
  tag: '',
  disabledTag: false,
  tid: 172,
  missionId: '',
  startTime: null,
  intervalHours: 24,
  platform: '',
  immediately: false,
  selectedArea: '游戏区',
  etime: null,
  needExecAccounts: [],
  douyinTitleControl: false,
  douyinGameBinding: false,
})

const platformToKey = {
  'bilibili': 'bilibili',
  '抖音': 'douyin',
  '小红书': 'xhs',
  '快手': 'kuaishou'
};

const setScheduleJob = async (
  actItem: ActivityRequirement,
  platformItem: PlatformReward,
  gameItem: GameActivity,
) => {
  const { topic, specialTag, eDate, mission_id, videoDir } = actItem
  const hasTopicName = topic || actItem.name
  const { name: gameName } = gameItem


  if (!hasTopicName && platformItem.name === 'bilibili') {
    ElMessage.error('没有找到对应的 topic 或 活动name')
    return
  }

  const missionId = mission_id
  // B站平台 如果没有找到对应的 missionId 则尝试通过 topic 从接口获取最新的 missionId 和子Id
  if (!missionId && platformItem.name === 'bilibili') {
    if (!topic) {
      ElMessage.error('没有找到对应的 topic')
      return
    }

  }


  const platformName = platformItem.name
  // 获取已存在的定时任务tag
  let existingTag = ''
  const existingJob = scheduleJobMap.value[platformName].find(j => j.topicName === actItem.name)
  if (existingJob?.scheduleJob?.length > 0) {
    existingTag = existingJob.tag
  }


  // 生成全量标签：游戏名称 + wyczj标签 + 活动标签 + 支撑标签
  const allTag = [
    ...new Set([
      '#' + gameItem.name,
      ...(platformItem.wyczjTag?.split(/\s+/) || []),
      ...(specialTag?.split(/\s+/) || []),
      ...(platformItem.suppleTag?.split(/\s+/) || []),
    ]),
  ]
    .filter(Boolean)
    .map((t) => {
      if (platformItem.name === 'bilibili') {
        return t.startsWith('#') ? t.slice(1) : t
      }
      return t.startsWith('#') ? t : `#${t}`
    })
    .join(platformItem.name === 'bilibili' ? ',' : ' ')


  scheduleForm.value = {
    gameName,
    topicName: topic || actItem.name,
    platform: platformItem.name,
    tag: existingTag || allTag,
    disabledTag: !!existingTag,
    missionId: missionId || actItem.mission_id,
    topicId: actItem.topic_id,
    startTime: new Date(new Date().setHours(24 + 6, 0, 0, 0)), // 次日早晨6点
    intervalHours: 6,
    immediately: false,
    selectedArea: '游戏区',
    tid: 172,
    videoDir: videoDir || `D:\\edge_download\\游戏分发素材\\${topic || actItem.name}`,
    etime: eDate ? new Date(eDate) : null, // 设置活动结束时间
    needExecAccounts: allPlatformAccounts.value[platformToKey[platformName]].map(account => account.accountName),
    douyinTitleControl: false,
    douyinGameBinding: false,
  }

  scheduleDialogVisible.value = true
}


const confirmScheduleJob = async (immediately = false) => {
  try {

    const response = await fetch('/api/scheduleUpload', {
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
      if (immediately) {
        // 显示执行结果的详细信息
        const { successPlatforms, failedPlatforms } = result.data || { successPlatforms: 0, failedPlatforms: 0 };

        if (failedPlatforms > 0) {
          ElMessageBox.alert(
            `执行完成：${successPlatforms}个平台成功，${failedPlatforms}个平台失败。请查看控制台获取详细信息。`,
            '定时任务执行结果',
            {
              confirmButtonText: '确定',
              type: 'warning'
            }
          );
        } else {
          ElMessage.success(`定时任务执行成功：${successPlatforms}个平台全部完成`);
        }
      } else {
        ElMessage.success('定时任务设置成功');
      }

      scheduleDialogVisible.value = false;
      scheduleViewerDialogVisible.value = false;
      fetchData();
    } else {
      ElMessage.error(result.msg || '设置失败');
    }
  } catch (error) {
    console.error('设置定时任务失败:', error);
    ElMessage.error('设置定时任务失败');
  }
}

const activeTab = ref('platform')
const editRewardDialogVisible = ref(false)
const editRewardForm = ref({
  platformName: '',
  activityRequirements: [
    {
      name: '',
      minVideoTime: 6,
      minView: 100,
      specialTag: '',

      eDate: '',
      participantCount: undefined,
      reward: [
        {
          allNum: undefined,
          allViewNum: undefined,
          view: undefined,
          like: undefined,
          allLikeNum: undefined,

          cday: undefined,
          money: undefined,
          isGet: false,
        },
      ],
    },
  ],
})

const addSpecialTagRequirement = () => {
  editRewardForm.value.activityRequirements.push({
    name: '',
    specialTag: '',
    eDate: '',
    participantCount: undefined,
    minVideoTime: undefined,
    minImageCount: undefined,
    reward: [],
  })
}

const removeSpecialTagRequirement = (index) => {
  editRewardForm.value.activityRequirements.splice(index, 1)
}

// 复制上一个活动赛道的数据
const duplicateLastTrack = (currentIndex: number) => {
  // 深拷贝上一个赛道的数据
  const lastTrack = JSON.parse(JSON.stringify(editRewardForm.value.activityRequirements[currentIndex]))
  // 添加到当前赛道后面
  editRewardForm.value.activityRequirements.splice(currentIndex, 0, lastTrack)

  ElMessage.success('已复制上一个赛道的配置')
}

const addReward = (index) => {
  editRewardForm.value.activityRequirements[index].reward.push({
    allNum: undefined,
    allViewNum: undefined,
    view: undefined,
    like: undefined,
    allLikeNum: undefined,
    cday: undefined,
    money: undefined,
    isGet: false,
  })
}

const removeReward = (index, rewardIndex) => {
  editRewardForm.value.activityRequirements[index].reward.splice(rewardIndex, 1)
}

const openEditRewardDialog = (gameName, platform) => {
  let activityRequirements = [
    {
      name: '',
      specialTag: '',
      eDate: '',
      participantCount: undefined,
      minVideoTime: undefined,
      minImageCount: undefined,
      minView: undefined,
      reward: [
        {
          allNum: undefined,
          allViewNum: undefined,
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
  if (platform?.activityRequirements) {
    activityRequirements = JSON.parse(JSON.stringify(platform?.activityRequirements))?.map(
      (activityRequirement) => {
        activityRequirement.reward = activityRequirement.reward
          .filter((reward) =>
            Object.values(reward).some((value) => value !== 0 && value !== false && value !== ''),
          )
          .map((e) => {
            if (e.allViewNum) e.allViewNum = e.allViewNum / 10000
            if (e.view) e.view = e.view / 10000
            if (e.money) e.money = e.money / 10000
            return e
          })
        return activityRequirement
      },
    )
  }
  editRewardForm.value = {
    ...platform,
    platformName: platform?.name || '抖音',
    isUpdate: !!platform,
    activityRequirements: activityRequirements,
  }
  editRewardForm.value.gameName = gameName
  editRewardDialogVisible.value = true
}

const confirmEditReward = async () => {
  const filteredReward = JSON.parse(JSON.stringify(editRewardForm.value))
  filteredReward.activityRequirements = filteredReward.activityRequirements.map(
    (activityRequirement) => {

      activityRequirement.reward = activityRequirement.reward
        .filter((reward) =>
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

      return activityRequirement
    },
  )
  // 发送后端请求更新奖励
  await fetch(`/api/addPlatformReward`, {
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

// 获取按钮类型，未完成任务的账号为红色，已完成任务的账号为灰色
const getScheduleJobButtonType = (speReq, platformName: PlatformType) => {
  if (platformName === 'bilibili') {
    const jobSetting = scheduleJobMap.value[platformName].find(job => job.topicName === speReq.topic);
    return jobSetting?.scheduleJob?.some(job => job.successExecAccount?.length < 3) ? 'danger' : 'info';
  } else if (platformName === '抖音') {
    const jobSetting = scheduleJobMap.value[platformName].find(job => job.topicName === speReq.name);
    return jobSetting?.scheduleJob?.some(job => job.successExecAccount?.length < 2) ? 'danger' : 'info';
  } else if (platformName === '小红书') {
    const jobSetting = scheduleJobMap.value[platformName].find(job => job.topicName === speReq.name);
    return jobSetting?.scheduleJob?.some(job => job.successExecAccount?.length < 1) ? 'danger' : 'info';
  }
  return 'info';
}


const dialogVisible = ref(false)
const getDefaultDate = (monthsAgo = 0) => {
  const date = new Date()
  date.setMonth(date.getMonth() - monthsAgo)
  return formatDate(date.getTime() / 1000, '/')
}

const downloadSettings = ref({
  isDownload: true,
  selectedStrategy: 'filePath',
  keyword: '',
  filePath: `D:\\code\\platform_game_activity\\TikTokDownloader\\downloadList.txt`,
  checkNewAdd: computed(() =>
    downloadSettings.value.selectedStrategy === 'checkNewAdd' ? true : false,
  ),
  allDownload: computed(() =>
    downloadSettings.value.selectedStrategy === 'allDownload' ? true : false,
  ),
  checkName: false,
  earliest: getDefaultDate(4), // 默认近4个月 YYYY/MM/DD
  latest: getDefaultDate(), // 默认当前 YYYY/MM/DD
  minDuration: 6, // 默认6秒以上
  currentUpdateGameList: [],
})

const batchFFmpegDialogVisible = ref(false)

const ffmpegDialogVisible = ref(false)
// 定义不同类别的默认去重配置
const defaultDeduplicationConfigs = {
  攻略: {
    speedFactor: 0.95,
    enableMirror: true,
    enableRotate: true,
    rotateAngle: 0.1,
    enableBlur: true,
    blurRadius: 0.2,
    enableFade: false,
    fadeDuration: 0.5,
    brightness: 0.05,
    contrast: 1,
    saturation: 1,
    enableBgBlur: false,
    bgBlurTop: 0.1,
    bgBlurBottom: 0.1,
    // 帧率去重默认配置
    enableFrameChange: true,
    frameChangeMode: 'light',
    targetFps: 24,
    finalFps: 30,
    interpolateMode: 'mci',
    // overlay 特效默认配置
    enableOverlayEffect: true,
    overlayPath: 'effect.mp4',
    overlayLoop: true,
    overlayBlendMode: 'lighten',
    overlayOpacity: 1
  },
  coser: {
    speedFactor: 0.95,
    enableMirror: true,
    enableRotate: true,
    rotateAngle: 0.1,
    enableBlur: true,
    blurRadius: 0.1,
    enableFade: false,
    fadeDuration: 0.5,
    brightness: 0.05,
    contrast: 1.05,
    saturation: 0.95,
    enableBgBlur: false,
    bgBlurTop: 0.1,
    bgBlurBottom: 0.1,
    // 帧率去重默认配置
    enableFrameChange: true,
    frameChangeMode: 'light',
    targetFps: 24,
    finalFps: 30,
    interpolateMode: 'mci',
    // overlay 特效默认配置
    enableOverlayEffect: true,
    overlayPath: 'effect.mp4',
    overlayLoop: true,
    overlayBlendMode: 'lighten',
    overlayOpacity: 1
  },
}
const ffmpegSettings = ref({
  enableRename: true,
  onlyRename: false,
  checkName: false,
  beforeTime: 0,
  afterTime: 0,
  fps: 30,
  scalePercent: 0, // 1920X1080
  replaceMusic: false,
  musicName: 'billll',
  gameName: '',
  groupName: '',

  addPublishTime: false,
  deduplicationConfig: {
    enable: false,
    ...defaultDeduplicationConfigs.coser,
  },
  addEnding: false, // 默认添加片尾
  enableMerge: false,
  mergedMinTime: 10,
  enableMergeMusic: true,
  segmentDuration: 3, // 默认分镜秒数
  mixCount: 2, // 默认混剪数量
  mergeMusicName: '随机',
  videoDir: 'D:\\code\\platform_game_activity\\TikTokDownloader\\Download', // 视频处理路径

  // 新增：特效配置
  effectConfig: {
    enable: false,
    preset: 'none', // none, dynamic, dreamy, artistic, vintage, blackAndWhite, vibrant, slowMo, custom
    selectedEffects: [],
    applyOnMerge: false,
    params: {
      rotateAngle: 45,
      blurAmount: 10,
      sharpAmount: 1,
      speedUpFactor: 1.5,
      slowDownFactor: 0.75,
      hue: 0,
      saturation: 1,
      zoomLevel: 1.2,
      pixelSize: 10,
      mosaicSize: 20,
      borderWidth: 10,
      borderColor: 'black'
    }
  },

  // GPU加速配置
  gpuQuality: 'balanced', // speed, balanced, quality

  // 断点续传配置
  enableResumeTask: false,
  autoResumeTask: false
})
const publicFFmpegConfig = ref(ffmpegSettings.value)
// 处理去重开关变化
const handleDeduplicationChange = (value) => {
  if (value) {
    // 根据分组类型设置默认配置
    // const isCoser = ffmpegSettings.value.groupName.includes('coser')
    // const defaultConfig = isCoser
    //   ? defaultDeduplicationConfigs.coser
    //   : defaultDeduplicationConfigs.攻略

    // 更新去重配置
    ffmpegSettings.value.deduplicationConfig = {
      enable: true,
      ...defaultDeduplicationConfigs.coser,
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

  await fetch(`/api/downloadVideosAndGroup`, {
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
  await fetch(`/api/ffmpegHandleVideos`, {
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

const getSpecialTagAll = (reward) => {
  if (!reward?.activityRequirements || reward.activityRequirements.length === 1) {
    return ''
  }
  const a = [
    ...new Set(reward.activityRequirements.map((e) => e.specialTag.split(' ')).flat()),
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
  const suppleTag = row?.suppleTag ? row.suppleTag.split(' ') : [] // 平台标签,给B站/小红书提供

  return [...new Set(specialTagArr.concat(suppleTag))].join(' ')
}

const bilibiliActTableData = ref([])
const xhsActTableData = ref([]) // 小红书活动列表
const gameTableData = ref([])
const dakaTableData = ref([])

// 搜索对话框
const searchDialogVisible = ref(false)
const currentGameForSearch = ref('')
const filterSettings = ref({
  allMoneyMin: null as number | null,
  allMoneyMax: null as number | null,
  daysLeftMin: null as number | null,
  daysLeftMax: 45 as number | null,
  hideNoRewardGames: true,
})

const resetFilterSettings = () => {
  filterSettings.value = {
    allMoneyMin: null,
    allMoneyMax: null,
    daysLeftMin: null,
    daysLeftMax: null,
    hideNoRewardGames: false,
  }
}

const getDaysLeft = (row: GameActivity) => (row.etime ? getDaysDiff(row.etime * 1000) : 0)

const hasActiveRewards = (row: GameActivity) =>
  (row.rewards || []).some((platform) =>
    (platform.activityRequirements || []).some((act) =>
      !act.isNotDo &&
      (act.eDate
        ? getDaysDiff(new Date(act.eDate).getTime()) >= 0
        : getDaysLeft(row) >= 0),
    ),
  )

const filteredGameTableData = computed(() => {
  return gameTableData.value.filter((row) => {
    const allMoney = Number(row.allMoney ?? 0)
    const daysLeft = getDaysLeft(row)
    const { allMoneyMin, allMoneyMax, daysLeftMin, daysLeftMax, hideNoRewardGames } = filterSettings.value

    if (allMoneyMin !== null && allMoney < allMoneyMin) {
      return false
    }
    if (allMoneyMax !== null && allMoney > allMoneyMax) {
      return false
    }
    if (daysLeftMin !== null && daysLeft < daysLeftMin) {
      return false
    }
    if (daysLeftMax !== null && daysLeft > daysLeftMax) {
      return false
    }
    if (hideNoRewardGames && !hasActiveRewards(row)) {
      return false
    }
    return true
  })
})

const openSearchDialog = (gameName: string) => {
  currentGameForSearch.value = gameName
  searchDialogVisible.value = true
}

// 定义平台类型
type PlatformType = 'bilibili' | '抖音' | '小红书';



export interface ScheduleJob {
  gameName: string;
  topicName: string;
  tag: string;
  videoDir: string;
  videoList: VideoItem[];
  etime: Date;
  needExecAccounts: string[];
  tid?: number;
  missionId?: number;
  topicId?: number;
}

export interface VideoItem {
  type: "video" | "image";
  videoPath: string;
  execTime: Date;
  successExecAccount: string[];
  needExecAccount: string[];
}



const scheduleJobMap = ref<Record<PlatformType, ScheduleJob[]>>({
  bilibili: [],
  '抖音': [],
  '小红书': [],
})

const topicJson = ref([])
const allPlatformAccounts = ref({})

const fetchData = async () => {
  try {
    const response = await fetch('/api/allData')
    if (!response.ok) {
      throw new Error('Network response was not ok')
    }
    const res = await response.json()
    bilibiliActTableData.value = res.bilibiliActData.filter((item) => {
      if (item.show) {
        return true
      }
      // Hide activities with 'infinite' end time (backend sets Number.MAX_SAFE_INTEGER for missing end dates)
      if (!item.etime || item.etime >= Number.MAX_SAFE_INTEGER) return false
      return item.etime > new Date().getTime() / 1000 && !item.notDo
    })
    xhsActTableData.value = res.xhsActData.filter((item) => {
      if (item.show) return true
      if (!item.etime || item.etime >= Number.MAX_SAFE_INTEGER) return false
      return item.etime > new Date().getTime() / 1000 && !item.notDo
    })
    dakaTableData.value = res.dakaData
    // Exclude activities with infinite end time (treated as no end)
    gameTableData.value = res.gameData
    // .filter((item) => !(item.etime && item.etime >= Number.MAX_SAFE_INTEGER))
    allGameList.value = res.allGameList.map((e) => ({ name: e, checked: false }))
    scheduleJobMap.value = res.scheduleJob
    topicJson.value = res.topicJson
    allPlatformAccounts.value = res.platformAccountMap
    ElMessage.success('数据刷新成功')
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

const fetchNewBiliBiliActivityData = async () => {
  try {
    const response = await fetch('/api/getNewBiliActData')
    const res = await response.json()
    if (res.code == -101) {
      return ElMessage.error('请先登录')
    }
    fetchData()
  } catch (error) {
    console.error('Error fetching data:', error)
  }
}

const fetchNewXhsActivityData = async () => {
  try {
    const response = await fetch('/api/getNewXhsActData', {
      headers: {
        // frontend may supply X-S token if needed
        // 'X-S': prompt('请输入X-S签名(若未提供可留空)') || ''
      }
    })
    const res = await response.json()
    if (res.code == -101) {
      return ElMessage.error('请先登录')
    }
    fetchData()
  } catch (error) {
    console.error('Error fetching xhs data:', error)
  }
}


const handleManualAccount = async () => {
  try {
    const response = await fetch('/api/manualAccount')
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



onMounted(() => {
  fetchData()
  // 初始化赛道标签，默认展开前3个
  const trackNames = Object.keys(specialTrackTagConfigs)
  expandedTracks.value = new Set(trackNames.slice(0, 3))
})

// 控制选择查询的平台
const platformDialogVisible = ref(false);
const selectedPlatformList = ref<string[]>(['抖音', '小红书', 'bilibili']);
const clearPreviousData = ref(false); // 是否清除过往数据

const confirmUpdatePlatforms = async () => {
  platformDialogVisible.value = false;
  await updateAllPlatformData(selectedPlatformList.value, clearPreviousData.value);
  clearPreviousData.value = false; // 操作完后重置开关
};

const updateAllPlatformData = async (platforms: string[] = [], clearData: boolean = false) => {
  await fetch(`/api/getPlatformVideoData`, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ platforms, clearPreviousData: clearData }),
  }).then((res) => {
    if (res.ok) {
      fetchData();
    }
  });
};


const getCompletionPercentage = (requirement, videoData, act) => {
  let totalRequirements = 0
  let completedRequirements = 0
  const details = []
  const currentValues = {}
  const targetValues = {}

  for (const key in requirement) {
    if (key === 'money' || key === 'isGet') continue

    totalRequirements++
    const currentValue = getCurrentValue(key, videoData, requirement, act)
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

  // when only one requirement (after filtering out money/isGet), calculate proportion
  let percentage
  if (totalRequirements === 1) {
    // use the key that was actually processed rather than assuming the first key of the original object
    const processedKey = Object.keys(currentValues)[0]
    percentage = Math.min(
      (currentValues[processedKey] / targetValues[processedKey]) * 100,
      100,
    )
  } else {
    // for multiple requirements, instead of simply counting completed ones we calculate
    // a weighted progress based on how far along each requirement is. This gives a
    // smooth percentage that reflects partial completion of individual items.
    let sumRatio = 0
    details.forEach((d) => {
      // avoid division by zero and cap at 1 (100%)
      const ratio = d.required > 0 ? Math.min(d.current / d.required, 1) : 0
      sumRatio += ratio
    })
    percentage = (sumRatio / totalRequirements) * 100
  }

  return {
    percentage,
    details,
    currentValues,
    targetValues,
  }
}

function getCurrentValue(key, data, requirement, act) {
  switch (key) {
    case 'allNum':
      // if there are filtering conditions, count videos that satisfy them
      if (act?.minLike || act?.minView) {
        const filterVideoList = data.videoList
          .filter((i) => {
            let ok = true
            if (act?.minLike) ok = ok && i.like >= act.minLike
            if (act?.minView) ok = ok && i.view >= act.minView
            return ok
          })
        return filterVideoList.length
      }
      return data.allNum
    case 'allLikeNum':
      return act?.minLike
        ? data.videoList
          .filter((i) => i.like >= act?.minLike)
          .reduce((sum, item) => sum + item.like, 0)
        : data.allLikeNum
    case 'allViewNum':
      return act?.minView
        ? data.videoList
          .filter((i) => i.view >= act?.minView)
          .reduce((sum, item) => sum + item.view, 0)
        : data.allViewNum
    case "allInteractionNum":
      return data.videoList.reduce((sum, item) => sum + (item.like + item.collected_count + item.comment_count), 0)
    case 'view':
      return Math.max(...data.videoList.map((item) => item.view))
    case 'like':
      return Math.max(...data.videoList.map((item) => item.like))
    case 'cday':
      return calculateCday(data.videoList)
    default:
      return 0
  }
}

function calculateCday(videoList) {
  const uniqueDates = new Set()

  videoList.forEach((item) => {
    const dateString = formatDate(item.ctime) // Get YYYY-MM-DD format
    uniqueDates.add(dateString)
  })

  return uniqueDates.size
}

const getTooltipContent = (requirement, videoData, act) => {
  const completionInfo = getCompletionPercentage(requirement, videoData, act)
  let tooltipContent = ''

  completionInfo.details.forEach((detail) => {
    tooltipContent += `${detail.key}: ${detail.current}/${detail.required}`
    if (!detail.completed) {
      tooltipContent += ' (未完成)'
    }
    tooltipContent += '\n'
  })

  // append overall percentage for clarity
  tooltipContent += `进度: ${completionInfo.percentage.toFixed(1)}%`
  return tooltipContent.trim()
}

const getCompletionStatus = (requirement, videoData, act) => {
  const percentage = getCompletionPercentage(requirement, videoData, act)
  return percentage.percentage >= 100 ? 'success' : 'exception'
}

const formatRequirement = (requirement, percentage, videoData, act) => {
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


// 合并弹窗数据（前端查看与分发控制）
const scheduleViewerDialogVisible = ref(false)
const viewerJobs = ref([]) // 每个 job 包含 scheduleJob 数组和统计
const viewerFilter = ref('')
const selectedVideosMap = ref({}) // { jobKey: [selectedRows] }

const totalSelectedCount = computed(() => {
  return Object.values(selectedVideosMap.value).reduce((s, arr) => s + (arr?.length || 0), 0)
})

const makeJobKey = (job, platform) => `${platform}::${job.topicName || job.gameName}`

const buildViewerJob = (job, platform, activity) => {
  const totalCount = job.scheduleJob?.length || 0
  const requiredAccounts = platform === 'bilibili' ? 3 : platform === '抖音' ? 2 : 1
  // 已分发：按视频是否已达到应分发账号数来判断
  const dispatchedCount = job.scheduleJob?.reduce((s, it) => s + ((it.successExecAccount?.length || 0) >= requiredAccounts ? 1 : 0), 0) || 0
  const daysLeft = job.etime ? getDaysDiff(new Date(job.etime).getTime()) : 0
  return {
    ...job,
    platform,
    totalCount,
    dispatchedCount,
    requiredAccounts,
    daysLeft,
    jobKey: makeJobKey(job, platform),
    activity // store corresponding activity/reward object
  }
}

// 打开查看弹窗（展示某个活动的定时任务）
const showScheduleJobDialog = async (speReq, platformName: PlatformType) => {
  try {
    let scheduleJob
    const { topic, name } = speReq
    if (platformName === 'bilibili') {
      scheduleJob = scheduleJobMap.value[platformName].find((e) => e.topicName === topic)
    } else if (platformName === '抖音' || platformName === '小红书') {
      scheduleJob = scheduleJobMap.value[platformName].find((e) => e.topicName === name)
    }
    if (!scheduleJob) {
      ElMessage.warning('未找到定时任务')
      return
    }
    viewerJobs.value = [buildViewerJob(scheduleJob, platformName, speReq)]
    selectedVideosMap.value = {}

    // 自动勾选最近7日的稿件
    const now = new Date().getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const videos7DaysAgo = (scheduleJob.scheduleJob || []).filter(v => {
      const execTime = new Date(v.execTime).getTime()
      return execTime >= now - sevenDaysMs && execTime <= now + sevenDaysMs
    })

    if (videos7DaysAgo.length > 0) {
      const jobKey = makeJobKey(scheduleJob, platformName)
      selectedVideosMap.value[jobKey] = videos7DaysAgo

      // 待下一帧 UI 更新后，同步勾选复选框
      setTimeout(() => {
        const tbl = tableRefs.value[jobKey]
        if (!tbl || !Array.isArray(videos7DaysAgo)) return
        try {
          tbl.clearSelection && tbl.clearSelection()
        } catch (e) { }
        videos7DaysAgo.forEach(r => {
          try {
            tbl.toggleRowSelection && tbl.toggleRowSelection(r, true)
          } catch (e) { }
        })
      }, 100)
    }

    scheduleViewerDialogVisible.value = true
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

// 处理合并查看弹窗的选择和分发
const onSelectionChange = (jobKey, selection) => {
  selectedVideosMap.value = {
    ...selectedVideosMap.value,
    [jobKey]: selection,
  }
}

const tableRefs = ref({})
const setTableRef = (key, el) => {
  if (!key) return
  if (el) tableRefs.value[key] = el
}

const scheduleViewerTimeRange = ref(null) // [startDate, endDate]
const viewerPlatformFilter = ref('')

const selectVideosByRange = () => {
  if (!scheduleViewerTimeRange.value || scheduleViewerTimeRange.value.length !== 2) {
    ElMessage.warning('请先选择开始和结束时间范围')
    return
  }
  const [start, end] = scheduleViewerTimeRange.value.map(d => new Date(d).getTime())
  const newMap = {}
  viewerJobs.value.forEach(job => {
    // 如果平台过滤已选择且与job不匹配则跳过
    if (viewerPlatformFilter.value && job.platform !== viewerPlatformFilter.value) return
    const selected = (job.scheduleJob || []).filter(v => {
      const t = new Date(v.execTime).getTime()
      return t >= start && t <= end
    })
    if (selected.length > 0) newMap[job.jobKey] = selected
  })
  selectedVideosMap.value = newMap
  // 同步到 el-table 的选择状态，使复选框在 UI 上被勾选
  // nextTick(() => {
  Object.entries(newMap).forEach(([jobKey, rows]) => {
    const tbl = tableRefs.value[jobKey]
    if (!tbl || !Array.isArray(rows)) return
    // 先清空所有选择，再逐个勾选
    try {
      tbl.clearSelection && tbl.clearSelection()
    } catch (e) { }
    rows.forEach(r => {
      try {
        tbl.toggleRowSelection && tbl.toggleRowSelection(r, true)
      } catch (e) { }
    })
  })
  // })

  ElMessage.success('已勾选符合时间范围的视频')
}

const clearRangeSelection = () => {
  selectedVideosMap.value = {}
  scheduleViewerTimeRange.value = null
}

const filteredViewerJobs = computed(() => {
  let jobs = viewerJobs.value || []
  if (viewerPlatformFilter.value) {
    jobs = jobs.filter(j => j.platform === viewerPlatformFilter.value)
  }
  if (viewerFilter.value) {
    const keyword = viewerFilter.value.toLowerCase()
    jobs = jobs.filter(j => (j.topicName || '').toLowerCase().includes(keyword) || (j.gameName || '').toLowerCase().includes(keyword) || (j.platform || '').toLowerCase().includes(keyword))
  }
  return jobs
})

// 发起分发请求（将所选视频传给后端处理）
const dispatchSelectedVideos = async () => {
  const jobsPayload = []
  const selectedJobKeys = Object.keys(selectedVideosMap.value)

  // helper to compute percent map for a topic from an activity object
  const computePercentMap = (activity, topic) => {
    const map = {}
    const arr = activity.activityRequirements || []
    arr.forEach(rew => {
      // match on name or topic
      if (rew.name !== topic && rew.topic !== topic) return
      (rew.reward || []).forEach(req => {
        (rew.videoData || []).forEach(r => {
          if (!r.userName) return
          const p = getCompletionPercentage(req, r, activity).percentage
          map[r.userName] = map[r.userName] !== undefined ? Math.min(map[r.userName], p) : p
        })
      })
    })
    return map
  }

  // 构建待分发稿件列表及所有账户信息
  const percentByTopic = {} // topic -> { account: percent }
  selectedJobKeys.forEach(jobKey => {
    const arr = selectedVideosMap.value[jobKey]
    if (!arr || arr.length === 0) return
    const [platform] = jobKey.split('::')
    const topic = jobKey.split('::')[1]
    // compute percent map if not yet
    if (percentByTopic[topic] === undefined) {
      const vjob = viewerJobs.value.find(v => v.jobKey === jobKey)
      if (vjob && vjob.activity) {
        percentByTopic[topic] = computePercentMap(vjob.activity, topic)
      } else {
        percentByTopic[topic] = {}
      }
    }
    arr.forEach(item => {
      jobsPayload.push({
        platform,
        topicName: topic,
        videoPath: item.videoPath,
        execTime: item.execTime // 传递执行时间供后端做精确匹配
      })
    })
  })

  // if (jobsPayload.length === 0) {
  //   ElMessage.warning('未选择任何视频')
  //   return
  // }

  try {
    // 获取需要执行的账户列表（来自前端 allPlatformAccounts）
    const accountsByPlatform = {}
    jobsPayload.forEach(job => {
      const key = platformToKey[job.platform]
      if (key && !accountsByPlatform[job.platform]) {
        accountsByPlatform[job.platform] = (allPlatformAccounts.value[key] || []).map(a => a.accountName)
      }
    })

    // 自动设置分发时间范围为最近7日（如未手动选择）
    let timeRange = scheduleViewerTimeRange.value
    if (!timeRange || timeRange.length !== 2) {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      timeRange = [sevenDaysAgo, now]
    }

    let startTimeUtc8 = timeRange[0].toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const endTimeUtc8 = new Date(timeRange[1]).toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });


    const payload = {
      jobs: jobsPayload, // 所有待分发的稿件清单
      accountsByPlatform, // 各平台的账户列表
      percentByTopic, // 用户完成百分比
      endTime: endTimeUtc8,

      schedule: {
        startTime: startTimeUtc8,
        endTime: endTimeUtc8
      }
    }

    const resp = await fetch('/api/executeScheduleJobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!resp.ok) throw new Error('请求失败')
    const result = await resp.json()
    if (result.code === 200) {
      const msg = result.data?.skippedJobs
        ? `分发已触发（实际待分发${result.data.filteredJobs}件，跳过已达标${result.data.skippedJobs}件）`
        : '分发已触发，后台处理中'
      ElMessage.success(msg)
      // 清空选择并刷新数据
      selectedVideosMap.value = {}
      scheduleViewerDialogVisible.value = false
      fetchData()
    } else {
      ElMessage.error(result.msg || '分发触发失败')
    }
  } catch (err) {
    console.error('触发分发失败', err)
    ElMessage.error('触发分发失败')
  }
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

const selectedTrack = ref<string[]>([])

const specialTrackTagConfigs: SpecialTrackConfigs = {
  coser: {
    baseTags: ['#coser', '#cos正片', '#cos', '#写真'],
    extraTags: [],
  },
  搞笑: {
    baseTags: ['#搞笑', '#游戏搞笑', '#沙雕'],
    extraTags: ['#沙雕剪辑'],
  },
  攻略: {
    baseTags: ['#攻略', '#新手教程', '入坑指南'],
    extraTags: [],
  },
  乙游: {
    baseTags: ['#乙游', '#女性向游戏', '#galagame'],
    extraTags: [],
  },
  二次元: {
    baseTags: ['#二次元', '#角色扮演'],
    extraTags: [],
  },
  MMO: {
    baseTags: ['#MMO', '#大型多人在线', '#网游'],
    extraTags: [],
  },
  FPS: {
    baseTags: ['#FPS', '#射击游戏', '#第一人称'],
    extraTags: [],
  },
  RPG: {
    baseTags: ['#RPG', '#角色扮演游戏', '#冒险'],
    extraTags: [],
  },
}

const computedTrackTags = computed(() => {
  if (!selectedTrack.value || selectedTrack.value.length === 0 || !scheduleForm.value?.gameName) {
    return ''
  }

  // 收集所有选中赛道的标签
  const allTagsSet = new Set<string>()
  allTagsSet.add(`#${scheduleForm.value.gameName}`)

  selectedTrack.value.forEach((track) => {
    const config = specialTrackTagConfigs[track]
    if (config) {
      config.baseTags.forEach((t) => allTagsSet.add(t))
      config.extraTags.forEach((t) => allTagsSet.add(t))
    }
  })

  const allTags = Array.from(allTagsSet)

  const formatTagsByPlatform = (tags: string[], platform: string): string => {
    const formattedTags = tags.map((tag) => {
      if (platform === 'bilibili') {
        return tag.startsWith('#') ? tag.slice(1) : tag
      }
      return tag.startsWith('#') ? tag : `#${tag}`
    })

    return formattedTags.join(platform === 'bilibili' ? ',' : ' ')
  }

  return formatTagsByPlatform(allTags, scheduleForm.value.platform)
})

// 处理赛道变化
const handleTrackChange = (value: string[] | string): void => {
  const hasValue = Array.isArray(value) ? value.length > 0 : !!value
  if (!hasValue) {
    scheduleForm.value.tag = ''
    return
  }

  // 仅在未禁用自动生成标签时更新
  if (!scheduleForm.value.disabledTag) {
    scheduleForm.value.tag = computedTrackTags.value
  }
}



// 获取未完成的定时任务
const getUnfinishedTasks = () => {
  const tasks = []

  // 遍历所有平台的定时任务
  Object.entries(scheduleJobMap.value).forEach(([platform, jobs]) => {
    jobs.forEach(job => {
      // 检查是否有未完成的任务
      const isUnfinished = job.scheduleJob?.some(task => {
        const requiredAccounts = platform === 'bilibili' ? 3 : platform === '抖音' ? 2 : 1
        return task.successExecAccount?.length < requiredAccounts
      })

      if (isUnfinished) {
        // 计算已完成账号数和总账号数
        let completed = 0
        let total = 0

        job.scheduleJob?.forEach(task => {
          completed += task.successExecAccount?.length || 0
          total += platform === 'bilibili' ? 3 : platform === '抖音' ? 2 : 1
        })

        // 计算剩余天数
        const daysLeft = job.etime ? getDaysDiff(new Date(job.etime).getTime()) : 0

        tasks.push({
          gameName: job.gameName,
          platform,
          topicName: job.topicName,
          accountStatus: {
            completed,
            total
          },
          daysLeft
        })
      }
    })
  })

  // 按剩余天数升序排序（优先显示即将结束的任务）
  return tasks.sort((a, b) => a.daysLeft - b.daysLeft)
}

// 修改执行定时任务的流程：合并到查看弹窗并展示未完成任务
const showUnfinishedTasksDialog = () => {
  const tasks = getUnfinishedTasks()
  // 将 tasks 转换为 viewerJobs 形式（platform 与 scheduleJob 需要填充）
  const jobs = []
  tasks.forEach(t => {
    const platformJobs = scheduleJobMap.value[t.platform] || []
    const matched = platformJobs.find(j => j.topicName === t.topicName)
    if (matched) {
      jobs.push(buildViewerJob(matched, t.platform))
    }
  })
  viewerJobs.value = jobs
  selectedVideosMap.value = {}
  scheduleViewerDialogVisible.value = true
}

// 确认执行所有定时任务（保留旧方法兼容）
const executeScheduleJobs = async () => {
  // 如果用户希望直接执行所有未完成任务，调用后端立即执行（复用原 confirmScheduleJob 接口）
  await confirmScheduleJob(true)
}

</script>

<style scoped>
.table-container {
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

.row-dispatched {
  background: #f5f7fa;
}
/* 固定标签面板样式 */
.fixed-tag-panel {
  position: fixed;
  top: 10px;
  right: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 15px;
  max-width: 450px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
  z-index: 999;
  color: white;
  font-weight: 500;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
}

.panel-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.panel-controls {
  display: flex;
  gap: 8px;
}

.panel-controls :deep(.el-button) {
  padding: 6px 12px;
  font-size: 12px;
}

.panel-content {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }

  to {
    opacity: 1;
    max-height: 1000px;
  }
}

.track-tags-section {
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.track-controls {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.track-controls :deep(.el-button) {
  padding: 5px 10px;
  font-size: 11px;
  white-space: nowrap;
}

.track-group {
  margin-bottom: 10px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  overflow: hidden;
}

.track-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  transition: background 0.2s ease;
  user-select: none;
}

.track-header:hover {
  background: rgba(255, 255, 255, 0.15);
}

.track-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
}

.track-toggle {
  font-size: 11px;
  opacity: 0.7;
  min-width: 12px;
}

.track-title {
  font-size: 12px;
  font-weight: bold;
}

.tag-count {
  font-size: 11px;
  opacity: 0.6;
}

.track-copy-btn {
  padding: 5px 10px;
  font-size: 11px;
}

.track-copy-btn :deep(.el-button) {
  padding: 5px 10px;
  font-size: 11px;
}

.platform-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
}

.platform-name {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 0;
  flex: 1;
}

.platform-copy-btn {
  padding: 5px 10px;
  font-size: 11px;
}

.platform-copy-btn :deep(.el-button) {
  padding: 5px 10px;
  font-size: 11px;
}

.track-content {
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  animation: expandTrack 0.2s ease-out;
}

@keyframes expandTrack {
  from {
    opacity: 0;
    max-height: 0;
  }

  to {
    opacity: 1;
    max-height: 500px;
  }
}

.game-section {
  margin-bottom: 15px;
}

.section-title {
  font-size: 13px;
  font-weight: bold;
  padding: 8px 0;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  word-break: break-word;
}

.platform-group {
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  backdrop-filter: blur(10px);
}

.platform-name {
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 8px;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  display: inline-block;
  background: rgba(255, 255, 255, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.4);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.tag-item:hover {
  background: rgba(255, 255, 255, 0.4);
  border-color: rgba(255, 255, 255, 0.6);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.panel-summary {
  font-size: 13px;
  max-width: 400px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-state {
  text-align: center;
  padding: 20px 10px;
  font-size: 13px;
  opacity: 0.8;
}

.empty-state p {
  margin: 0;
}

.open-tag-panel-btn {
  position: fixed;
  top: 10px;
  right: 20px;
  z-index: 998;
}

/* 滚动条美化 */
.fixed-tag-panel::-webkit-scrollbar {
  width: 6px;
}

.fixed-tag-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.fixed-tag-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.fixed-tag-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}

.text-gray-400 {
  color: rgba(255, 255, 255, 0.6);
}
</style>
