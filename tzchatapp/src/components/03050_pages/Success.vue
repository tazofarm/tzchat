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

<style scoped>

/* ── adminMainpage.vue: CSS 보정만 적용 ──
   - 가독성: 기본 글씨 검정 유지
   - 모바일 터치 타깃(≥48px) / 버튼 일관 규격
   - safe-area / 작은 화면 대응
   - 포커스 접근성(:focus-visible) 강화
*/

/* 컨테이너 */
.admin-mainpage {
  color: #000;                         /* 기본 텍스트 톤 고정 */
  padding: 16px 20px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  max-width: 800px;                    /* 데스크톱에서 너무 넓지 않게 */
  margin: 0 auto;                      /* 중앙 정렬 */
  box-sizing: border-box;
}

/* 제목/설명 */
.title {
  margin: 4px 0 8px;
  font-size: clamp(18px, 3.6vw, 20px);
  font-weight: 700;
  color: #000;
  line-height: 1.25;
}
.desc {
  margin: 0 0 16px;
  font-size: clamp(14px, 2.8vw, 15px);
  color: #222;
  opacity: 0.9;
  line-height: 1.4;
}

/* 메뉴 리스트 */
.menu-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 버튼: 터치 타깃/가독성/일관성 */
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  width: 100%;
  min-height: 48px;                    /* 터치 타깃 */
  padding: 12px 14px;

  font-size: clamp(15px, 3vw, 16px);
  font-weight: 600;
  line-height: 1.2;

  border: 1px solid #333;
  border-radius: 12px;

  background: #fff;
  color: #000;
  text-align: left;                    /* 번호+텍스트 왼쪽 정렬 */
  cursor: pointer;

  transition: background .15s, transform .06s ease-out, box-shadow .15s;
  -webkit-tap-highlight-color: rgba(0,0,0,0.05);
}
.menu-btn:hover { background: #f0f0f0; }
.menu-btn:active { transform: translateY(1px); }
.menu-btn:disabled { opacity: .6; cursor: not-allowed; }

/* 포커스 접근성 */
.menu-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59,130,246,.35);
}

/* 디버그 박스 */
.debug-box {
  margin-top: 18px;
  padding: 10px 12px;
  border: 1px dashed #aaa;
  border-radius: 10px;
  font-size: clamp(13px, 2.6vw, 14px);
  color: #000;
  background: #fafafa;
  line-height: 1.35;
}

/* 초소형 화면(≤360px) 보정 */
@media (max-width: 360px) {
  .admin-mainpage { padding: 14px 14px; }
  .menu-btn { padding: 12px; }
}



</style>

