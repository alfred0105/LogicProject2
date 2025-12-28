/**
 * CollaborationManager.js
 * 실시간 협업 기능 관리 (Supabase Realtime)
 */

class CollaborationManager {
    constructor(simulator) {
        this.sim = simulator;
        this.channel = null;
        this.projectId = null;
        this.currentUser = null;
        this.collaborators = new Map(); // userId -> {name, email, cursor, color}
        this.colors = [
            '#ef4444', '#f59e0b', '#10b981', '#3b82f6',
            '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
        ];
        this.userColor = null;
        this.isConnected = false;
        this.cursorUpdateInterval = null;
    }

    /**
     * 협업 세션 시작
     */
    async startCollaboration(projectId) {
        if (!window.sb) {
            console.warn('Supabase not initialized');
            return;
        }

        this.projectId = projectId;

        // 현재 사용자 정보
        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) {
            throw new Error('로그인이 필요합니다');
        }

        // 협업 권한 체크
        const hasPermission = await this.checkCollaborationPermission(projectId, user.id);
        if (!hasPermission) {
            throw new Error('이 프로젝트에 대한 협업 권한이 없습니다. 프로젝트 소유자에게 초대를 요청하세요.');
        }

        // 사용자 프로필 가져오기
        const { data: profile } = await window.sb
            .from('user_profiles')
            .select('username, display_name')
            .eq('id', user.id)
            .single();

        this.currentUser = {
            id: user.id,
            email: user.email,
            name: profile?.display_name || profile?.username || user.email.split('@')[0]
        };

        // 사용자 색상 할당
        this.userColor = this.colors[Math.floor(Math.random() * this.colors.length)];

        // Realtime 채널 구독
        this.channel = window.sb.channel(`project:${projectId}`);

        // 다른 사용자의 커서 위치 수신
        this.channel.on('broadcast', { event: 'cursor' }, ({ payload }) => {
            this.updateRemoteCursor(payload);
        });

        // 컴포넌트 추가 수신
        this.channel.on('broadcast', { event: 'component_added' }, ({ payload }) => {
            this.handleRemoteComponentAdded(payload);
        });

        // 컴포넌트 이동 수신
        this.channel.on('broadcast', { event: 'component_moved' }, ({ payload }) => {
            this.handleRemoteComponentMoved(payload);
        });

        // 컴포넌트 삭제 수신
        this.channel.on('broadcast', { event: 'component_deleted' }, ({ payload }) => {
            this.handleRemoteComponentDeleted(payload);
        });

        // 전선 추가 수신
        this.channel.on('broadcast', { event: 'wire_added' }, ({ payload }) => {
            this.handleRemoteWireAdded(payload);
        });

        // 전선 삭제 수신
        this.channel.on('broadcast', { event: 'wire_deleted' }, ({ payload }) => {
            this.handleRemoteWireDeleted(payload);
        });

