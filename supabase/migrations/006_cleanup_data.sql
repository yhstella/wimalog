-- 데이터 정합성 정리
-- 1. '온라인' region 제거 (한국은 GLP-1 온라인 판매 불법)
-- 2. 운동 0분 entry 제거 (통계 왜곡 원인 — 운동 안 한 날은 record 안 만드는 게 맞음)
-- 3. 음수/이상치 cleanup

-- 1. '온라인' region을 '해외 직구'로 정정 (실제 직구 케이스만 살림)
update public.doses
set region = '해외 직구'
where region = '온라인';

-- 2. duration_min이 0이거나 null인 운동 entry 제거 (의미 없음)
delete from public.exercises
where duration_min is null or duration_min <= 0;

-- 3. 음수 체중·이상치 제거
delete from public.weight_logs
where weight is null or weight < 30 or weight > 300;

-- 4. 음수 가격 제거
update public.doses
set price = null
where price is not null and (price < 0 or price > 5000000);
