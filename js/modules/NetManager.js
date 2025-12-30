/**
 * 모듈: 넷(Net) 관리자 - Netlist System Core
 * 회로의 전기적 연결(Net)을 관리하며, 시뮬레이션의 기반이 되는 데이터 구조를 제공합니다.
 * 
 * - Net: 전기적으로 연결된 핀(Pin)과 전선(Wire)의 집합
 * - 기능: Net 생성, 병합(Merge), 분할(Split), 상태 관리
 */

class Net {
    constructor(id) {
        this.id = id;
        this.pins = new Set();  // 연결된 모든 핀 요소
        this.wires = new Set(); // 연결된 모든 전선 객체
        this.state = 0;         // 0 (Low), 1 (High), -1 (Floating/High-Z), 2 (Error/Contention)
        this.lastUpdate = 0;    // 시뮬레이션 틱
    }
}

class NetManager {
    constructor(sim) {
        this.sim = sim;
        this.nets = new Map();       // NetId -> Net 객체
        this.pinToNet = new Map();   // Pin Element -> NetId
        this.wireToNet = new Map();  // Wire Object -> NetId
        this.nextNetId = 1;
    }

    /**
     * 새로운 Net 생성
     */
    createNet() {
        const id = this.nextNetId++;
        const net = new Net(id);
        this.nets.set(id, net);
        return net;
    }

    /**
     * 핀이 속한 Net을 반환 (없으면 생성)
     */
    getNetOfPin(pin) {
        if (!this.pinToNet.has(pin)) {
            const newNet = this.createNet();
            this.addPinToNet(newNet, pin);
            return newNet;
        }
        return this.nets.get(this.pinToNet.get(pin));
    }

    /**
     * 핀을 Net에 추가
     */
    addPinToNet(net, pin) {
        if (!net || !pin) return;

        // 이미 다른 Net에 있었다면 제거? (일반적으로는 Merge로 처리됨)
        const oldNetId = this.pinToNet.get(pin);
        if (oldNetId && oldNetId !== net.id) {
            this.removePinFromNet(this.nets.get(oldNetId), pin);
        }

        net.pins.add(pin);
        this.pinToNet.set(pin, net.id);

        // 시각적 디버깅 (속성 추가)
        pin.setAttribute('data-net-id', net.id);
    }

    removePinFromNet(net, pin) {
        if (!net || !pin) return;
        net.pins.delete(pin);
        this.pinToNet.delete(pin);
        pin.removeAttribute('data-net-id');

        // 빈 Net 정리
        if (net.pins.size === 0 && net.wires.size === 0) {
            this.nets.delete(net.id);
        }
    }

    /**
     * 전선(Wire)이 추가될 때 호출
     * 두 핀의 Net을 병합(Merge)함
     */
    onWireCreated(wire) {
        if (!wire.from || !wire.to) return;

        const netA = this.getNetOfPin(wire.from);
        const netB = this.getNetOfPin(wire.to);

        this.wireToNet.set(wire, netA.id); // 일단 netA로 설정 (나중에 merge되면 바뀜)

        if (netA === netB) {
            // 이미 같은 Net (가장 단순한 경우, 루프 형성 등)
            netA.wires.add(wire);
            this.wireToNet.set(wire, netA.id);
            return;
        }

        // 다른 Net이면 병합 (Merge)
        this.mergeNets(netA, netB, wire);
    }

    /**
     * 두 Net을 하나로 병합 (Merge)
     * 보통 더 큰 Net이나 오래된 Net으로 합침
     */
    mergeNets(net1, net2, connectingWire) {
        // net1을 메인(Survivor)으로 결정
        const survivor = net1;
        const victim = net2;

        // Victim의 핀들을 Survivor로 이동
        for (const pin of victim.pins) {
            survivor.pins.add(pin);
            this.pinToNet.set(pin, survivor.id);
            pin.setAttribute('data-net-id', survivor.id);
        }

        // Victim의 전선들을 Survivor로 이동
        for (const w of victim.wires) {
            survivor.wires.add(w);
            this.wireToNet.set(w, survivor.id);
        }

        // 연결 전선 추가
        survivor.wires.add(connectingWire);
        this.wireToNet.set(connectingWire, survivor.id);

        // Victim 삭제
        this.nets.delete(victim.id);

        // 시뮬레이션 상태 갱신 필요 알림
        // this.sim.logicEngine.markNetSort(); (나중에 구현)
    }

