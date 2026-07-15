/* =========================================================
   언젠가, 제주 — 프론트엔드 로직 (Vanilla JavaScript)
   ---------------------------------------------------------
   · Google Apps Script 웹앱과 통신하여 소원을 저장/조회
   · 감귤나무에 소원(감귤)을 그리고, 클릭 시 상세 모달 표시
   · MBTI 필터, 로딩/에러/빈 상태 처리
   ========================================================= */

/* ---------------------------------------------------------
   ★★ 여기에 배포한 Apps Script 웹앱 URL을 붙여넣으세요 ★★
   (README의 ③~④ 단계 참고. 아래 문자열만 바꾸면 됩니다.)
   --------------------------------------------------------- */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxGmToUEP1WTbtxBFhO6uSwIGgnjkZcaeTHSj4UwIpYQwFXmhJEfvXq5bI8WIAH9bVu2A/exec";

/* ----- MBTI 16종 목록 ----- */
const MBTI_TYPES = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

/* ----- 자주 쓰는 DOM 요소 미리 찾아두기 ----- */
const el = {
  scene:         document.getElementById("scene"),
  layer:         document.getElementById("tangerineLayer"),
  loading:       document.getElementById("stateLoading"),
  error:         document.getElementById("stateError"),
  empty:         document.getElementById("stateEmpty"),
  retryBtn:      document.getElementById("retryBtn"),
  wishCount:     document.getElementById("wishCount"),
  // 필터
  filterMbti:    document.getElementById("filterMbti"),
  filterReset:   document.getElementById("filterReset"),
  // 소원 상세 모달
  wishModal:     document.getElementById("wishModal"),
  wishModalMeta: document.getElementById("wishModalMeta"),
  wishModalText: document.getElementById("wishModalText"),
  // 입력 폼 모달
  formModal:     document.getElementById("formModal"),
  openFormBtn:   document.getElementById("openFormBtn"),
  wishForm:      document.getElementById("wishForm"),
  inputAge:      document.getElementById("inputAge"),
  inputMbti:     document.getElementById("inputMbti"),
  inputWish:     document.getElementById("inputWish"),
  wishLen:       document.getElementById("wishLen"),
  submitBtn:     document.getElementById("submitBtn"),
  formMessage:   document.getElementById("formMessage"),
};

/* ----- 화면에 보관하는 소원 데이터 ----- */
let wishes = [];   // [{ age, mbti, wish, timestamp }, ...]

/* =========================================================
   1. 감귤이 나무에 앉을 위치 계산
   ---------------------------------------------------------
   · 나무 잎(foliage) 영역 안에 골고루 흩뿌리기 위해
     "결정적 의사난수(deterministic pseudo-random)"를 사용.
   · index만 넣으면 항상 같은 위치가 나오므로, 새로고침해도
     감귤 위치가 유지됩니다.
   ========================================================= */

// index를 넣으면 0~1 사이 값을 돌려주는 간단한 해시(항상 같은 결과)
function pseudoRandom(seed) {
  const x = Math.sin(seed * 999.13) * 43758.5453;
  return x - Math.floor(x);   // 소수 부분만 = 0~1
}

// index번째 감귤의 (left%, top%) 좌표를 잎 영역(타원) 안에서 계산
function positionForIndex(index) {
  // 잎 덩어리의 중심과 반경 (scene 대비 %). style.css의 나무 위치와 맞춤.
  const cx = 39;   // 중심 X (%)
  const cy = 34;   // 중심 Y (%)
  const rx = 30;   // 가로 반경 (%)
  const ry = 26;   // 세로 반경 (%)

  // 두 개의 의사난수로 각도·반지름을 만들어 타원 안에 골고루 분포
  const angle  = pseudoRandom(index + 1) * Math.PI * 2;
  const radius = Math.sqrt(pseudoRandom(index + 100)); // sqrt로 가장자리 쏠림 방지

  const left = cx + Math.cos(angle) * radius * rx;
  const top  = cy + Math.sin(angle) * radius * ry;
  return { left, top };
}

/* =========================================================
   2. 감귤 렌더링
   ========================================================= */
function renderTangerines() {
  el.layer.innerHTML = "";   // 기존 감귤 비우기

  wishes.forEach((item, index) => {
    const pos = positionForIndex(index);

    // 감귤 버튼 만들기 (접근성 위해 button 사용)
    const btn = document.createElement("button");
    btn.className = "tangerine";
    btn.type = "button";
    btn.style.left = pos.left + "%";
    btn.style.top  = pos.top + "%";
    // 여러 감귤이 동시에 등장할 때 살짝씩 시차를 둠
    btn.style.animationDelay = (index % 12) * 0.05 + "s";
    btn.dataset.mbti = (item.mbti || "").toUpperCase();
    btn.setAttribute("aria-label", `${item.age}세 ${item.mbti}의 소원 보기`);

    // 감귤 몸통 + 잎
    btn.innerHTML = `<span class="tangerine__body"></span><span class="tangerine__leaf"></span>`;

    // 클릭 시 상세 모달 열기
    btn.addEventListener("click", () => openWishModal(item));

    el.layer.appendChild(btn);
  });

  // 소원 개수 갱신
  el.wishCount.innerHTML = `지금까지 <strong>${wishes.length}</strong>개의 소원이 열렸어요`;

  // 필터가 걸려 있으면 다시 적용
  applyFilter();
}

/* =========================================================
   3. 화면 상태 전환 (로딩 / 에러 / 빈 / 정상)
   ========================================================= */
function showState(state) {
  el.loading.classList.toggle("is-hidden", state !== "loading");
  el.error.classList.toggle("is-hidden",   state !== "error");
  el.empty.classList.toggle("is-hidden",   state !== "empty");
  el.scene.classList.toggle("is-hidden",   state !== "scene");
}

