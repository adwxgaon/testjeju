# 언젠가, 제주 🍊 — 감귤나무에 열리는 소원

> "아직 가보지 못한 그곳에, 마음을 먼저 보냅니다"

방문자가 **"언젠가 제주에 가면 하고 싶은 일"** 한 줄을 남기면,
감귤나무에 감귤이 하나 톡 열립니다. 사람이 많아질수록 나무가 감귤로 가득 차요.
제주의 맑은 바다와 하늘을 배경으로, 감귤나무 옆에 **돌하르방**이 소원을 지켜줍니다.

- **프론트엔드**: 순수 HTML / CSS / JavaScript (프레임워크 없음)
- **백엔드**: Google Apps Script 웹앱 + Google 스프레드시트
- **배포**: GitHub Pages
- **이미지 파일 없음**: 감귤·나무·돌하르방·바다 전부 CSS / SVG / 이모지로 그림

---

## 📁 파일 구성

| 파일 | 설명 |
|------|------|
| `index.html` | 화면 구조 (HTML) |
| `style.css`  | 디자인·애니메이션 (CSS) |
| `script.js`  | 동작 로직 (JavaScript) — **상단에 `APPS_SCRIPT_URL` 상수 있음** |
| `Code.gs`    | Google Apps Script 백엔드 코드 |
| `README.md`  | 이 문서 |

---

## 🧩 주요 기능

- 감귤 1개 = 소원 1개. 사람이 많을수록 나무가 감귤로 가득 참
- 감귤을 클릭하면 카드가 떠서 `24세 · INFJ` + 소원 내용을 보여줌
- 나이 / MBTI / 소원을 입력하면 감귤이 **톡** 열리는 애니메이션
- **MBTI 필터**: 내 MBTI를 고르면 같은 유형의 감귤만 반짝반짝 강조
- 로딩 / 에러 / 빈 상태(소원 0개)까지 모두 처리
- 모바일 반응형

---

## 🚀 세팅 방법 (초보자용 단계별 가이드)

전체 흐름: **스프레드시트 만들기 → Apps Script 붙여넣기 → 웹앱 배포 → URL 연결 → GitHub Pages 배포**

### ① Google 스프레드시트 새로 만들기 (컬럼 헤더 포함)

