import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '../components/layout/AppLayout.vue'
import { routes } from './routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: routes.map(route => ({
        path: route.path === '/' ? '' : route.path,
        name: route.name,
        component: route.component
      }))
    }
    // ...routes,
  ]
})

export default router
