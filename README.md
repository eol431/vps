# RIVALS – Render 배포 가이드

친구들과 같은 링크로 접속해 함께 즐기는 3D 총싸움 게임입니다. (PVE 협동 / PVP 대결)

## 구성
- `server.js` : HTTP + WebSocket 서버 (접속자 위치/체력 동기화, 피격·킬 전달)
- `public/index.html` : 게임 본체 (원본 vps_1_4_8.html에서 접속 부분만 WebSocket으로 교체)
- `render.yaml` : Render 설정 (Blueprint)
- `package.json` : 의존성(`ws`)

## 배포 방법 (Render)
1. 이 폴더 전체를 GitHub 저장소에 올립니다.
2. Render 대시보드 → **New +** → **Blueprint** (또는 **Web Service**) → 저장소 선택
   - Web Service로 직접 만들 경우: Runtime `Node`, Build Command `npm install`, Start Command `npm start`
3. 배포가 끝나면 나오는 `https://○○○.onrender.com` 주소를 친구들에게 공유하면 끝!

## 로컬 테스트
```
npm install
npm start
# 브라우저에서 http://localhost:3000 을 두 개 열어 확인
```

## 참고
- 무료(Free) 플랜은 15분간 접속이 없으면 잠들고, 다시 접속하면 켜지는 데 30~60초 걸립니다.
- 최대 동시 접속은 32명으로 제한했습니다 (`server.js`의 `MAX_PLAYERS`).
- 서버가 끊기면 게임이 1.5초마다 자동 재접속을 시도합니다.
