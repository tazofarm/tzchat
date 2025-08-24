# ==========================================
# ProGuard / R8 Rules for Ionic + Capacitor
# 안전 기본 템플릿 (필요 최소 + 보수적 keep)
# ==========================================
# ⚠️ 런타임 크래시가 나면 Play Console의 크래시 스택을 보고
#    해당 패키지/클래스를 -keep 으로 보완하세요.
#    (mapping.txt 업로드 필수: 디옵스케이트 해제로 분석 용이)
#
# ✅ mapping.txt 위치 (기본):
#    app/build/outputs/mapping/release/mapping.txt
# ==========================================

########## 기본 가이드 ##########
# (원본 파일의 주석/기본 가이드 보존)
# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

########## WebView + JS Interface ##########
# WebView에서 @JavascriptInterface 를 사용하는 경우, 해당 멤버는 보존 필요
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# 특정 JS 인터페이스 클래스를 보존해야 한다면 패키지명에 맞게 해제/변경
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

########## Android 기본/리소스 ##########
# (문제 발생 시 R 클래스 보존을 고려 — 보통 불필요)
#-keep class **.R$* { *; }

########## 직렬화 / 네이티브 ##########
-keep class ** implements java.io.Serializable { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}

########## 리플렉션/애노테이션 ##########
# JSON 직렬화 라이브러리(Gson/Moshi/Jackson) 사용 시 클래스/필드 이름이 필요
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
# Gson의 리플렉션 필드 접근을 돕기 위한 예시(필요시 보완)
#-keep class com.google.gson.stream.** { *; }
#-keep class com.google.gson.** { *; }

########## Capacitor / AndroidX / Google (안전 범위) ##########
-keep class com.getcapacitor.** { *; }
-keep class androidx.** { *; }
-keep interface androidx.** { *; }

# (사용 시) Firebase / Play Services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

########## 네트워킹(예: Retrofit/OkHttp) — 사용 시 활성화 ##########
# Retrofit 인터페이스 유지
#-keep class retrofit2.** { *; }
#-keep class okhttp3.** { *; }
#-dontwarn okhttp3.**
#-dontwarn okio.**
#-dontwarn javax.annotation.**
#-keep class com.squareup.okhttp.** { *; }   # (구버전 사용 시)
#-keepattributes Exceptions

########## 이미지 라이브러리(Glide/Picasso 등) — 사용 시 활성화 ##########
#-keep class com.bumptech.glide.** { *; }
#-keep public class * implements com.bumptech.glide.module.GlideModule
#-keep public class * extends com.bumptech.glide.AppGlideModule
#-keep class com.squareup.picasso.** { *; }

########## 앱 고유 패키지(모델/DTO 등) — 필요시 패키지명 교체 ##########
# 앱에서 리플렉션/동적 로딩/JSON 매핑이 많이 쓰이는 모델 패키지는 보존 권장
# 예) your.package.name.model → 실제 패키지명으로 변경
#-keep class your.package.name.model.** { *; }

########## 로그 제거(선택) ##########
# 릴리스에서 Log 호출 제거로 크기 축소/성능 약간 개선
# (디버그용 로그가 필요하면 주석 유지)
#-assumenosideeffects class android.util.Log {
#    public static *** v(...);
#    public static *** d(...);
#    public static *** i(...);
#    public static *** w(...);
#    public static *** e(...);
#}

########## 라인 넘버/소스 파일(디버깅 가독성) ##########
# 스택트레이스 라인 넘버 유지 (권장)
-keepattributes SourceFile,LineNumberTable

# 라인 넘버를 유지하면서 원본 파일명을 숨기고 싶다면 사용
#-renamesourcefileattribute SourceFile