1. [sheets.google.com](https://sheets.google.com) 접속 → **빈 스프레드시트** 새로 만들기
2. 문서 이름을 `언젠가-제주-소원` 등으로 지정
3. **첫 번째 행(1행)에 헤더**를 아래처럼 입력합니다:

   | A1 | B1 | C1 | D1 | E1 |
   |----|----|----|----|----|
   | 타임스탬프 | 나이 | MBTI | 소원 | 지역 |

   > 💡 데이터는 2행부터 자동으로 쌓입니다. 헤더 행은 그대로 두세요.
   > 💡 리디자인 버전에서 **E열(지역)** 이 추가됐습니다. 기존 시트를 쓰던 분은
   >    **E1 셀에 `지역` 헤더만 추가**하고, Apps Script를 **새 버전으로 다시 배포**하세요.
   >    (기존 행들은 지역이 비어 있어 지도에서 '미분류'로 빠집니다.)
   > 💡 왼쪽 아래 시트 탭 이름이 `시트1`이 아니라면(예: `Sheet1`),
   >    `Code.gs` 맨 위의 `SHEET_NAME` 값을 실제 탭 이름과 똑같이 바꿔주세요.

### ② Apps Script 열고 Code.gs 붙여넣기

1. 스프레드시트 상단 메뉴에서 **확장 프로그램(Extensions) → Apps Script** 클릭
2. 새 탭에 코드 편집기가 열립니다. 기본으로 있던 `function myFunction() {}` 내용을 **전부 지우기**
3. 이 프로젝트의 **`Code.gs` 내용을 전부 복사해서 붙여넣기**
4. 상단 💾 (저장) 버튼 클릭 (프로젝트 이름을 물어보면 아무거나 입력)

### ③ 웹 앱으로 배포하고 URL 복사

1. Apps Script 편집기 오른쪽 위 **배포(Deploy) → 새 배포(New deployment)** 클릭
2. 톱니바퀴(⚙️) 아이콘 → **웹 앱(Web app)** 선택
3. 설정을 아래처럼 지정:
   - **설명(Description)**: 아무거나 (예: `v1`)
   - **실행 계정(Execute as)**: **나(Me)**
   - **액세스 권한(Who has access)**: **모든 사용자(Anyone)**
4. **배포(Deploy)** 클릭
5. 처음이라면 **권한 승인(Authorize access)** 창이 뜹니다:
   - 본인 Google 계정 선택
   - "이 앱은 확인되지 않았습니다" 경고가 나오면
     **고급(Advanced) → (프로젝트 이름)(으)로 이동 → 허용(Allow)**
     (본인이 만든 코드이므로 안전합니다)
6. 배포가 끝나면 **웹 앱 URL**이 나옵니다.
   `https://script.google.com/macros/s/....../exec` 형태 — 이 URL을 **복사**하세요.

   > ⚠️ 나중에 `Code.gs` 코드를 수정하면, **배포 → 배포 관리(Manage deployments)**
   > 에서 연필(✏️) 아이콘 → 버전을 **새 버전(New version)** 으로 바꿔 다시 배포해야
   > 변경 사항이 반영됩니다. (URL은 그대로 유지됩니다.)

### ④ 복사한 URL을 `script.js`에 붙여넣기

1. 이 프로젝트의 **`script.js`** 파일을 엽니다.
2. 파일 맨 위에 있는 아래 줄을 찾습니다:

   ```js
   const APPS_SCRIPT_URL = "여기에_배포_URL";
   ```

3. `"여기에_배포_URL"` 자리에 ③에서 복사한 URL을 붙여넣습니다:

   ```js
   const APPS_SCRIPT_URL = "https://script.google.com/macros/s/....../exec";
   ```

4. 저장합니다. (이제 로컬에서 `index.html`을 브라우저로 열어 테스트해도 됩니다.)

### ⑤ GitHub 저장소에 올리고 GitHub Pages로 배포

1. [github.com](https://github.com)에서 **새 저장소(New repository)** 생성
   (이름 예: `someday-jeju`, **Public** 으로)
2. `index.html`, `style.css`, `script.js`, `README.md` 를 저장소에 업로드
   - 웹에서 하려면: 저장소 페이지 → **Add file → Upload files** → 파일 끌어다 놓기 → **Commit**
   - (`Code.gs`는 GitHub에 올려도 되지만, 웹앱 동작에는 영향이 없습니다. 제출용 문서로 함께 올리면 좋아요.)
3. 저장소 상단 **Settings(설정) → 왼쪽 메뉴 Pages** 클릭
4. **Build and deployment → Source** 를 **Deploy from a branch** 로,
   **Branch** 를 `main` / `/ (root)` 으로 선택 후 **Save**
5. 잠시(1~2분) 기다리면 페이지 상단에 배포 주소가 나옵니다:
   `https://<내아이디>.github.io/someday-jeju/`
6. 그 주소로 접속하면 완성! 🎉

---

## ❓ 자주 겪는 문제 (트러블슈팅)

| 증상 | 해결 |
|------|------|
| 화면에 "아직 열린 감귤이 없어요"만 뜸 | `script.js`의 `APPS_SCRIPT_URL`이 실제 배포 URL로 바뀌었는지 확인 |
| 소원을 저장했는데 반영이 안 됨 | Apps Script 배포 액세스 권한이 **모든 사용자(Anyone)** 인지 확인 |
| 저장은 되는데 목록이 안 불러와짐 | 스프레드시트 헤더(1행)가 `타임스탬프/나이/MBTI/소원/지역` 순서인지 확인 |
| 지도에 소원 개수가 계속 0 | E열(지역) 추가 후 Apps Script를 **새 버전으로 재배포**했는지 확인 |
| 코드 고쳤는데 그대로임 | Apps Script에서 **새 버전**으로 다시 배포했는지 확인 (③의 ⚠️ 참고) |
| 시트 이름 오류 | `Code.gs`의 `SHEET_NAME` 값을 실제 시트 탭 이름과 맞추기 |

---

## 🛠 기술 메모 (발표용)

- **왜 `text/plain`으로 POST하나요?**
  브라우저가 `application/json` POST를 보낼 때는 먼저 **CORS preflight(OPTIONS)** 요청을
  보내는데, Google Apps Script 웹앱은 이 OPTIONS 요청을 처리하지 못해 요청이 막힙니다.
  `Content-Type: text/plain;charset=utf-8` 으로 보내면 preflight 없이 전송되고,
  서버(`Code.gs`)에서는 `e.postData.contents`를 `JSON.parse` 해서 그대로 사용합니다.
  → **Apps Script + 정적 웹페이지 연동의 표준 방법**입니다.

- **감귤 위치는 어떻게 정하나요?**
  `script.js`의 `positionForIndex()`가 index를 씨앗(seed)으로 하는
  **결정적 의사난수**로 잎 영역(타원) 안에 좌표를 계산합니다.
  같은 index면 항상 같은 위치라 새로고침해도 감귤이 안 흔들립니다.

- **낙관적 업데이트(optimistic update)**
  소원을 제출하면 서버에 다시 물어보지 않고 화면에 바로 감귤을 그립니다.
  → 사용자 입장에서 "톡!" 하고 즉시 열리는 경험을 줍니다.

---

🍊 *언젠가, 제주 — 마음을 먼저 보내는 곳*
