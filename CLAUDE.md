# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **multi-platform social media automation platform** designed for gaming content creators to monetize through platform incentive programs (抖音/Bilibili/小红书/快手). The system automates the entire workflow: video collection → deduplication processing → scheduled multi-platform distribution → data aggregation and analysis.

The project consists of:
- **Node.js Backend** (`gameActivityBackEnd/`): Express server handling video processing, scheduled tasks, and API endpoints
- **Vue 3 Frontend** (`gameActivityFrontEnd/`): Management dashboard built with Element Plus and Tailwind CSS
- **Python Submodules** (git submodules):
  - `TikTokDownloader`: Video scraping and filtering from Douyin
  - `social-auto-upload`: Multi-platform video uploader with browser automation
  - `Crawler`: Data crawler for Bilibili/Douyin/Xiaohongshu/Kuaishou platforms

**Business Model**: Gaming platforms offer promotional tasks where creators publish videos and earn revenue based on views/engagement metrics (no follower requirements). This tool automates multi-account operations to scale revenue.

## Common Commands

### Development

Start the full development environment (backend + frontend + crawler):
```bash
npm run dev_start
```

This concurrently runs:
- Backend in TypeScript mode: `cd gameActivityBackEnd && npm run dev_ts`
- Frontend dev server: `cd gameActivityFrontEnd && npm run dev`
- Python crawler: `cd Crawler && python main.py`

### Installation

Install all dependencies across the monorepo:
```bash
npm run install
```

### Backend Commands

Navigate to `gameActivityBackEnd/` for these commands:

```bash
# Development with auto-reload (ignoring JSON changes)
npm run dev

# TypeScript development mode with ts-node
npm run dev_ts

# Production mode
npm run start

# Type-checking and build
npm run build

# Linting
npm run lint
npm run lint:fix
```

### Frontend Commands

Navigate to `gameActivityFrontEnd/` for these commands:

```bash
# Development server
npm run dev

# Build for production with type-checking
npm run build

# Preview production build
npm run preview

# Type-checking only
npm run type-check

# Linting and formatting
npm run lint
npm run format
```

## Architecture

### Backend Structure (`gameActivityBackEnd/`)

```
gameActivityBackEnd/
├── index.js                 # Main Express server entry point
├── const.js                 # Global constants (game lists, paths, platform configs)
├── commonFunction.js        # Shared utilities (data processing, file I/O)
├── ffmpegHandle/            # Video processing with FFmpeg
│   ├── videoReName_FFmpegHandle.js        # Worker-based parallel processing
│   ├── videoTransformDeduplication.js     # Deduplication filters (mirror/speed/blur/frame interpolation)
│   ├── frameInterpolation.js              # Frame rate manipulation for deduplication
│   ├── taskProgress.js                    # Task state management
│   └── common.js                          # GPU detection, logging utilities
├── crawerHandle/            # Platform-specific crawlers
│   ├── bilibili.js
│   └── douyin.js
├── src/modules/             # Modular features (in progress migration)
│   ├── schedule/            # Scheduled upload tasks
│   ├── ai/                  # AI service integration
│   └── reply/               # Auto-reply functionality
├── jsonFile/                # Local JSON "database"
│   ├── data.json            # Non-game platform activities
│   ├── gameData.json        # Game activities with rewards config
│   ├── topic.json           # Platform-specific topics/tags
│   └── accountList.json     # Multi-account credentials
└── scheduleJob/             # Scheduled task configurations
    ├── BiliBiliScheduleJob.json
    ├── DouyinScheduleJob.json
    └── XhsScheduleJob.json
```

**Key Backend Patterns**:

1. **No Database**: All data persists in JSON files (`jsonFile/` directory). Use `getJsonData()` and `writeLocalDataJson()` from `commonFunction.js`.

2. **FFmpeg Video Processing**:
   - Uses **Worker threads** for CPU-intensive video processing
   - Automatically detects GPU (NVIDIA/AMD) for hardware encoding acceleration
   - Optimal worker count: GPU detected → min(cpuCores, 8), CPU-only → cpuCores/2
   - Deduplication strategies: speed adjustment, mirroring, rotation, blur, frame rate manipulation

3. **Platform Configuration** (`const.js`):
   - `gameList`: Array of supported games (tracked for incentive programs)
   - `platformConfig`: Maps platform names to uploader paths and config files
   - `PROJECT_ROOT` and `TikTokDownloader_ROOT`: Critical absolute paths (Windows-specific)

4. **API Architecture**:
   - CORS-enabled Express server on port 3000
   - Static video serving: `/static_videos` → `TikTokDownloader/gamelist/`
   - Child processes for CPU-intensive operations (data crawling, FFmpeg)

### Frontend Structure (`gameActivityFrontEnd/`)

```
gameActivityFrontEnd/
├── src/
│   ├── views/
│   │   └── gameActivity.vue    # Main dashboard component
│   ├── router/                 # Vue Router configuration
│   └── components/             # Reusable Vue components
├── vite.config.ts              # Vite configuration
└── tailwind.config.js          # Tailwind CSS configuration
```

**Frontend Tech Stack**:
- Vue 3 Composition API
- Element Plus for UI components
- Tailwind CSS for styling
- Lucide icons

