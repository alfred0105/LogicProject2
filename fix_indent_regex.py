
import os
import re

file_path = r'c:\Users\ace06\OneDrive\바탕 화면\LogicProject2\js\modules\WireManager.js'

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 정규표현식으로 들여쓰기 없는 toPathString 블록 찾기
# ^toPathString... 부터 } 까지
pattern = re.compile(r"^toPathString\(path\) \{(\s|\S)*?^\}", re.MULTILINE)

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

if pattern.search(content):
    new_content = pattern.sub(replacement, content)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully corrected indentation with regex.")
else:
    print("Pattern not found.")
