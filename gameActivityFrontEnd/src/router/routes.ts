import { List, DataAnalysis } from '@element-plus/icons-vue'

export interface RouteConfig {
  path: string
  name: string
  icon: unknown
  component?: unknown
}

export const routes: RouteConfig[] = [
  {
    path: '/',
    name: '多平台游戏激励',
    icon: List,
    component: () => import('../views/gameActivity.vue')
  },
  {
    path: '/HupuRating',
    name: '虎扑评分',
    icon: DataAnalysis,
    component: () => import('../views/HupuRating.vue')
  }
]
