# Team Manage — 모바일 앱

`../` (Next.js 백엔드)를 그대로 API 서버로 쓰는 React Native(Expo) 클라이언트.
로그인/새 팀 만들기/일정/게시판/투표/랭킹까지 실제 API와 붙어서 동작한다.

## 시작하기

```bash
npm install
npm start
```

`npm start`(= `expo start`)를 실행하면 QR 코드가 뜨고, 휴대폰에 [Expo Go](https://expo.dev/go) 앱을
설치한 뒤 스캔하면 바로 실행된다. 시뮬레이터로 볼 거면:

```bash
npm run ios      # macOS + Xcode 필요
npm run android  # Android Studio 필요
```

## API 서버 주소 설정 (중요)

`src/api/config.ts`의 `API_BASE_URL`을 실제 서버 주소로 바꿔야 한다. 기본값
`http://localhost:3000`은 시뮬레이터에서만 통한다 — 실 기기(Expo Go)로 테스트할
땐 휴대폰이 컴퓨터의 `localhost`에 접근할 수 없기 때문이다.

| 실행 환경 | 값 |
| --- | --- |
| iOS 시뮬레이터 | `http://localhost:3000` |
| Android 에뮬레이터 | `http://10.0.2.2:3000` |
| 실제 기기 (Expo Go, 같은 와이파이) | `http://<PC의 LAN IP>:3000` (예: `http://192.168.0.10:3000`) |
| 배포된 서버 | `https://<배포 도메인>` |

로컬 백엔드를 같이 띄우려면 저장소 루트에서:

```bash
cd ..
npm install
npm run dev   # http://localhost:3000
```

## 구조

```
App.tsx                      # 진입점 — SafeArea/Auth/Navigation 프로바이더
src/
  api/
    config.ts                 # API_BASE_URL
    client.ts                 # fetch 래퍼 — SecureStore 토큰을 Authorization 헤더로 주입
    types.ts                  # 백엔드 lib/types.ts에서 화면에 필요한 만큼만 옮겨온 타입
  auth/
    AuthContext.tsx            # 세션 상태 + login/signup/createTeam/logout
  navigation/
    RootNavigator.tsx          # 로그인 여부에 따라 AuthNavigator ↔ MainTabs 전환
    AuthNavigator.tsx          # 로그인/가입/새 팀 만들기 스택
    MainTabs.tsx                # 홈/일정/게시판/투표/랭킹 하단 탭 (웹 Nav.tsx와 동일 구성)
  screens/                     # 화면별 컴포넌트
```

## 인증 방식

웹은 httpOnly 쿠키로 세션을 유지하지만, 이 앱은 브라우저 쿠키 저장소가 없어서
로그인/새 팀 만들기 응답에 같이 내려오는 서명된 `token`을 `expo-secure-store`에
저장해뒀다가 매 요청마다 `Authorization: Bearer <token>` 헤더로 보낸다. 백엔드
(`lib/auth.ts`)가 쿠키와 Authorization 헤더를 둘 다 받아들이므로 같은 로그인
로직을 그대로 쓴다.

## 현재까지 구현된 것

- 팀 코드 로그인 / 새 팀 만들기(자동 운영진) / 가입 신청
- 홈: 다가오는 일정 목록
- 일정: 전체 일정 + 스코어
- 게시판: 공지 목록(코치 피드백 제외)
- 투표: 진행 중인 투표 + 실시간 득표 현황(읽기 전용)
- 랭킹: 시즌 랭킹 테이블

## 아직 안 된 것 (다음 단계)

- 투표 참여(참석투표/이벤트투표 모두 지금은 읽기 전용), 스쿼드 확인, 경기 기록
  입력, 계정 설정 화면, 푸시 알림
- 팀 로고/브랜딩을 앱 안에서 팀별로 보여주는 부분(OS 홈 화면 아이콘은 앱스토어
  빌드 하나당 고정이라 별도 논의 필요)
