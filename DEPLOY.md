# 배포 가이드

감량로그는 100% 정적 SPA(Vite + React)입니다. 어떤 정적 호스팅에도 빌드 결과(`dist/`)만
업로드하면 동작합니다. 백엔드 의존성 없음 (현재 MVP는 사용자 데이터를 브라우저 localStorage에 저장).

> 📌 SPA 라우팅은 **해시 라우팅**(`#/dashboard`)을 사용하므로 서버 fallback이 없어도
> 새로고침이 깨지지 않습니다. 단, 각 호스팅별 권장 설정을 따르면 캐싱·미리보기 등이 더 매끄럽습니다.

---

## 1. Vercel (가장 간단)

```bash
npm i -g vercel
vercel              # 첫 배포 (대화형 설정)
vercel --prod       # 프로덕션
```

- `vercel.json` 포함됨 (SPA fallback + 자산 캐싱 헤더)
- 도메인 연결: Vercel 대시보드 → Settings → Domains

## 2. Netlify

**방법 A — Drag & Drop**
```bash
npm run build
```
→ 생성된 `dist/` 폴더를 [app.netlify.com/drop](https://app.netlify.com/drop)에 드래그.

**방법 B — Git 연동**
- GitHub에 푸시 → Netlify에서 Import → 빌드 설정 자동 인식
- `netlify.toml` 포함됨 (build command + SPA redirect)

## 3. Cloudflare Pages

- Cloudflare 대시보드 → Pages → "Create a project" → Git 연결
- Build command: `npm run build`
- Build output: `dist`
- `public/_redirects`, `public/_headers` 포함됨

## 4. GitHub Pages

**자동 배포 (권장)**
- 저장소 Settings → Pages → Source: "GitHub Actions"
- `main`에 push 하면 `.github/workflows/deploy-pages.yml`이 빌드·배포
- **서브패스 배포** (`user.github.io/gamryang-log/`)인 경우:
  - 저장소 Settings → Variables → Actions → New variable
  - 이름 `BASE_PATH`, 값 `/gamryang-log/` (앞뒤 슬래시 포함)
- **루트 도메인** (CNAME + custom domain)인 경우 BASE_PATH는 그대로 `/`

`public/404.html`이 포함되어 SPA 새로고침 시에도 동작합니다.

## 5. Firebase Hosting

```bash
npm i -g firebase-tools
firebase login
firebase init hosting    # public: dist, single-page app: Yes
npm run build
firebase deploy
```

## 6. Surge.sh (가장 빠른 일회성)

```bash
npm run build
npx surge dist
```

## 7. 직접 Nginx/Apache 서빙

```bash
npm run build
rsync -av dist/ user@server:/var/www/gamryang-log/
```

`nginx.conf` 권장 설정:
```nginx
server {
  listen 80;
  server_name your-domain.com;
  root /var/www/gamryang-log;
  index index.html;

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }

  # 자산 캐싱
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## 환경 변수

현재 빌드 시 사용하는 환경 변수:

| 변수 | 기본값 | 설명 |
|---|---|---|
| `BASE_PATH` | `/` | 서브패스 배포 시 (예: GitHub Pages) `/repo-name/` |
| `PORT` | `5174` | 개발 서버 포트 |

## 백엔드 추가 (선택)

현재 MVP는 localStorage 전용입니다. Supabase/PocketBase/Firebase 등으로 백엔드를 붙이려면
`src/lib/storage.js`의 인터페이스를 그대로 유지하고 구현체만 교체하면 됩니다.
나머지 코드는 Storage 모듈을 통해서만 데이터에 접근하므로 다른 변경이 거의 없습니다.
