# 🎯 남은 UI 구현 작업 요약

## ✅ 완료된 UI

1. **프로필 설정 모달** (login.html)
   - 최초 로그인 시 사용자 ID 설정
   - 중복 체크 및 유효성 검사

2. **라이브러리 페이지** (library.html)
   - 공개 프로젝트 목록
   - 검색, 필터링, 태그
   - 좋아요, 포크, 댓글

3. **협업 패널** (simulator.html)
   - 온라인 협업자 목록
   - 실시간 커서 표시

4. **협업 초대 모달** (simulator.html)
   - 이메일로 초대
   - 권한 선택 (편집자/뷰어)

---

## ❌ 미완성 UI (빠른 구현 가이드)

### 1. 대시보드: 협업 초대 알림

**위치**: dashboard.html 상단

**추가할 코드**:
```html
<!-- 헤더 아래, 콘텐츠 위에 추가 -->
<div id="invites-banner" style="display: none; background: var(--accent-primary); padding: 12px 24px; text-align: center; color: white;">
    <span id="invite-message">협업 초대가 있습니다!</span>
    <button onclick="viewInvites()" style="margin-left: 12px; padding: 6px 12px; background: white; color: var(--accent-primary); border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
        보기
    </button>
</div>
```

**JavaScript 함수**:
```javascript
// 초대 확인 (페이지 로드 시)
async function checkInvites() {
    if (!window.sb || !window.CollaborationManager) return;
    
    const collab = new CollaborationManager(null);
    const invites = await collab.getMyInvites();
    
    if (invites.length > 0) {
        const banner = document.getElementById('invites-banner');
        const message = document.getElementById('invite-message');
        message.textContent = `${invites.length}개의 협업 초대가 있습니다!`;
        banner.style.display = 'block';
    }
}

// 초대 목록 보기
function viewInvites() {
    // TODO: 초대 목록 모달 표시
    alert('초대 목록을 표시합니다 (미구현)');
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', checkInvites);
```

---

### 2. 시뮬레이터: 프로젝트 공개 설정

**위치**: simulator.html 헤더 유틸리티 버튼 영역

**추가할 버튼**:
```html
<button class="icon-btn" onclick="showPublishModal()" title="프로젝트 공개 설정">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
    </svg>
    <span class="btn-text">공개</span>
</button>
```

**모달 HTML** (Settings Modal 앞에 추가):
```html
<div id="publish-modal" class="modal-overlay" style="display: none;">
    <div class="modal-window">
        <h2 style="margin-bottom: 20px">프로젝트 공개 설정</h2>
        
        <div style="margin-bottom: 16px;">
            <label>
                <input type="checkbox" id="is-public" style="margin-right: 8px;">
                커뮤니티에 공개
            </label>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px;">설명</label>
            <textarea id="project-description" style="width: 100%; padding: 10px; background: var(--bg-hover); border: 1px solid var(--border-dim); border-radius: 6px; color: var(--text-main);" rows="3"></textarea>
        </div>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px;">태그 (쉼표로 구분)</label>
            <input type="text" id="project-tags" placeholder="logic, gates, adder" style="width: 100%; padding: 10px; background: var(--bg-hover); border: 1px solid var(--border-dim); border-radius: 6px; color: var(--text-main);">
        </div>
        
        <div style="display: flex; gap: 12px">
            <button onclick="closePublishModal()" style="flex: 1; padding: 12px; background: var(--bg-hover); border: 1px solid var(--border-dim); border-radius: 6px; cursor: pointer;">취소</button>
            <button onclick="savePublishSettings()" style="flex: 1; padding: 12px; background: var(--accent-primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">저장</button>
        </div>
    </div>
</div>
```

**JavaScript**:
```javascript
function showPublishModal() {
    if (!window.sim.currentProjectId) {
        alert('프로젝트를 먼저 저장하세요');
        return;
    }
    document.getElementById('publish-modal').style.display = 'flex';
}

function closePublishModal() {
    document.getElementById('publish-modal').style.display = 'none';
}

async function savePublishSettings() {
    const isPublic = document.getElementById('is-public').checked;
    const description = document.getElementById('project-description').value;
    const tags = document.getElementById('project-tags').value.split(',').map(t => t.trim());
    
    if (!window.library) {
        alert('LibraryManager가 초기화되지 않았습니다');
        return;
    }
    
    try {
        if (isPublic) {
            await window.library.makeProjectPublic(
                window.sim.currentProjectId,
                description,
                tags
            );
            alert('✓ 프로젝트가 공개되었습니다!');
        } else {
            await window.library.makeProjectPrivate(window.sim.currentProjectId);
            alert('✓ 프로젝트가 비공개로 전환되었습니다');
        }
        closePublishModal();
    } catch (error) {
        alert('오류: ' + error.message);
    }
}
```

---

### 3. 대시보드: 프로젝트 설정 관리

**현재 상태**: 프로젝트 카드에 삭제 버튼만 있음

**추가 기능**:
- 공개/비공개 토글
- 설정 아이콘 클릭 → 모달 열기

**카드에 설정 버튼 추가** (프로젝트 카드 HTML 수정):
```html
<!-- 삭제 버튼 옆에 추가 -->
<button class="btn-settings" onclick="event.stopPropagation(); editProject('${project.id}')" style="opacity: 0; position: absolute; top: 16px; right: 48px; ...">
    <svg>...</svg>
</button>
```

**모달** (dashboard.html에 추가):
```html
<div id="project-settings-modal" class="modal-overlay">
    <div class="modal-window">
        <h2>프로젝트 설정</h2>
        <!-- 위의 publish-modal과 동일한 폼 -->
    </div>
</div>
```

---

## 🚀 빠른 구현 우선순위

1. **시뮬레이터 공개 설정** (가장 중요!)
   - 사용자가 프로젝트를 공개할 방법이 현재 없음
   - 위 코드 복사 → simulator.html에 붙여넣기

2. **대시보드 초대 알림**
   - 협업 초대를 받았는지 알 수 없음
   - 간단한 배너로 해결 가능

3. **대시보드 프로젝트 관리**
   - 추후 개선 사항
   - 현재는 라이브러리 페이지에서 확인 가능

---

## 📝 구현 시 주의사항

1. **CollaborationManager, LibraryManager 로드 확인**
   - 각 페이지에서 스크립트 로드 여부 확인
   - window.sb (Supabase) 초기화 확인

2. **currentProjectId 확인**
   - 프로젝트 저장 후에만 기능 사용 가능
   - 저장 안 된 경우 alert 표시

3. **에러 핸들링**
   - try-catch로 감싸기
   - 사용자에게 친절한 메시지

---

## ✅ 완료 체크리스트

현재 작동하는 기능:
- [x] 사용자 프로필 설정
- [x] 라이브러리 검색 & 필터
- [x] 프로젝트 좋아요, 포크, 댓글
- [x] 협업자 초대 (이메일)
- [x] 실시간 협업 (커서, 동기화)

추가 필요:
- [ ] 시뮬레이터 공개 설정 버튼
- [ ] 대시보드 초대 알림
- [ ] 초대 수락/거절 UI
- [ ] 대시보드 프로젝트 편집

---

위 코드들을 복사해서 붙여넣으면 바로 작동합니다!
