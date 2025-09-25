<!-- tzchatapp/src/views_legal/LegalIframe.vue -->
<template>
  <ion-page>
  <!--  <ion-header translucent>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ pageTitle }}</ion-title>
      </ion-toolbar>
    </ion-header> -->

    <ion-content :fullscreen="true">
      <iframe
        class="legal-iframe"
        :src="legalUrl"
        title="Legal Page"
        referrerpolicy="no-referrer"
      ></iframe>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent
} from '@ionic/vue'
import { useRoute } from 'vue-router'
import { computed } from 'vue'

/**
 * /legal/:slug 형태로 진입하면
 * 실제 정적 파일은 /legal/<slug>.html 로 매핑합니다.
 * (빌드 산출물의 public/legal/* 에 포함됨)
 */
const route = useRoute()
const slug = computed(() => String(route.params.slug || '').replace(/[^a-z0-9\-]/gi, ''))

const fileMap: Record<string, string> = {
  'index'              : '00_index.html',
  'privacy'            : '01_privacy.html',
  'terms'              : '02_terms.html',
  'location'           : '03_location.html',
  'delete-account'     : '04_delete-account.html',
  'youth'              : '05_youth.html',
  'eula'               : '06_eula.html',
  'cookies'            : '07_cookies.html',
  'data-retention'     : '08_data-retention.html',
  'marketing-consent'  : '09_marketing-consent.html',
  'third-parties'      : '10_third-parties.html',
  'processors'         : '11_processors.html',
  'opensource'         : '12_opensource.html',
  'community'          : '13_community.html',
  'report-block'       : '14_report-block.html',


}

const filename = computed(() => fileMap[slug.value] || '00_index.html')
const legalUrl  = computed(() => `/legals/${filename.value}`)

const titleMap: Record<string, string> = {
  'index'             : '법/정책 문서 목록',
  'privacy'           : '개인정보처리방침',
  'terms'             : '서비스 이용약관',
  'location'          : '위치기반서비스 이용약관',
  'delete-account'    : '계정 삭제 안내',
  'youth'             : '청소년보호정책',
  'eula'              : 'EULA',
  'cookies'           : '쿠키 정책',
  'data-retention'    : '데이터 보관/파기 정책',
  'marketing-consent' : '광고성 정보 수신 동의',
  'third-parties'     : '개인정보 제3자 제공 현황',
  'processors'        : '개인정보 처리위탁 현황',


  'opensource'         : '오픈소스 라이선스 고지',
  'community'          : '커뮤니티 가이드라인',
  'report-block'       : '신고 및 차단 정책',
  
}




const pageTitle = computed(() => titleMap[slug.value] || '법/정책 문서')
</script>

<style scoped>
.legal-iframe {
  width: 100%;
  height: 100vh;
  border: 0;
  display: block;
}
</style>
