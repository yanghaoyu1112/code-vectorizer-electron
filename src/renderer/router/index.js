import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '../views/Home.vue';
import ProjectScan from '../views/ProjectScan.vue';
import Settings from '../views/Settings.vue';
import ProjectList from '../views/ProjectList.vue';
import Search from '../views/Search.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { title: '首页' }
  },
  {
    path: '/scan',
    name: 'ProjectScan',
    component: ProjectScan,
    meta: { title: '项目扫描' }
  },
  {
    path: '/projects',
    name: 'ProjectList',
    component: ProjectList,
    meta: { title: '项目管理' }
  },
  {
    path: '/search',
    name: 'Search',
    component: Search,
    meta: { title: '语义搜索' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { title: '设置' }
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
