# Team Manage Platform

여러 조기축구팀(또는 사내 동호회)을 하나의 앱·서버·DB로 지원하는 **멀티테넌트** 팀 운영 관리 플랫폼입니다.

## 현재 상태

이 repo는 [Raven FC 팀 전용 앱](https://github.com/chang0517/soccer-team-manage)의 코드베이스를 베이스로 시작합니다. 일정·투표·스쿼드 자동 생성·경기 기록·랭킹·전술판 등 이미 검증된 기능을 그대로 재사용하되, 다음 방향으로 리팩터링하는 중입니다.

- **싱글테넌트 → 멀티테넌트**: 팀마다 레포를 복제하던 방식(Raven FC, Blum FC)을 버리고, `teams` 테이블 + 모든 데이터 테이블에 `team_id`를 붙이는 구조로 전환. 팀별 명단·운영진 화이트리스트·계좌 정보·브랜딩을 코드가 아니라 DB 행으로 관리.
- **웹(PWA) → 네이티브 앱**: React Native 기반 iOS/Android 앱으로 클라이언트를 새로 만들고, 지금의 Next.js API routes를 그대로 백엔드로 재사용.
- **인프라**: DB는 Supabase(Postgres, 비용 효율), 서버는 자체 맥미니에서 운영하는 구조를 계획 중.

베이스로 가져오면서 raven 팀의 실제 선수 명단(`lib/roster.ts`)과 운영진 화이트리스트(`lib/roles.ts`), 벌금 계좌 정보(`lib/fines.ts`)는 전부 비우거나 플레이스홀더로 교체했습니다 — 이 repo는 특정 팀 전용이 아니라 플랫폼 스타터이기 때문입니다.

## 진행 중인 작업

- [ ] `teams` 테이블 설계 + 기존 스키마 전체에 `team_id` 스코프 적용
- [ ] 팀 온보딩(가입) 플로우 — 새 팀이 자기 팀 스페이스를 만드는 화면/절차
- [ ] React Native 클라이언트

## 로컬 개발

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다. `DATABASE_URL`을 설정하지 않으면 `/data/`에 로컬 SQLite 파일이 생성됩니다.

```bash
npm run build   # 프로덕션 빌드
npm run lint    # ESLint
```

기존 단일 팀 버전의 상세 기능 설명은 [Raven FC repo의 README](https://github.com/chang0517/soccer-team-manage#readme)를 참고하세요 — 이 repo가 멀티테넌트로 자리잡을 때까지는 기능 자체는 거의 동일합니다.
