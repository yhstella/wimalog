#!/usr/bin/env node
// Supabase에서 실제 가입자 데이터를 JSON으로 export → repo의 exports/ 폴더에 timestamped 백업
// 실행: node scripts/export-supabase.js  (repo 루트에서)
// 또는: SUPABASE_EXPORT_DIR=E:\wimalog\exports node scripts/export-supabase.js
//
// 시드 데이터는 제외 (seed=true) — 코드(seed-supabase.js)에 이미 있음.
// 실제 가입자(seed=false)만 백업.

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

config({ path: '.env.local' });
config({ path: '.env' });

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error('❌ .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요');
  process.exit(1);
}

// 기본 export 위치: repo의 exports/ (이동에 안전 — repo 따라 이동). 없으면 ~/wimalog-backup/
const DEFAULT_DIR = join(process.cwd(), 'exports');
const FALLBACK_DIR = join(homedir(), 'wimalog-backup');
const EXPORT_DIR = process.env.SUPABASE_EXPORT_DIR || DEFAULT_DIR || FALLBACK_DIR;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const TABLES = [
  'patients',
  'med_courses',
  'doses',
  'weight_logs',
  'exercises',
  'diets',
];

async function fetchAll(table, filter = q => q.eq('seed', false)) {
  const all = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    let q = sb.from(table).select('*').range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) {
      // seed 컬럼 없는 테이블(weight_logs/doses 등)은 patient_id로 join 필요
      // 간단화: seed 컬럼이 없으면 전체 가져옴 (사용자 PRESS 필요 시 별도 처리)
      if (error.message?.includes('seed')) {
        const { data: data2, error: err2 } = await sb.from(table).select('*').range(from, from + PAGE - 1);
        if (err2) throw err2;
        all.push(...data2);
        if (data2.length < PAGE) break;
      } else {
        throw error;
      }
    } else {
      all.push(...data);
      if (data.length < PAGE) break;
    }
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log('📦 Supabase → Dropbox 백업 시작');
  console.log('   대상 폴더:', EXPORT_DIR);

  // timestamped 폴더 생성
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  const outDir = join(EXPORT_DIR, stamp);
  mkdirSync(outDir, { recursive: true });
  console.log('   백업 위치:', outDir);

  // 1. 실제 가입자 patients
  console.log('\n🔍 실제 가입자(seed=false) 조회...');
  const patients = await fetchAll('patients', q => q.eq('seed', false));
  console.log(`   ${patients.length}명 발견`);
  if (!patients.length) {
    console.log('⚠ 실제 가입자 데이터 없음 — 빈 백업 생성');
  }
  writeFileSync(join(outDir, 'patients.json'), JSON.stringify(patients, null, 2), 'utf-8');

  const patientIds = patients.map(p => p.id);

  // 2. patient_id로 관련 데이터 가져옴
  const summary = { patients: patients.length };
  for (const table of TABLES.slice(1)) {  // med_courses, doses, weight_logs, exercises, diets
    if (!patientIds.length) {
      writeFileSync(join(outDir, `${table}.json`), '[]', 'utf-8');
      summary[table] = 0;
      continue;
    }
    let allRows = [];
    // patient_id IN chunks (URL 길이 제한 회피)
    const CHUNK = 100;
    for (let i = 0; i < patientIds.length; i += CHUNK) {
      const ids = patientIds.slice(i, i + CHUNK);
      const { data, error } = await sb.from(table).select('*').in('patient_id', ids);
      if (error) { console.warn(`   ${table} 에러:`, error.message); continue; }
      allRows.push(...data);
    }
    writeFileSync(join(outDir, `${table}.json`), JSON.stringify(allRows, null, 2), 'utf-8');
    summary[table] = allRows.length;
    console.log(`   ${table.padEnd(14)} ${allRows.length}건`);
  }

  // 3. summary.json
  const summaryFile = {
    exported_at: now.toISOString(),
    supabase_url: URL,
    counts: summary,
  };
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summaryFile, null, 2), 'utf-8');

  // 4. 최신 latest/ symlink 대신 latest 폴더에 복사 (Windows 호환)
  console.log('\n✅ 백업 완료');
  console.log('   ' + outDir);
  console.log('\n📊 요약:');
  for (const [k, v] of Object.entries(summary)) {
    console.log(`   ${k.padEnd(14)} ${v.toLocaleString()}건`);
  }
}

main().catch(e => { console.error('❌ 실패:', e.message); process.exit(1); });
