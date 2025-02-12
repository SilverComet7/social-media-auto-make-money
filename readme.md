# 自媒体自动爆米工具

这是一个用于下载视频，去重后，并自动上传自媒体平台的管理后台，不依赖数据库

多自媒体平台聚合做任务

1. 抖音
2. B 站
3. 快手
4. 小红书

# 依赖

在开始之前，请确保你已经安装了以下软件：

- Python 3.12
- Node.js
- ffmpeg

感谢以下fork过来的开源项目

1. [TikTokDownloader](https://github.com/SilverComet7/TikTokDownloader) 获取视频  
2. [ffmpeg](https://ffmpeg.org/) 视频去重处理  
3. [social-auto-upload](https://github.com/SilverComet7/social-auto-upload) 多平台定时上传  
4. [Crawler](https://github.com/SilverComet7/Crawler) 获取数据

# 功能

- 筛选视频下载 （抖音|小红书|快手）
  - 关键词下载
  - 按分组下载
  - 读取特定download.txt文件路径下载
- 控制去重选项
- 定时上传视频
- 视频数据聚合查看


