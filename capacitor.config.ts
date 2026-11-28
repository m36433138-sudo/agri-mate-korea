import type { CapacitorConfig } from '@capacitor/cli';

// 안드로이드 앱은 운영 주소를 그대로 연다: 웹을 배포하면 앱도 바로 최신이 된다 (앱을 다시 깔 필요 없음).
// 앱을 다시 만들어야 하는 건 위치 플러그인 같은 네이티브 부분이 바뀔 때뿐이다.
const config: CapacitorConfig = {
  appId: 'com.gwangmun.cs',
  appName: '광문농기',
  webDir: 'dist',
  server: {
    url: 'https://cs.gwangmun.com',
    androidScheme: 'https',
  },
  android: {
    // 위치 공유 알림이 떠 있는 동안 웹뷰가 멈추지 않게 한다
    useLegacyBridge: true,
  },
};

export default config;
