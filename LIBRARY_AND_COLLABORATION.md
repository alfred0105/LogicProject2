# 🌐 회로 라이브러리 공유 & 실시간 협업 기능

## 📋 개요

LoCAD 시뮬레이터에 커뮤니티 라이브러리 공유와 실시간 협업 기능이 추가되었습니다.

---

## 🎯 주요 기능

### 1. 회로 라이브러리 공유 📚

#### 프로젝트 공개/비공개 설정
- **공개 프로젝트**: 누구나 열람, 좋아요, 포크 가능
- **비공개 프로젝트**: 본인만 접근 가능
- 설명, 태그, 썸네일 추가 가능

#### 커뮤니티 상호작용
- **좋아요 ❤️**: 마음에 드는 회로에 좋아요
- **포크 🍴**: 다른 사용자의 회로를 복사하여 수정
- **댓글 💬**: 회로에 대한 의견 교환
- **조회수 👁️**: 프로젝트 인기도 측정

#### 발견 및 탐색
- **인기 회로**: 좋아요, 조회수 기반 랭킹
- **최신 회로**: 최근 공개된 프로젝트
- **태그 필터**: 카테고리별 검색
- **검색**: 제목, 설명으로 회로 검색

---

### 2. 실시간 협업 🤝

#### 다중 사용자 동시 편집
- **실시간 동기화**: 여러 사용자가 동시에 회로 편집
- **변경사항 자동 반영**: 컴포넌트 추가/이동/삭제 즉시 공유
- **충돌 방지**: 낙관적 동시성 제어

#### 사용자 프레즌스
- **온라인 협업자 목록**: 현재 접속 중인 사용자 표시
- **실시간 커서**: 다른 사용자의 마우스 위치 표시
- **사용자별 색상**: 협업자마다 고유한 색상 할당

#### 협업 권한 관리
- **소유자 (Owner)**: 모든 권한
- **편집자 (Editor)**: 회로 편집 가능
- **뷰어 (Viewer)**: 읽기 전용

---

## 📦 구성 요소

### 1. 데이터베이스 스키마 (`database_schema.sql`)

#### 새로운 테이블
```sql
-- 프로젝트 확장 (공개/비공개, 통계)
ALTER TABLE projects 
ADD COLUMN is_public BOOLEAN,
ADD COLUMN views INTEGER,
ADD COLUMN likes INTEGER,
ADD COLUMN description TEXT,
ADD COLUMN tags TEXT[];

-- 좋아요
CREATE TABLE project_likes (...)

-- 포크 관계
CREATE TABLE project_forks (...)

-- 댓글
CREATE TABLE project_comments (...)

-- 조회수 추적
CREATE TABLE project_views (...)

-- 협업자
CREATE TABLE project_collaborators (...)

-- 실시간 프레즌스
CREATE TABLE collaboration_presence (...)

-- 변경 이력
CREATE TABLE collaboration_changes (...)
```

#### RLS (Row Level Security) 정책
- 공개 프로젝트는 모두 읽기 가능
- 비공개 프로젝트는 소유자만 접근
- 좋아요/댓글은 인증된 사용자만 가능
- 협업자는 권한에 따라 접근 제어

### 2. JavaScript 모듈

#### `LibraryManager.js` - 라이브러리 관리
```javascript
const library = new LibraryManager();

// 공개 프로젝트 목록
const projects = await library.getPublicProjects('trending');

// 프로젝트 공개
await library.makeProjectPublic(projectId, description, tags);

// 좋아요
await library.likeProject(projectId);

// 포크
const forked = await library.forkProject(projectId);

// 댓글
await library.addComment(projectId, '멋진 회로네요!');

// 검색
const results = await library.searchProjects('half adder');
```

#### `CollaborationManager.js` - 실시간 협업
```javascript
const collab = new CollaborationManager(simulator);

// 협업 시작
await collab.startCollaboration(projectId);

// 변경사항 브로드캐스트
collab.broadcastComponentAdded(component);
collab.broadcastComponentMoved(component);
collab.broadcastWireAdded(wire);

// 협업 종료
await collab.stopCollaboration();
```

