---
description: Vercel 배포 및 Supabase 연동 상세 가이드 (회원가입 포함)
---

# Vercel 배포 및 Supabase 연동 상세 가이드

이 문서는 웹사이트 배포 경험이 전혀 없는 분들을 위해, 회원가입부터 배포까지 모든 과정을 아주 자세하게 설명합니다.

1단계: 준비하기

가장 먼저 이메일 주소 하나가 필요합니다. 그리고 소스 코드를 저장할 GitHub(깃허브) 계정이 있으면 매우 편리합니다. GitHub 계정이 없다면 먼저 만드시는 것을 추천합니다.

1-1. GitHub 회원가입 (소스 코드 저장소)
1. github.com 에 접속합니다.
2. 오른쪽 상단의 Sign up 버튼을 클릭합니다.
3. 이메일 주소를 입력하고 Continue를 누릅니다.
4. 비밀번호를 설정하고 Continue를 누릅니다.
5. 닉네임(Username)을 입력하고 Continue를 누릅니다.
6. 이메일 수신 여부는 n을 입력하고 Continue를 누릅니다.
7. 로봇이 아님을 증명하는 퍼즐을 풉니다.
8. 입력한 이메일로 온 인증 코드를 입력하면 가입이 완료됩니다.

1-2. GitHub에 내 프로젝트 올리기
1. 컴퓨터에 Git이 설치되어 있어야 합니다. (없다면 git-scm.com 에서 다운로드 및 설치)
2. 만드는 중인 프로젝트 폴더(LogicProject2)를 VS Code로 엽니다.
3. VS Code 왼쪽 메뉴 중 세 번째 아이콘(소스 제어)을 클릭합니다.
4. GitHub에 게시(Publish to GitHub) 버튼을 클릭합니다.
5. GitHub 로그인 창이 뜨면 승인합니다.
6. 공개(Public) 저장소로 게시할지 비공개(Private)로 할지 선택합니다. (보통 Public 선택)
7. 업로드가 완료될 때까지 기다립니다.

2단계: Supabase 회원가입 및 데이터베이스 만들기

Supabase는 사용자의 로그인 정보나 회로 저장 데이터를 보관하는 데이터베이스 역할을 합니다.

2-1. Supabase 회원가입
1. supabase.com 에 접속합니다.
2. 오른쪽 상단의 Start your project 버튼이나 Sign in 버튼을 클릭합니다.
3. 로그인 화면이 나오면 Continue with GitHub 버튼을 클릭합니다. (GitHub 아이디로 가입하는 것이 가장 편합니다)
4. GitHub 승인 창이 뜨면 Authorize supabase 버튼(녹색)을 클릭합니다.
5. 가입이 완료되었습니다.

2-2. 새 프로젝트 만들기
1. 대시보드 화면에서 New Project 버튼을 클릭합니다.
2. Organization 선택 화면이 나오면 본인 아이디를 선택합니다.
3. 프로젝트 설정 화면이 나옵니다.
   - Name: 프로젝트 이름을 짓습니다. 예: logic-simulator
   - Database Password: 강력한 비밀번호를 입력하거나 Generate a password를 눌러 생성 후 복사해서 메모장에 저장해둡니다.
   - Region: 사용자와 가장 가까운 지역을 선택합니다. 한국이라면 Seoul을 선택합니다.
4. Create new project 버튼을 클릭합니다.
5. 프로젝트가 생성되는 동안 약 1~2분 정도 기다립니다.

2-3. 테이블(데이터 저장소) 만들기
1. 왼쪽 메뉴 아이콘 중 위에서 두 번째에 있는 Table Editor(표 모양 아이콘)를 클릭합니다.
2. Create a new table 버튼을 클릭합니다.
3. 새 테이블 설정 창이 나옵니다.
   - Name: projects 라고 입력합니다. (저장된 회로 프로젝트라는 뜻)
   - Description: 비워도 됩니다.
