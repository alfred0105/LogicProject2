/**
 * 🚀 LoCAD - Dashboard Entry Point (Vite ESM)
 * Loads only necessary modules for the dashboard/landing page
 */

import './modules/Security.js';
import './modules/Constants.js';
import './modules/SupabaseClient.js';
import './modules/LibraryManager.js';
import './modules/PostManager.js';
import './modules/CloudManager.js'; // 로그인 상태 체크용

console.log('📦 LoCAD Dashboard modules loaded via Vite ESM');

document.addEventListener('DOMContentLoaded', () => {
    // 라이브러리 매니저 초기화
    if (typeof LibraryManager !== 'undefined') {
        window.library = new LibraryManager();

        // 홈 화면이면 트렌딩 프로젝트 로드
        if (document.getElementById('trending-grid')) {
            window.library.loadTrendingProjects();
        }
        if (document.getElementById('latest-grid')) {
            window.library.loadLatestProjects();
        }
    }

    // 게시물 매니저 초기화
    if (typeof PostManager !== 'undefined') {
        window.postManager = new PostManager();

        // 커뮤니티 섹션이면 게시물 로드
        if (document.getElementById('posts-list')) {
            window.postManager.loadPosts();
        }
    }
});
