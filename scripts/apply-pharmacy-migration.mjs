#!/usr/bin/env node
// supabase/migrations/007_pharmacy_reports.sql 을 Supabase에 적용 + 시드 데이터 삽입
// 실행: node scripts/apply-pharmacy-migration.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

config({ path: '.env.local' });
config({ path: '.env' });

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('❌ .env.local 에 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요');
  process.exit(1);
}

const supa = createClient(URL, KEY, { auth: { persistSession: false } });

// 1) 마이그레이션 SQL — Supabase REST sql_exec RPC 또는 직접 connection 필요.
// Service role로는 PostgREST를 통해 SQL 직접 실행 불가 → Dashboard에서 SQL editor 실행 권장.
// 여기서는 시드 데이터 insert만 수행.

console.log('⚠ 마이그레이션 SQL 적용 안내:');
console.log('   Supabase Dashboard → SQL Editor → supabase/migrations/007_pharmacy_reports.sql 실행');
console.log('');

// 2) 시드 데이터 생성 — 13개 지역 × 약국 × 가격
const PHARMACY_CLUSTERS = [
  { id: 'seoul-daehakro', region: '서울 대학로', priceMult: 0.78,
    pharmacies: [
      { name: '대학로A약국', medsHandled: ['wegovy','mounjaro','saxenda','ozempic','zepbound'], rep: 14 },
      { name: '대학로B약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 9 },
      { name: '혜화C약국',  medsHandled: ['wegovy','mounjaro','ozempic'], rep: 7 },
    ] },
  { id: 'seoul-gangnam', region: '서울 강남', priceMult: 1.10,
    pharmacies: [
      { name: '강남역A약국', medsHandled: ['wegovy','mounjaro','saxenda','ozempic','zepbound'], rep: 11 },
      { name: '역삼B약국',   medsHandled: ['wegovy','mounjaro'], rep: 8 },
      { name: '논현C약국',   medsHandled: ['wegovy','mounjaro','saxenda'], rep: 6 },
    ] },
  { id: 'seoul-jongno', region: '서울 종로', priceMult: 0.85,
    pharmacies: [
      { name: '종로A약국',   medsHandled: ['wegovy','mounjaro','saxenda'], rep: 6 },
      { name: '광화문B약국', medsHandled: ['wegovy','mounjaro'], rep: 5 },
    ] },
  { id: 'seoul-sinchon', region: '서울 신촌', priceMult: 0.95,
    pharmacies: [
      { name: '신촌A약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 5 },
      { name: '연대B약국', medsHandled: ['wegovy','mounjaro'], rep: 4 },
    ] },
  { id: 'seoul-songpa', region: '서울 송파', priceMult: 1.05,
    pharmacies: [
      { name: '잠실A약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 5 },
      { name: '석촌B약국', medsHandled: ['wegovy','mounjaro'], rep: 3 },
    ] },
  { id: 'gyeonggi-bundang', region: '경기 분당', priceMult: 1.00,
    pharmacies: [
      { name: '서현역A약국', medsHandled: ['wegovy','mounjaro','saxenda','ozempic'], rep: 6 },
      { name: '정자동B약국', medsHandled: ['wegovy','mounjaro'], rep: 4 },
    ] },
  { id: 'gyeonggi-ilsan', region: '경기 일산', priceMult: 1.00,
    pharmacies: [{ name: '주엽A약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 4 }] },
  { id: 'gyeonggi-suwon', region: '경기 수원', priceMult: 0.98,
    pharmacies: [{ name: '수원역A약국', medsHandled: ['wegovy','mounjaro'], rep: 3 }] },
  { id: 'busan', region: '부산', priceMult: 0.95,
    pharmacies: [
      { name: '서면A약국',   medsHandled: ['wegovy','mounjaro','saxenda'], rep: 5 },
      { name: '해운대B약국', medsHandled: ['wegovy','mounjaro'], rep: 4 },
    ] },
  { id: 'daegu', region: '대구', priceMult: 0.95,
    pharmacies: [{ name: '동성로A약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 4 }] },
  { id: 'incheon', region: '인천', priceMult: 1.00,
    pharmacies: [{ name: '구월동A약국', medsHandled: ['wegovy','mounjaro'], rep: 3 }] },
  { id: 'daejeon', region: '대전', priceMult: 0.95,
    pharmacies: [{ name: '둔산동A약국', medsHandled: ['wegovy','mounjaro','saxenda'], rep: 3 }] },
  { id: 'gwangju', region: '광주', priceMult: 0.95,
    pharmacies: [{ name: '상무지구A약국', medsHandled: ['wegovy','mounjaro'], rep: 3 }] },
];

const REFERENCE_PRICE_4W = {
  wegovy:   { '0.25mg': 280000, '0.5mg': 300000, '1.0mg': 360000, '1.7mg': 450000, '2.4mg': 560000 },
  mounjaro: { '2.5mg': 400000, '5mg': 460000, '7.5mg': 540000, '10mg': 620000, '12.5mg': 680000, '15mg': 750000 },
  saxenda:  { '0.6mg': 320000, '1.2mg': 350000, '1.8mg': 380000, '2.4mg': 410000, '3.0mg': 440000 },
  ozempic:  { '0.25mg': 250000, '0.5mg': 280000, '1.0mg': 350000, '2.0mg': 450000 },
  zepbound: { '2.5mg': 390000, '5mg': 450000, '7.5mg': 530000, '10mg': 610000, '12.5mg': 670000, '15mg': 730000 },
};

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDate = (daysAgo) => new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);

// 기존 시드 데이터 제거
console.log('🧹 기존 시드 약국 데이터 삭제...');
const { error: delErr } = await supa.from('pharmacy_reports').delete().eq('seed', true);
if (delErr && !delErr.message.includes('does not exist')) {
  console.warn('   삭제 실패 (테이블 없을 수도):', delErr.message);
  console.log('   → 먼저 Dashboard에서 마이그레이션 SQL을 실행해주세요.');
  process.exit(1);
}

const rand = mulberry32(20260521);
const rows = [];
for (const cluster of PHARMACY_CLUSTERS) {
  for (const pharm of cluster.pharmacies) {
    for (let i = 0; i < pharm.rep; i++) {
      const med = pharm.medsHandled[Math.floor(rand() * pharm.medsHandled.length)];
      const dosesAvail = Object.keys(REFERENCE_PRICE_4W[med] || {});
      if (!dosesAvail.length) continue;
      const dose = dosesAvail[Math.floor(rand() * dosesAvail.length)];
      const base = REFERENCE_PRICE_4W[med][dose];
      const indivMult = 0.92 + rand() * 0.16;
      const price = Math.round(base * cluster.priceMult * indivMult / 1000) * 1000;
      const daysAgo = Math.floor(rand() * 90);
      rows.push({
        seed: true,
        region: cluster.region,
        region_id: cluster.id,
        pharmacy_name: pharm.name,
        medication: med,
        dose,
        price_per_4w: price,
        purchase_date: isoDate(daysAgo),
        submitted_at: new Date(Date.now() - daysAgo * DAY_MS).toISOString(),
        notes: null,
        submitted_by: null,
        trust_score: 0,
      });
    }
  }
}

console.log(`📦 ${rows.length}건 시드 데이터 insert...`);
// 100건씩 chunk
const chunks = [];
for (let i = 0; i < rows.length; i += 100) chunks.push(rows.slice(i, i + 100));
for (let i = 0; i < chunks.length; i++) {
  const { error } = await supa.from('pharmacy_reports').insert(chunks[i]);
  if (error) {
    console.error('insert err:', error.message);
    process.exit(1);
  }
}

console.log(`✅ 완료 — ${rows.length}건 삽입`);
