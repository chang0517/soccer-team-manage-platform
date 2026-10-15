// 로컬 개발 중에는 이 값을 개발 서버가 실제로 떠 있는 주소로 바꿔야 한다.
// - iOS 시뮬레이터: http://localhost:3000 로 접속 가능
// - Android 에뮬레이터: http://10.0.2.2:3000
// - 실제 기기(Expo Go): 같은 와이파이의 PC LAN IP, 예) http://192.168.0.10:3000
// APK로 빌드해서 배포할 거면 로컬 주소로는 동작하지 않으니, 배포된 서버
// 주소로 고정해둔다.
export const API_BASE_URL = "https://soccer-team-manage-platform-jade.vercel.app";