/* =========================================================
   4. 소원 목록 불러오기 (doGet 호출)
   ========================================================= */
async function loadWishes() {
  // URL이 아직 설정되지 않았으면 안내
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_배포_URL") {
    console.warn("APPS_SCRIPT_URL이 아직 설정되지 않았습니다. script.js 상단을 확인하세요.");
    showState("empty");
    return;
  }

  showState("loading");
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();

    // 데이터 정리: 배열이 아니면 빈 배열로
    wishes = Array.isArray(data) ? data : [];

    if (wishes.length === 0) {
      showState("empty");
    } else {
      showState("scene");
      renderTangerines();
    }
  } catch (err) {
    console.error("소원 불러오기 실패:", err);
    showState("error");
  }
}

/* =========================================================
   5. 소원 제출하기 (doPost 호출)
   ---------------------------------------------------------
   · CORS preflight를 피하기 위해 Content-Type을
     'text/plain;charset=utf-8'로 보냄 (Apps Script 표준 방법).
   ========================================================= */
async function submitWish(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();   // { result: "success" } 기대
}

/* =========================================================
   6. MBTI 필터
   ========================================================= */
function applyFilter() {
  const selected = el.filterMbti.value.toUpperCase();

  if (!selected) {
    // 전체 보기: 강조 해제
    el.layer.classList.remove("is-filtering");
    el.layer.querySelectorAll(".tangerine").forEach((t) => t.classList.remove("is-match"));
    return;
  }

  // 필터 켜기: 같은 MBTI만 반짝
  el.layer.classList.add("is-filtering");
  el.layer.querySelectorAll(".tangerine").forEach((t) => {
    t.classList.toggle("is-match", t.dataset.mbti === selected);
  });
}

/* =========================================================
   7. 모달 열기/닫기
   ========================================================= */
function openWishModal(item) {
  el.wishModalMeta.textContent = `${item.age}세 · ${item.mbti}`;
  el.wishModalText.textContent = item.wish;
  el.wishModal.classList.remove("is-hidden");
}

function openFormModal() {
  el.formMessage.classList.add("is-hidden");
  el.formModal.classList.remove("is-hidden");
  el.inputAge.focus();
}

function closeModals() {
  el.wishModal.classList.add("is-hidden");
  el.formModal.classList.add("is-hidden");
}

/* =========================================================
   8. 이벤트 연결
   ========================================================= */
function bindEvents() {
  // 다시 시도 버튼
  el.retryBtn.addEventListener("click", loadWishes);

  // 소원 남기기 버튼 → 폼 모달 열기
  el.openFormBtn.addEventListener("click", openFormModal);

  // 모달의 닫기 요소(배경/✕)들
  document.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", closeModals);
  });

  // ESC 키로 모달 닫기
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModals();
  });

  // 소원 글자 수 카운터
  el.inputWish.addEventListener("input", () => {
    el.wishLen.textContent = el.inputWish.value.length;
  });

  // MBTI 필터
  el.filterMbti.addEventListener("change", applyFilter);
  el.filterReset.addEventListener("click", () => {
    el.filterMbti.value = "";
    applyFilter();
  });

  // 폼 제출
  el.wishForm.addEventListener("submit", onSubmit);
}

/* =========================================================
   9. 폼 제출 처리
   ========================================================= */
async function onSubmit(e) {
  e.preventDefault();

  // URL 미설정 방어
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_배포_URL") {
    showFormMessage("아직 서버가 연결되지 않았어요. (APPS_SCRIPT_URL 설정 필요)", "error");
    return;
  }

  // 입력값 정리
  const payload = {
    age:  el.inputAge.value.trim(),
    mbti: el.inputMbti.value.trim().toUpperCase(),
    wish: el.inputWish.value.trim(),
  };

  // 간단한 유효성 검사
  if (!payload.age || !payload.mbti || !payload.wish) {
    showFormMessage("모든 칸을 채워주세요.", "error");
    return;
  }

  // 제출 중 상태
  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "감귤 여는 중…";
  el.formMessage.classList.add("is-hidden");

  try {
    const result = await submitWish(payload);
    if (result && result.result === "success") {
      // 화면에 바로 반영 (서버 재조회 없이 낙관적 업데이트)
      wishes.push({
        timestamp: new Date().toISOString(),
        age: payload.age,
        mbti: payload.mbti,
        wish: payload.wish,
      });
      showState("scene");
      renderTangerines();

      // 폼 초기화 & 닫기
      el.wishForm.reset();
      el.wishLen.textContent = "0";
      closeModals();
    } else {
      throw new Error("서버 응답이 올바르지 않습니다.");
    }
  } catch (err) {
    console.error("소원 제출 실패:", err);
    showFormMessage("저장에 실패했어요. 잠시 후 다시 시도해주세요.", "error");
  } finally {
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = "감귤 톡! 열기";
  }
}

// 폼 메시지 표시 헬퍼
function showFormMessage(text, type) {
  el.formMessage.textContent = text;
  el.formMessage.className = "form__message " + (type === "error" ? "is-error" : "is-success");
  el.formMessage.classList.remove("is-hidden");
}

/* =========================================================
   10. MBTI 옵션 채우기 (필터 select + 입력 폼 select)
   ========================================================= */
function fillMbtiOptions() {
  MBTI_TYPES.forEach((type) => {
    const opt1 = new Option(type, type);
    const opt2 = new Option(type, type);
    el.filterMbti.appendChild(opt1);
    el.inputMbti.appendChild(opt2);
  });
}

/* =========================================================
   11. 시작
   ========================================================= */
function init() {
  fillMbtiOptions();
  bindEvents();
  loadWishes();
}

// DOM이 준비되면 실행
document.addEventListener("DOMContentLoaded", init);
