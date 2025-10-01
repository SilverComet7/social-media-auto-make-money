# 使用 Node.js 官方镜像作为基础镜像
FROM node:latest

# 安装ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# 设置工作目录
WORKDIR /app

# # # 复制 后端项目文件
# COPY gameActivityBackEnd/ ./gameActivityBackEnd
# # # 复制 前端项目文件
# COPY gameActivityFrontEnd/ ./gameActivityFrontEnd

COPY . ./

# 安装依赖
RUN npm install -g pnpm concurrently

RUN pnpm run install

# 创建存放敏感配置的目录
RUN mkdir -p /app/config

# 暴露端口
EXPOSE 3000 3001 

# 设置 volume 挂载点
VOLUME ["/app/config", "/app/data"]

CMD ["npm", "run", "dev"]