4. Columns(열) 부분에 다음 항목들을 추가합니다.
   - id: 그대로 둡니다 (uuid).
   - created_at: 그대로 둡니다.
   - Add column을 눌러 새 줄을 추가합니다.
     - Name: user_id
     - Type: uuid
   - Add column을 다시 누릅니다.
     - Name: title
     - Type: text
   - Add column을 다시 누릅니다.
     - Name: data
     - Type: jsonb
5. Save 버튼을 눌러 저장합니다.

2-4. 연동 키 확인하기 (중요)
1. 왼쪽 메뉴 맨 아래의 Project Settings(톱니바퀴 아이콘)를 클릭합니다.
2. 메뉴 목록 중 API를 클릭합니다.
3. 화면에 나오는 Project URL 값을 복사해서 메모장에 붙여넣습니다.
4. 그 아래 Project API keys 부분에서 anon public이라고 된 키 값을 복사해서 메모장에 붙여넣습니다. (service_role 키는 절대 남에게 보여주면 안 됩니다)

3단계: Vercel 회원가입 및 웹사이트 배포하기

Vercel은 우리가 만든 HTML 파일들을 인터넷 주소로 접속할 수 있게 해주는 배포 서비스입니다.

3-1. Vercel 회원가입
1. vercel.com 에 접속합니다.
2. 오른쪽 상단의 Sign Up 버튼을 클릭합니다.
3. Hobby(개인용)를 선택합니다.
4. Your Name을 입력합니다.
5. Continue with GitHub 버튼을 클릭합니다.
6. GitHub 승인 창이 뜨면 Authorize Vercel 버튼을 클릭합니다.
7. 휴대폰 인증이 필요할 수 있습니다. 국가를 Korea로 선택하고 핸드폰 번호를 입력하여 인증합니다.

3-2. 프로젝트 불러오기 및 배포
1. Vercel 대시보드에서 Add New... 버튼을 누르고 Project를 선택합니다.
2. Import Git Repository 목록에 방금 GitHub에 올린 LogicProject2가 보일 것입니다. Import 버튼을 누릅니다.
3. 설정 화면(Configure Project)이 나옵니다.
   - Project Name: 원하는 이름으로 수정하거나 그대로 둡니다.
   - Framework Preset: Other를 선택합니다. (혹은 자동으로 인식하면 그대로 둡니다)
   - Root Directory: ./ (그대로 둡니다)
4. Deploy 버튼을 클릭합니다.
5. 약 1분 정도 기다리면 화면에 폭죽이 터지며 배포가 완료됩니다.
6. 화면에 생성된 도메인 주소(예: logic-simulator.vercel.app)를 클릭하면 내 웹사이트에 접속할 수 있습니다.

4단계: 웹사이트와 데이터베이스 연결하기 (코딩)

이제 배포는 되었지만, 로그인하고 저장하는 기능은 코드에 직접 넣어줘야 합니다.

4-1. 라이브러리 추가
작업 중인 index.html 파일의 head 태그 안에 다음 줄을 추가합니다.
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

4-2. 자바스크립트 연결 코드
js 폴더 안에 SupabaseClient.js 라는 파일을 새로 만들고, 아까 메모장에 적어둔 URL과 키를 사용하여 아래 내용을 붙여넣으세요.

const SUPABASE_URL = '아까_복사한_Project_URL_붙여넣기';
const SUPABASE_KEY = '아까_복사한_anon_public_키_붙여넣기';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 로그인 함수 예시 (구글 로그인)
async function login() {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
}

// 저장 함수 예시
async function saveString(text) {
    // 현재 로그인한 유저 확인
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        await supabase
            .from('projects')
            .insert({ 
                user_id: user.id, 
                title: '내 프로젝트', 
                data: { content: text } 
            });
        alert('저장되었습니다!');
    } else {
        alert('먼저 로그인해주세요.');
    }
}

5단계: 마무리

코드를 수정했다면 다시 GitHub에 올리세요(Push).
Vercel은 GitHub의 변경 사항을 감지하여 자동으로 새 버전을 배포합니다.
이제 인터넷 주소만 알면 누구나 당신이 만든 논리 회로 시뮬레이터를 사용할 수 있습니다.