---

## 🚀 사용 방법

### 프로젝트 공개하기

1. **시뮬레이터에서 회로 설계**
2. **프로젝트 저장**
3. **공개 설정 대화상자 열기**:
   - 설명 입력
   - 태그 선택 (예: #logic, #adder, #beginner)
   - 공개/비공개 토글
4. **커뮤니티 라이브러리에 표시**

### 다른 사용자 회로 포크하기

1. **라이브러리 페이지 방문**
2. **마음에 드는 회로 선택**
3. **"포크" 버튼 클릭**
4. **내 프로젝트에 복사됨**
5. **자유롭게 수정**

### 실시간 협업 시작하기

1. **프로젝트 열기**
2. **"협업 초대" 버튼 클릭**
3. **협업자 이메일 입력**
4. **권한 선택 (편집자/뷰어)**
5. **초대 전송**
6. **협업자가 접속하면 실시간 동기화**

---

## 🛠 기술 스택

### 백엔드 (Supabase)
- **PostgreSQL**: 데이터 저장
- **Realtime**: WebSocket 기반 실시간 통신
- **Row Level Security**: 세밀한 권한 제어
- **Triggers**: 자동 카운트 업데이트

### 프론트엔드
- **Supabase JS Client**: Supabase API 호출
- **Broadcast API**: 실시간 메시지 전송
- **Presence API**: 온라인 사용자 추적
- **Optimistic Updates**: 빠른 UI 반응

---

## 📊 데이터 흐름

### 라이브러리 공유
```
사용자 → 공개 설정 → Supabase DB → 라이브러리 페이지
         ↓
       좋아요/댓글 → Supabase DB → 실시간 업데이트
```

### 실시간 협업
```
사용자 A: 컴포넌트 추가 → Broadcast → 사용자 B, C
                                      ↓
                           자동으로 화면에 반영
```

---

## 🔒 보안 및 권한

### RLS 정책

#### 프로젝트
- ✅ 공개 프로젝트: 누구나 읽기
- ✅ 비공개 프로젝트: 소유자만 읽기/쓰기
- ✅ 협업자: 권한에 따라 읽기/쓰기

#### 좋아요/댓글
- ✅ 인증된 사용자만 작성 가능
- ✅ 본인이 작성한 것만 삭제 가능

#### 협업
- ✅ 프로젝트 소유자만 협업자 초대 가능
- ✅ 편집자 권한이 있어야 수정 가능

---

## 🎨 UI 컴포넌트 (구현 필요)

### 라이브러리 페이지
```html
<!-- library.html -->
<div class="library-container">
  <!-- 필터 -->
  <div class="library-filters">
    <button data-filter="trending">인기순</button>
    <button data-filter="latest">최신순</button>
    <button data-filter="most_liked">좋아요순</button>
  </div>

  <!-- 프로젝트 그리드 -->
  <div class="projects-grid">
    <!-- 프로젝트 카드들 -->
  </div>
</div>
```

### 협업 패널
```html
<!-- simulator.html 내부 -->
<div class="collaboration-panel">
  <div class="col lab-header">실시간 협업</div>
  
  <!-- 협업자 목록 -->
  <div id="collaborators-list"></div>
  
  <!-- 초대 버튼 -->
  <button onclick="inviteCollaborators()">
    협업자 초대
  </button>
</div>
```

### 공개 설정 모달
```html
<div class="publish-modal">
  <h2>프로젝트 공개</h2>
  
  <label>설명
    <textarea id="project-description"></textarea>
  </label>
  
  <label>태그
    <input type="text" id="project-tags" 
           placeholder="#logic #gates">
  </label>
  
  <label>
    <input type="checkbox" id="is-public">
    커뮤니티에 공개
  </label>
  
  <button onclick="publishProject()">저장</button>
</div>
```

---

## 📈 통계 및 분석

### 사용자 통계
```javascript
const stats = await library.getUserStats(userId);

console.log(stats);
// {
//   total_projects: 15,
//   total_public_projects: 8,
//   total_likes: 142,
//   total_views: 1523,
//   total_forks: 23
// }
```

### 프로젝트 통계
```javascript
const project = await sb
  .from('projects')
  .select('views, likes, forks')
  .eq('id', projectId)
  .single();

console.log(project.data);
// { views: 250, likes: 45, forks: 12 }
```

---

## 🔧 설정

### Supabase 설정

1. **데이터베이스 스키마 적용**
   ```bash
   # Supabase SQL Editor에서 실행
   ./database_schema.sql
   ```

2. **Realtime 활성화**
   - Supabase 대시보드 → Database → Replication
   - `projects`, `project_collaborators`, `collaboration_presence` 테이블 활성화

3. **환경 변수** (`.env` 또는 `SupabaseClient.js`)
   ```javascript
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_KEY = 'your-anon-key';
   ```

---

## 🐛 알려진 제한사항

### 현재 버전 (v1.0)
- [ ] UI 페이지 미완성 (library.html 구현 필요)
- [ ] 협업 패널 UI 미완성
- [ ] 프로젝트 썸네일 자동 생성 미구현
- [ ] 협업 초대 UI 미구현
- [ ] 충돌 해결 알고리즘 미구현

### 향후 개선 계획
- [ ] 버전 히스토리 (Git 스타일)
- [ ] 협업 중 실시간 채팅
- [ ] 음성/화면 공유
- [ ] AI 기반 회로 추천
- [ ] 프로젝트 템플릿
- [ ] 임베드 코드 생성

---

## 🧪 테스트

### 수동 테스트 체크리스트

#### 라이브러리 기능
- [ ] 프로젝트 공개/비공개 전환
- [ ] 좋아요 추가/취소
- [ ] 포크 생성
- [ ] 댓글 작성/삭제
- [ ] 검색 기능
- [ ] 태그 필터링

#### 협업 기능
- [ ] 여러 브라우저에서 동시 접속
- [ ] 실시간 커서 동기화
- [ ] 컴포넌트 추가 동기화
- [ ] 전선 연결 동기화
- [ ] 협업자 목록 표시
- [ ] 접속/종료 알림

---

## 📝 사용 예시

### 예시 1: 인기 회로 가져오기

```javascript
// LibraryManager 초기화
const library = new LibraryManager();

// 인기 프로젝트 10개 가져오기
const trending = await library.getPublicProjects('trending', 1);

// 첫 번째 프로젝트 정보
console.log(trending[0]);
// {
//   id: 'uuid...',
//   title: '4-bit ALU',
//   description: '간단한 4비트 산술 논리 장치',
//   likes: 145,
//   views: 892,
//   forks: 23,
//   tags: ['alu', 'logic', 'advanced']
// }
```

### 예시 2: 실시간 협업 시작

```javascript
// simulator.html에서
const sim = window.sim;
const collab = new CollaborationManager(sim);

// 프로젝트 ID로 협업 시작
await collab.startCollaboration('project-uuid-123');

// 컴포넌트 추가 시 자동 브로드캐스트
sim.addModule('AND', 100, 100);
// collab.broadcastComponentAdded() 자동 호출

// 협업 종료
await collab.stopCollaboration();
```

---

## 🤝 기여

이 기능은 아직 초기 단계입니다. 다음 작업이 필요합니다:

1. **UI 구현**: library.html, 협업 패널 디자인
2. **CSS 스타일**: library.css, collaboration.css
3. **테스트**: 실제 환경에서 다중 사용자 테스트
4. **문서화**: API 문서, 사용자 가이드
5. **최적화**: 성능 개선, 메모리 관리

---

## 📄 라이선스

MIT License

---

##🙏  크레딧

- **Supabase**: 실시간 데이터베이스 및 인증
- **PostgreSQL**: 데이터 저장
- **WebSocket**: 실시간 통신

---

**제작**: LoCAD Team  
**버전**: 1.0.0  
**최종 업데이트**: 2025-12-28 13:30