    /**
     * 전선이 제거될 때 호출
     * Net이 분리(Split)되는지 확인하고 처리
     */
    onWireRemoved(wire) {
        const netId = this.wireToNet.get(wire);
        if (!netId) return;

        const net = this.nets.get(netId);
        if (!net) return;

        net.wires.delete(wire);
        this.wireToNet.delete(wire);

        // Net이 분리되었는지 확인 (Graph Traversal - BFS)
        this.recalculateNet(net);
    }

    /**
     * Net 재계산 (분리 감지)
     * BFS를 사용하여 연결된 요소들을 탐색하고, 분리된 그룹을 새 Net으로 만듦
     */
    recalculateNet(originalNet) {
        // 모든 핀과 전선을 임시 리스트로 확보
        const allPins = Array.from(originalNet.pins);
        const allWires = Array.from(originalNet.wires);

        if (allPins.length === 0) {
            this.nets.delete(originalNet.id);
            return;
        }

        // 기존 Net 초기화 (모두 제거 후 다시 그룹핑)
        // 성능 최적화를 위해: 
        // 1. 임의의 핀 하나를 잡고 BFS를 돌려서 도달 가능한 모든 핀/전선을 찾음.
        // 2. 도달한 핀 개수가 전체 핀 개수와 같으면 -> 분리되지 않음. 끝.
        // 3. 적으면 -> 분리됨. 찾은 그룹은 원래 Net 유지, 나머지는 새로운 Net으로 분리(재귀).

        const visitedPins = new Set();
        const visitedWires = new Set();
        const startPin = allPins[0];

        const queue = [startPin];
        visitedPins.add(startPin);

        while (queue.length > 0) {
            const currentPin = queue.shift();

            // 이 핀에 연결된 모든 Wire를 찾음
            // (이 부분이 문제: Wire 리스트를 순회해야 함. 
            //  최적화를 위해 Pin -> ConnectedWires 맵이 있으면 좋음.
            //  하지만 지금은 Net.wires 안에서만 찾으면 되므로 전체보다는 빠름)

            for (const wire of allWires) {
                if (visitedWires.has(wire)) continue;

                if (wire.from === currentPin || wire.to === currentPin) {
                    visitedWires.add(wire);

                    const otherPin = (wire.from === currentPin) ? wire.to : wire.from;
                    if (!visitedPins.has(otherPin)) {
                        visitedPins.add(otherPin);
                        queue.push(otherPin);
                    }
                }
            }
        }

        // 결과 비교
        const groupPins = visitedPins;
        const groupWires = visitedWires;

        if (groupPins.size === allPins.length) {
            // 분리되지 않음. (Connectivity 유지됨)
            return;
        }

        // === 분리 발생 ===

        // 1. 원래 Net(originalNet)은 '찾은 그룹'으로 축소시킴
        originalNet.pins = groupPins;
        originalNet.wires = groupWires;

        // 맵 갱신은 필요 없음 (원래 ID 유지하니까)

        // 2. 방문하지 않은 나머지 핀/전선들은 새로운 Net으로 만들어야 함
        // 나머지를 모아서 다시 recalculateNet을 호출하는 것이 가장 확실한 재귀적 방법
        // (3조각, 4조각으로 날 수도 있으므로)

        const remainingPins = allPins.filter(p => !groupPins.has(p));
        const remainingWires = allWires.filter(w => !groupWires.has(w));

        // 새로운 Net 하나 생성해서 나머지를 몰아넣고, 다시 검사
        const newNet = this.createNet();

        for (const p of remainingPins) {
            this.addPinToNet(newNet, p); // 맵 갱신 포함됨
        }
        for (const w of remainingWires) {
            newNet.wires.add(w);
            this.wireToNet.set(w, newNet.id);
        }

        // 재귀 호출로 추가 분리 확인
        this.recalculateNet(newNet);
    }

    /**
     * 디버그용: 전체 Net 상태 출력
     */
    printStats() {
        console.log(`=== Net Stats ===`);
        console.log(`Total Nets: ${this.nets.size}`);
        this.nets.forEach(net => {
            console.log(`Net[${net.id}]: Pins=${net.pins.size}, Wires=${net.wires.size}, State=${net.state}`);
        });
    }
}

// 전역 등록
window.NetManager = NetManager;
