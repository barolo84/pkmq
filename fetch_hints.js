// PokeAPI에서 한국어 도감 설명을 수집하는 스크립트
// 실행: node fetch_hints.js

const fs = require('fs');

// pkm_data.js에서 PD 배열 로드
const code = fs.readFileSync('pkm_data.js', 'utf8');
const PD = new Function(code + '; return PD;')();

// 고유 ID 추출
const ids = [...new Set(PD.map(p => p.id))].sort((a, b) => a - b);

// ID별 이름 맵 (설명에서 이름 치환용)
const nameMap = {};
PD.forEach(p => {
    if (!nameMap[p.id]) nameMap[p.id] = [];
    const dn = p.n.replace(/_.*$/, '');
    if (!nameMap[p.id].includes(dn)) nameMap[p.id].push(dn);
});

const BATCH = 20;
const DELAY = 1200; // ms between batches

async function fetchOne(id) {
    const url = `https://pokeapi.co/api/v2/pokemon-species/${id}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    // 한국어 도감 설명 추출
    const koEntries = data.flavor_text_entries.filter(e => e.language.name === 'ko');
    if (koEntries.length === 0) return null;

    // 랜덤하게 하나 선택하되, 가장 긴 설명 우선
    const sorted = koEntries.sort((a, b) => b.flavor_text.length - a.flavor_text.length);
    // 상위 3개 중 랜덤 선택 (다양성)
    const texts = sorted.slice(0, Math.min(3, sorted.length));

    // 모든 설명을 배열로 저장 (클라이언트에서 랜덤 선택 가능)
    const names = nameMap[id] || [];
    const cleaned = texts.map(t => {
        let text = t.flavor_text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        // 포켓몬 이름을 ???로 치환
        for (const name of names) {
            text = text.replace(new RegExp(name, 'g'), '???');
        }
        return text;
    });

    // 중복 제거
    return [...new Set(cleaned)];
}

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function main() {
    const hints = {};
    let done = 0;

    for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(id => fetchOne(id)));

        batch.forEach((id, idx) => {
            if (results[idx]) {
                hints[id] = results[idx];
            }
        });

        done += batch.length;
        process.stdout.write(`\r${done}/${ids.length} 완료`);

        if (i + BATCH < ids.length) await sleep(DELAY);
    }

    console.log('\n수집 완료!');

    // pkm_hints.js로 저장
    const content = 'const HINTS=' + JSON.stringify(hints) + ';\n';
    fs.writeFileSync('pkm_hints.js', content);
    console.log(`pkm_hints.js 저장 완료 (${Object.keys(hints).length}개 포켓몬)`);
}

main().catch(console.error);
