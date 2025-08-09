<template>
  <div class="top-menu">
    <button
      v-for="item in menuItems"
      :key="item.name"
      :class="['menu-button', isActive(item.path)]"
      @click="goTo(item.path)"
    >
      {{ item.name }}
    </button>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// 각 버튼의 이름과 경로 정의 (나중에 이름만 바꾸면 됨)
const menuItems = [
  { name: '0긴급', path: '/home/0page' },
  { name: '1올', path: '/home/1page' },
  { name: '2타켓', path: '/home/2page' },
  { name: '3친구', path: '/home/3page' },
  { name: '4채팅', path: '/home/4page' },
  { name: '5찾기', path: '/home/5page' },
  { name: '6로필', path: '/home/6page' },
  { name: '7설정', path: '/home/7page' },
]

const goTo = (path) => {
  router.push(path)
}

const isActive = (path) => {
  return route.path === path ? 'active' : ''
}
</script>

<style scoped>
.top-menu {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem;
  background-color: #f8f8f8;
  border-bottom: 1px solid #ddd;
}

.menu-button {
  flex: 1;
  margin: 0 0.2rem;
  padding: 0.6rem 0;
  font-size: 0.85rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  background-color: #060606;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-button.active {
  background-color: #007bff;
  color: white;
}



.menu-button {
  flex: 1;
  margin: 0 0.2rem;
  padding: 0.6rem 0;
  font-size: 0.85rem;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  background-color: #060606;
  color: #ffffff; /* ✅ 글씨 흰색으로 지정 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.menu-button.active {
  background-color: #007bff;
  color: white; /* active 상태도 흰색 유지 */
}




</style>