        // 프레즌스 추적
        this.channel.on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            this.updateCollaboratorsList(state);
        });

        this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            this.showNotification(`${newPresences[0].name} joined the session`);
        });

        this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            this.showNotification(`${leftPresences[0].name} left the session`);
            this.removeCollaboratorCursor(key);
        });

        // 구독 시작
        await this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                this.isConnected = true;

                // 자신의 프레즌스 전송
                await this.channel.track({
                    user_id: this.currentUser.id,
                    name: this.currentUser.name,
                    email: this.currentUser.email,
                    color: this.userColor,
                    online_at: new Date().toISOString()
                });

                // 커서 업데이트 시작
                this.startCursorTracking();

                this.showNotification('✓ 실시간 협업 모드 활성화');
            }
        });
    }

    /**
     * 협업 세션 종료
     */
    async stopCollaboration() {
        if (this.channel) {
            await this.channel.unsubscribe();
            this.channel = null;
        }

        this.stopCursorTracking();
        this.clearAllRemoteCursors();
        this.isConnected = false;
    }

    /**
     * 커서 추적 시작
     */
    startCursorTracking() {
        const workspace = document.getElementById('workspace');
        if (!workspace) return;

        let lastX = 0, lastY = 0;

        workspace.addEventListener('mousemove', (e) => {
            lastX = e.clientX;
            lastY = e.clientY;
        });

        // 100ms마다 커서 위치 브로드캐스트
        this.cursorUpdateInterval = setInterval(() => {
            if (this.channel && this.isConnected) {
                this.channel.send({
                    type: 'broadcast',
                    event: 'cursor',
                    payload: {
                        user_id: this.currentUser.id,
                        name: this.currentUser.name,
                        color: this.userColor,
                        x: lastX,
                        y: lastY
                    }
                });
            }
        }, 100);
    }

    /**
     * 커서 추적 중지
     */
    stopCursorTracking() {
        if (this.cursorUpdateInterval) {
            clearInterval(this.cursorUpdateInterval);
            this.cursorUpdateInterval = null;
        }
    }

    /**
     * 원격 커서 업데이트
     */
    updateRemoteCursor(payload) {
        if (payload.user_id === this.currentUser.id) return;

        let cursorEl = document.getElementById(`cursor-${payload.user_id}`);

        if (!cursorEl) {
            cursorEl = document.createElement('div');
            cursorEl.id = `cursor-${payload.user_id}`;
            cursorEl.className = 'remote-cursor';
            cursorEl.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="${payload.color}">
                    <path d="M3 3 L10 20 L12 13 L19 11 Z" />
                </svg>
                <span class="cursor-label">${payload.name}</span>
            `;
            document.body.appendChild(cursorEl);
        }

        cursorEl.style.left = payload.x + 'px';
        cursorEl.style.top = payload.y + 'px';
    }

    /**
     * 협업자 목록 업데이트
     */
    updateCollaboratorsList(presenceState) {
        this.collaborators.clear();

        for (const userId in presenceState) {
            const presence = presenceState[userId][0];
            if (presence.user_id !== this.currentUser.id) {
                this.collaborators.set(presence.user_id, {
                    name: presence.name,
                    email: presence.email,
                    color: presence.color
                });
            }
        }

        this.renderCollaboratorsList();
    }

    /**
     * 협업자 목록 UI 렌더링
     */
    renderCollaboratorsList() {
        const container = document.getElementById('collaborators-list');
        if (!container) return;

        if (this.collaborators.size === 0) {
            container.innerHTML = '<div class="no-collaborators">혼자 작업 중입니다</div>';
            return;
        }

        let html = '<div class="collaborators-header">함께 작업 중 (' + this.collaborators.size + ')</div>';

        this.collaborators.forEach((collab, userId) => {
            html += `
                <div class="collaborator-item">
                    <div class="collab-avatar" style="background: ${collab.color}">
                        ${collab.name.charAt(0).toUpperCase()}
                    </div>
                    <div class="collab-info">
                        <div class="collab-name">${collab.name}</div>
                        <div class="collab-status">온라인</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 컴포넌트 추가 브로드캐스트
     */
    broadcastComponentAdded(component) {
        if (!this.channel || !this.isConnected) return;

        const data = {
            id: component.id,
            type: component.getAttribute('data-type'),
            x: parseFloat(component.style.left),
            y: parseFloat(component.style.top),
            user_id: this.currentUser.id
        };

        this.channel.send({
            type: 'broadcast',
            event: 'component_added',
            payload: data
        });
    }

    /**
     * 컴포넌트 이동 브로드캐스트
     */
    broadcastComponentMoved(component) {
        if (!this.channel || !this.isConnected) return;

        const data = {
            id: component.id,
            x: parseFloat(component.style.left),
            y: parseFloat(component.style.top),
            user_id: this.currentUser.id
        };

        this.channel.send({
            type: 'broadcast',
            event: 'component_moved',
            payload: data
        });
    }

    /**
     * 컴포넌트 삭제 브로드캐스트
     */
    broadcastComponentDeleted(componentId) {
        if (!this.channel || !this.isConnected) return;

        this.channel.send({
            type: 'broadcast',
            event: 'component_deleted',
            payload: {
                id: componentId,
                user_id: this.currentUser.id
            }
        });
    }

    /**
     * 전선 추가 브로드캐스트
     */
    broadcastWireAdded(wire) {
        if (!this.channel || !this.isConnected) return;

        const fromComp = wire.from.closest('.component');
        const toComp = wire.to.closest('.component');

        if (!fromComp || !toComp) return;

        this.channel.send({
            type: 'broadcast',
            event: 'wire_added',
            payload: {
                fromCompId: fromComp.id,
                fromPinClass: wire.from.classList[1],
                toCompId: toComp.id,
                toPinClass: wire.to.classList[1],
                user_id: this.currentUser.id
            }
        });
    }

    /**
     * 전선 삭제 브로드캐스트
     */
    broadcastWireDeleted(wire) {
        if (!this.channel || !this.isConnected) return;

        const fromComp = wire.from.closest('.component');
        const toComp = wire.to.closest('.component');

        if (!fromComp || !toComp) return;

        this.channel.send({
            type: 'broadcast',
            event: 'wire_deleted',
            payload: {
                fromCompId: fromComp.id,
                fromPinClass: wire.from.classList[1],
                toCompId: toComp.id,
                toPinClass: wire.to.classList[1],
                user_id: this.currentUser.id
            }
        });
    }

    /**
     * 원격 컴포넌트 추가 처리
     */
    handleRemoteComponentAdded(payload) {
        if (payload.user_id === this.currentUser.id) return;

        // 이미 존재하는지 확인
        const existing = this.sim.components.find(c => c.id === payload.id);
        if (existing) return;

        // 컴포넌트 추가
        this.sim.addModule(payload.type, payload.x, payload.y);

        const newComp = this.sim.components[this.sim.components.length - 1];
        if (newComp) {
            newComp.id = payload.id;

            // 잠깐 하이라이트
            this.highlightRemoteChange(newComp);
        }
    }

    /**
     * 원격 컴포넌트 이동 처리
     */
    handleRemoteComponentMoved(payload) {
        if (payload.user_id === this.currentUser.id) return;

        const comp = this.sim.components.find(c => c.id === payload.id);
        if (!comp) return;

        comp.style.left = payload.x + 'px';
        comp.style.top = payload.y + 'px';

        // 전선 업데이트
        if (this.sim.updateWirePositions) {
            this.sim.updateWirePositions();
        }
    }

    /**
     * 원격 컴포넌트 삭제 처리
     */
    handleRemoteComponentDeleted(payload) {
        if (payload.user_id === this.currentUser.id) return;

        const comp = this.sim.components.find(c => c.id === payload.id);
        if (!comp) return;

        // 연결된 전선 제거
        const connectedWires = this.sim.wires.filter(w =>
            w.from.closest('.component') === comp ||
            w.to.closest('.component') === comp
        );

        connectedWires.forEach(wire => {
            wire.line.remove();
        });

        this.sim.wires = this.sim.wires.filter(w => !connectedWires.includes(w));

        // 컴포넌트 제거
        comp.remove();
        this.sim.components = this.sim.components.filter(c => c !== comp);
    }

    /**
     * 원격 전선 추가 처리
     */
    handleRemoteWireAdded(payload) {
        if (payload.user_id === this.currentUser.id) return;

        const fromComp = this.sim.components.find(c => c.id === payload.fromCompId);
        const toComp = this.sim.components.find(c => c.id === payload.toCompId);

        if (!fromComp || !toComp) return;

        const fromPin = fromComp.querySelector(`.${payload.fromPinClass}`);
        const toPin = toComp.querySelector(`.${payload.toPinClass}`);

        if (!fromPin || !toPin) return;

        // 이미 연결되어 있는지 확인
        const existing = this.sim.wires.find(w =>
            w.from === fromPin && w.to === toPin
        );

        if (!existing) {
            this.sim.createWire(fromPin, toPin);
        }
    }

    /**
     * 원격 전선 삭제 처리
     */
    handleRemoteWireDeleted(payload) {
        if (payload.user_id === this.currentUser.id) return;

        const fromComp = this.sim.components.find(c => c.id === payload.fromCompId);
        const toComp = this.sim.components.find(c => c.id === payload.toCompId);

        if (!fromComp || !toComp) return;

        const fromPin = fromComp.querySelector(`.${payload.fromPinClass}`);
        const toPin = toComp.querySelector(`.${payload.toPinClass}`);

        if (!fromPin || !toPin) return;

        const wire = this.sim.wires.find(w =>
            w.from === fromPin && w.to === toPin
        );

        if (wire) {
            wire.line.remove();
            this.sim.wires = this.sim.wires.filter(w => w !== wire);
        }
    }

    /**
     * 원격 변경사항 하이라이트
     */
    highlightRemoteChange(element) {
        element.classList.add('remote-change');
        setTimeout(() => {
            element.classList.remove('remote-change');
        }, 1000);
    }

    /**
     * 협업자 커서 제거
     */
    removeCollaboratorCursor(userId) {
        const cursorEl = document.getElementById(`cursor-${userId}`);
        if (cursorEl) {
            cursorEl.remove();
        }
    }

    /**
     * 모든 원격 커서 제거
     */
    clearAllRemoteCursors() {
        const cursors = document.querySelectorAll('.remote-cursor');
        cursors.forEach(cursor => cursor.remove());
    }

    /**
     * 알림 표시
     */
    showNotification(message) {
        // 기존 토스트 시스템 사용
        if (this.sim && this.sim.showToast) {
            this.sim.showToast(message, 'info');
        } else {
            console.log('[Collaboration]', message);
        }
    }

    /**
     * 협업 권한 체크
     */
    async checkCollaborationPermission(projectId, userId) {
        if (!window.sb) return false;

        try {
            // RPC 함수 호출
            const { data, error } = await window.sb
                .rpc('can_collaborate_on_project', {
                    target_project_id: projectId,
                    target_user_id: userId
                });

            if (error) {
                console.error('Permission check error:', error);
                return false;
            }

            return data === true;
        } catch (error) {
            console.error('Permission check failed:', error);
            return false;
        }
    }

    /**
     * 사용자 초대
     */
    async inviteCollaborator(projectId, email, role = 'editor') {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // 프로젝트 소유자인지 확인
        const { data: project } = await window.sb
            .from('projects')
            .select('user_id')
            .eq('id', projectId)
            .single();

        if (!project || project.user_id !== user.id) {
            throw new Error('프로젝트 소유자만 협업자를 초대할 수 있습니다');
        }

        // 초대 생성
        const { data, error } = await window.sb
            .from('collaboration_invites')
            .insert({
                project_id: projectId,
                inviter_id: user.id,
                invitee_email: email,
                role: role,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                throw new Error('이미 초대된 사용자입니다');
            }
            throw error;
        }

        return data;
    }

    /**
     * 내 초대 목록 가져오기
     */
    async getMyInvites() {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { data: { user } } = await window.sb.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await window.sb
            .from('collaboration_invites')
            .select(`
                *,
                projects (
                    id,
                    title
                )
            `)
            .eq('invitee_email', user.email)
            .eq('status', 'pending')
            .order('invited_at', { ascending: false });

        if (error) throw error;

        return data || [];
    }

    /**
     * 초대 수락
     */
    async acceptInvite(inviteId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { error } = await window.sb
            .rpc('accept_collaboration_invite', { invite_id: inviteId });

        if (error) throw error;
    }

    /**
     * 초대 거절
     */
    async rejectInvite(inviteId) {
        if (!window.sb) throw new Error('Supabase not initialized');

        const { error } = await window.sb
            .rpc('reject_collaboration_invite', { invite_id: inviteId });

        if (error) throw error;
    }
}

// 전역 등록
window.CollaborationManager = CollaborationManager;
