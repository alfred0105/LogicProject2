
import os

file_path = r'c:\Users\ace06\OneDrive\바탕 화면\LogicProject2\js\modules\WireManager.js'

# 에러를 무시하고 읽음 (일부 깨지더라도 구조는 유지됨)
with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 들여쓰기가 없는 toPathString 블록을 찾아서 들여쓰기 된 블록으로 교체
target = """toPathString(path) {
    if (!path || path.length === 0) return '';

    // 경로 단순화: 일직선상의 중간 점 제거
    const simplified = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = path[i];
        const next = path[i + 1];

        // 세 점이 일직선이면 중간 점 스킵
        const sameX = prev.x === curr.x && curr.x === next.x;
        const sameY = prev.y === curr.y && curr.y === next.y;
        if (!sameX && !sameY) {
            simplified.push(curr);
        }
    }
    if (path.length > 1) simplified.push(path[path.length - 1]);

    // SVG 경로 생성
    let d = `M ${simplified[0].x} ${simplified[0].y}`;
    for (let i = 1; i < simplified.length; i++) {
        d += ` L ${simplified[i].x} ${simplified[i].y}`;
    }
    return d;
}"""

replacement = """    toPathString(path) {
        if (!path || path.length === 0) return '';

        // 경로 단순화: 일직선상의 중간 점 제거
        const simplified = [path[0]];
        for (let i = 1; i < path.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = path[i];
            const next = path[i + 1];

            // 세 점이 일직선이면 중간 점 스킵
            const sameX = prev.x === curr.x && curr.x === next.x;
            const sameY = prev.y === curr.y && curr.y === next.y;
            if (!sameX && !sameY) {
                simplified.push(curr);
            }
        }
        if (path.length > 1) simplified.push(path[path.length - 1]);

        // SVG 경로 생성
        let d = `M ${simplified[0].x} ${simplified[0].y}`;
        for (let i = 1; i < simplified.length; i++) {
            d += ` L ${simplified[i].x} ${simplified[i].y}`;
        }
        return d;
    }"""

if target in content:
    new_content = content.replace(target, replacement)
    # 항상 UTF-8로 저장
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully corrected indentation.")
else:
    print("Target string not found in content.")