**Main Dashboard** (`gameActivity.vue`):
- Three operation sections: Crawler queries / Video processing / Scheduled tasks
- Data table showing games, revenue estimates, platform rewards, and metrics
- Dialogs for: video download, FFmpeg processing, scheduled task setup

### External Dependencies (Git Submodules)

These are **separate repositories** cloned into the project:

1. **TikTokDownloader** (Python):
   - Downloads watermark-free Douyin videos
   - Filters by: likes (20-1000), duration (>30s), follower count (100-50k)
   - Stores downloaded videos in `TikTokDownloader/gameList/`

2. **social-auto-upload** (Python + Playwright):
   - Browser automation for multi-platform uploads
   - Supports: Douyin, Bilibili, Xiaohongshu, Kuaishou, WeChat Channels
   - Backend API on port 5409, CLI mode available
   - Uses SQLite database for account/file management

3. **Crawler** (Python):
   - RESTful API crawler server (default port 8080)
   - Scrapes public data from Douyin/Kuaishou/Bilibili/Xiaohongshu/Weibo
   - Returns video stats, comments, user info

## Critical Configuration

### Absolute Paths

The project uses **hardcoded Windows paths** in `const.js`:
```javascript
PROJECT_ROOT = "D:\\code\\platform_game_activity\\"
TikTokDownloader_ROOT = "D:\\code\\platform_game_activity\\TikTokDownloader\\"
```

When deploying to a different machine, update these paths in `gameActivityBackEnd/const.js`.

### Account Management

Edit `gameActivityBackEnd/jsonFile/accountList.json` to manage multi-account credentials:
```json
{
  "bilibili": [{"Cookie": "...", "name": "account1"}],
  "douyin": [...],
  "xiaohongshu": [...],
  "kuaishou": [...]
}
```

### FFmpeg Requirements

FFmpeg must be installed and available in PATH. The system will:
1. Detect GPU hardware (NVIDIA/AMD) using `nvidia-smi` or `wmic`
2. Use hardware encoders when available: `h264_nvenc`, `hevc_nvenc`, `h264_amf`, `hevc_amf`
3. Fall back to CPU encoding (`libx264`) if no GPU detected

## Workflow Overview

1. **Video Collection**:
   - Use TikTokDownloader to scrape Douyin videos by group/keyword
   - Videos stored in `TikTokDownloader/gameList/[gameName]/`
   - Filter criteria: 30s+ duration, specific like/follower ranges

2. **Video Deduplication**:
   - Frontend triggers FFmpeg processing via `/ffmpeghandlevideo` endpoint
   - Worker threads process videos in parallel
   - Applied filters: speed variation (0.9-1.1x), mirror, rotation, blur, frame interpolation
   - Original-to-processed filename mapping stored in `reNameMap.json`

3. **Scheduled Upload**:
   - Configure scheduled tasks per platform in frontend
   - Backend uses `node-schedule` to trigger uploads
   - Calls `social-auto-upload` Python scripts via child processes
   - Task configs stored in `scheduleJob/[Platform]ScheduleJob.json`

4. **Data Aggregation**:
   - Crawler service provides unified API for platform metrics
   - Frontend queries video performance data
   - Calculate revenue estimates based on views/engagement thresholds
   - Track activity deadlines and completion status

## Development Notes

- **TypeScript Migration**: Backend is gradually migrating to TypeScript. Use `.js` files for now but enable type-checking with `npm run dev_ts`.

- **JSON File Locking**: In dev mode, writing to JSON files triggers server restart. Consider:
  - Using `--ignore jsonFile/*` in nodemon config
  - Migrating to a proper database for concurrent access

- **Error Handling**: Check `gameActivityBackEnd/logs/` for FFmpeg processing logs.

- **Monorepo Structure**: This is NOT a true monorepo. Python submodules have their own dependencies. Install separately:
  ```bash
  cd TikTokDownloader && pip install -r requirements.txt
  cd social-auto-upload && pip install -r requirements.txt
  cd Crawler && pip install -r requirements.txt
  ```

## API Endpoints

Key backend endpoints (port 3000):

- `GET /getNewActData` - Fetch new Bilibili activities
- `GET /getGameList` - Retrieve game data with rewards
- `POST /updateGameList` - Update game activity data
- `POST /ffmpeghandlevideo` - Process videos with FFmpeg
- `POST /downloadAndGroup` - Download videos using TikTokDownloader
- `GET /queryAllPlatformData` - Aggregate data from all platforms
- `POST /scheduleUpload` - Create scheduled upload tasks

## Common Gotchas

1. **Windows-Only**: Paths use Windows backslashes. Requires adaptation for Linux/Mac deployment.

2. **Port Conflicts**: Default ports are 3000 (backend), 5173 (frontend), 8080 (crawler), 5409 (social-auto-upload).

3. **Cookie Expiration**: Platform cookies in `accountList.json` expire. Re-login required when API calls fail.

4. **GPU Detection**: If GPU detection fails but you have compatible hardware, check driver installation and command availability (`nvidia-smi` or `wmic`).

5. **Submodule Updates**: When pulling upstream changes:
   ```bash
   git submodule update --init --recursive
   ```
