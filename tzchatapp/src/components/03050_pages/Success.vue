<script setup>
import { IonButton } from '@ionic/vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from '@/lib/axiosInstance' // ✅ 변경

const router = useRouter()
const nickname = ref('')

const goHome = () => {
  router.push('/home')
}

const logout = async () => {
  try {
    const res = await axios.post('/api/logout', {}, { withCredentials: true }) // ✅ 절대주소 → 상대주소
    console.log('로그아웃 응답:', res.data)
    router.push('/login')
  } catch (error) {
    console.error('로그아웃 실패:', error)
  }
}

onMounted(async () => {
  try {
    const res = await axios.get('/api/me', { withCredentials: true }) // ✅ 절대주소 → 상대주소
    console.log('세션 사용자 정보:', res.data)
    nickname.value = res.data.user?.nickname || ''
  } catch (error) {
    console.error('세션 사용자 정보 불러오기 실패:', error)
    router.push('/login')
  }
})
</script>
