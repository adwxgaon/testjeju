/* =========================================================
   언젠가, 제주 — 프론트엔드 로직 (리디자인 버전)
   ---------------------------------------------------------
   · 3개 뷰(시작/지도/지역) 라우팅 + 페이지 전환 와이프
   · Leaflet 지도 + 지역별 소원 개수 뱃지
   · Google Apps Script + 스프레드시트 연동 (지역 컬럼 포함)
   ========================================================= */

/* ---------------------------------------------------------
   ★★ 배포한 Apps Script 웹앱 URL ★★
   (스프레드시트에 '지역' 컬럼을 추가하고 Code.gs를 새 버전으로
    재배포한 뒤, URL이 바뀌면 여기만 갈아끼우면 됩니다.)
   --------------------------------------------------------- */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxGmToUEP1WTbtxBFhO6uSwIGgnjkZcaeTHSj4UwIpYQwFXmhJEfvXq5bI8WIAH9bVu2A/exec";

/* ----- 제주 지역 정의 (지도 마커 좌표 + 영문 라벨) ----- */
const REGIONS = [
  { id: "jeju",     name: "제주시",     en: "JEJU-SI",   lat: 33.499, lng: 126.531 },
  { id: "aewol",    name: "애월",       en: "AEWOL",     lat: 33.463, lng: 126.310 },
  { id: "hallim",   name: "한림·협재",  en: "HALLIM",    lat: 33.394, lng: 126.240 },
  { id: "seongsan", name: "성산·우도",  en: "SEONGSAN",  lat: 33.458, lng: 126.930 },
  { id: "pyoseon",  name: "표선·남원",  en: "PYOSEON",   lat: 33.326, lng: 126.833 },
  { id: "seogwipo", name: "서귀포",     en: "SEOGWIPO",  lat: 33.253, lng: 126.560 },
  { id: "jungmun",  name: "중문",       en: "JUNGMUN",   lat: 33.244, lng: 126.412 },
  { id: "hallasan", name: "한라산",     en: "HALLASAN",  lat: 33.361, lng: 126.529 },
];
// 지역 이름 → 지역 객체 빠른 조회
const REGION_BY_NAME = Object.fromEntries(REGIONS.map(r => [r.name, r]));

const MBTI_TYPES = [
  "INTJ","INTP","ENTJ","ENTP","INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISFJ","ESTJ","ESFJ","ISTP","ISFP","ESTP","ESFP",
];

/* ----- DOM 참조 ----- */
const el = {
  wipe:        document.getElementById("wipe"),
  views: {
    intro:  document.getElementById("view-intro"),
    map:    document.getElementById("view-map"),
    region: document.getElementById("view-region"),
  },
  // 지도
  mapEl:       document.getElementById("map"),
  mapState:    document.getElementById("mapState"),
  mapStateText:document.getElementById("mapStateText"),
  mapRetry:    document.getElementById("mapRetry"),
  // 지역 뷰
  regionName:  document.getElementById("regionName"),
  regionEn:    document.getElementById("regionEn"),
  regionCount: document.getElementById("regionCount"),
  orchard:     document.getElementById("orchard"),
  regionEmpty: document.getElementById("regionEmpty"),
  // 소원 상세 모달
  wishModal:   document.getElementById("wishModal"),
  wishRegion:  document.getElementById("wishRegion"),
  wishMeta:    document.getElementById("wishMeta"),
  wishText:    document.getElementById("wishText"),
  // 입력 폼
  formModal:   document.getElementById("formModal"),
  openFormBtn: document.getElementById("openFormBtn"),
  wishForm:    document.getElementById("wishForm"),
  inputRegion: document.getElementById("inputRegion"),
  inputAge:    document.getElementById("inputAge"),
  inputMbti:   document.getElementById("inputMbti"),
  inputWish:   document.getElementById("inputWish"),
  wishLen:     document.getElementById("wishLen"),
  submitBtn:   document.getElementById("submitBtn"),
  formMessage: document.getElementById("formMessage"),
};

/* ----- 앱 상태 ----- */
let wishes = [];            // 전체 소원 [{timestamp, age, mbti, wish, region}]
let currentView = "intro";  // 현재 뷰
let currentRegionId = null; // 지역 뷰에서 보고 있는 지역
let map = null;             // Leaflet 지도 인스턴스
let markers = {};          // 지역별 마커 캐시
let dataLoaded = false;    // 데이터 최초 로드 여부

/* =========================================================
   1. 라우팅 + 페이지 전환 와이프
   ========================================================= */
function go(view, param) {
  if (view === currentView && view !== "region") return;

  // 와이프 덮기 → 뷰 교체 → 와이프 걷기
  el.wipe.classList.remove("uncover");
  el.wipe.classList.add("cover");

  setTimeout(() => {
    switchView(view, param);
    el.wipe.classList.remove("cover");
    el.wipe.classList.add("uncover");
    setTimeout(() => el.wipe.classList.remove("uncover"), 430);
  }, 300);
}

function switchView(view, param) {
  Object.values(el.views).forEach(v => v.classList.remove("is-active"));
  el.views[view].classList.add("is-active");
  currentView = view;
  // 현재 뷰를 body에 표시 → CSS로 시작 페이지 전용 스타일(FAB 숨김 등) 적용
  document.body.dataset.view = view;

  if (view === "map") enterMap();
  if (view === "region") enterRegion(param);
}

/* =========================================================
   2. 지도 페이지
   ========================================================= */
function enterMap() {
  // 지도는 최초 진입 때 한 번만 생성
  if (!map) initMap();
  // 숨겨졌다 나타난 컨테이너의 크기를 다시 계산 (Leaflet 필수)
  setTimeout(() => { map.invalidateSize(); }, 60);
  // 데이터가 준비됐으면 마커 갱신
  if (dataLoaded) renderMarkers();
}

function initMap() {
  map = L.map(el.mapEl, {
    center: [33.37, 126.55],
    zoom: 10,
    minZoom: 9,
    maxZoom: 14,
    zoomControl: true,
    attributionControl: true,
  });

  // 밝고 깔끔한 타일(다크 톤 보정은 CSS에서). 인터넷 필요.
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: "abcd",
  }).addTo(map);

  // 제주도 밖으로 너무 벗어나지 않도록 범위 제한
  map.setMaxBounds([[33.0, 126.0], [33.75, 127.1]]);
}

// 지역별 소원 개수를 세어 마커(뱃지) 생성/갱신
function renderMarkers() {
  const counts = countByRegion();

  REGIONS.forEach(region => {
    const count = counts[region.name] || 0;
    const zero = count === 0 ? " is-zero" : "";
    const html =
      `<div class="pin">
         <span class="pin__count${zero}">${count}</span>
         <span class="pin__name">${region.name}</span>
       </div>`;

    if (markers[region.id]) {
      // 이미 있으면 아이콘만 교체 (개수 갱신)
      markers[region.id].setIcon(makeIcon(html));
    } else {
      const marker = L.marker([region.lat, region.lng], {
        icon: makeIcon(html),
        keyboard: false,
      }).addTo(map);
      marker.on("click", () => go("region", region.id));
      markers[region.id] = marker;
    }
  });
}

function makeIcon(html) {
  return L.divIcon({
    className: "region-marker",
    html: html,
    iconSize: null,   // 내용 크기에 맞춤
    iconAnchor: [30, 44],
  });
}

// 지역 이름별 소원 개수 집계
function countByRegion() {
  const counts = {};
  wishes.forEach(w => {
    const name = (w.region || "").trim();
    if (name) counts[name] = (counts[name] || 0) + 1;
  });
  return counts;
}

function setMapState(mode) {
  // mode: 'loading' | 'error' | 'done'
  if (mode === "done") { el.mapState.classList.add("is-hidden"); return; }
  el.mapState.classList.remove("is-hidden");
  if (mode === "loading") {
    el.mapStateText.textContent = "소원을 불러오는 중…";
    el.mapState.querySelector(".spinner").style.display = "";
    el.mapRetry.classList.add("is-hidden");
  } else if (mode === "error") {
    el.mapStateText.textContent = "🍂 소원을 불러오지 못했어요.";
    el.mapState.querySelector(".spinner").style.display = "none";
    el.mapRetry.classList.remove("is-hidden");
  }
}

/* =========================================================
   3. 지역별 소원 페이지
   ========================================================= */
function enterRegion(regionId) {
  const region = REGIONS.find(r => r.id === regionId);
  if (!region) return;
  currentRegionId = regionId;

  el.regionName.textContent = region.name;
  el.regionEn.textContent = region.en;

  const list = wishes.filter(w => (w.region || "").trim() === region.name);
  el.regionCount.textContent = list.length;

  // 기존 카드 비우기 (빈 상태 요소는 유지)
  el.orchard.querySelectorAll(".wish-card").forEach(c => c.remove());

  if (list.length === 0) {
    el.regionEmpty.classList.remove("is-hidden");
    return;
  }
  el.regionEmpty.classList.add("is-hidden");

  // 최신 소원이 위로
  list.slice().reverse().forEach((item, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "wish-card";
    card.style.animationDelay = (i % 10) * 0.04 + "s";
    card.innerHTML =
      `<div class="wish-card__fruit">🍊</div>
       <div class="wish-card__text">${escapeHtml(item.wish)}</div>
       <div class="wish-card__meta">${escapeHtml(String(item.age))}세 · ${escapeHtml(item.mbti)}</div>`;
    card.addEventListener("click", () => openWishModal(item, region));
    el.orchard.appendChild(card);
  });
}

/* =========================================================
   4. 데이터 불러오기 (doGet)
   ========================================================= */
async function loadWishes() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_배포_URL") {
    console.warn("APPS_SCRIPT_URL이 설정되지 않았습니다.");
    dataLoaded = true;
    setMapState("done");
    return;
  }
  setMapState("loading");
  try {
    const res = await fetch(APPS_SCRIPT_URL, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    wishes = Array.isArray(data) ? data : [];
    dataLoaded = true;
    setMapState("done");
    if (map) renderMarkers();
    // 지역 뷰를 보고 있었다면 다시 그림
    if (currentView === "region") enterRegion(currentRegionId);
  } catch (err) {
    console.error("소원 불러오기 실패:", err);
    setMapState("error");
  }
}

/* =========================================================
   5. 소원 제출 (doPost) — CORS 회피 위해 text/plain 사용
   ========================================================= */
async function submitWish(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function onSubmit(e) {
  e.preventDefault();

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_배포_URL") {
    showFormMessage("아직 서버가 연결되지 않았어요. (APPS_SCRIPT_URL 설정 필요)", "error");
    return;
  }

  const payload = {
    region: el.inputRegion.value.trim(),
    age:    el.inputAge.value.trim(),
    mbti:   el.inputMbti.value.trim().toUpperCase(),
    wish:   el.inputWish.value.trim(),
  };
  if (!payload.region || !payload.age || !payload.mbti || !payload.wish) {
    showFormMessage("모든 칸을 채워주세요.", "error");
    return;
  }

  el.submitBtn.disabled = true;
  el.submitBtn.textContent = "감귤 맺는 중…";
  el.formMessage.classList.add("is-hidden");

  try {
    const result = await submitWish(payload);
    if (result && result.result === "success") {
      // 낙관적 업데이트: 서버 재조회 없이 화면에 즉시 반영
      wishes.push({
        timestamp: new Date().toISOString(),
        age: payload.age, mbti: payload.mbti, wish: payload.wish, region: payload.region,
      });
      if (map) renderMarkers();

      el.wishForm.reset();
      el.wishLen.textContent = "0";
      closeModals();

      // 방금 소원을 남긴 지역으로 이동해 감귤을 보여줌
      const region = REGION_BY_NAME[payload.region];
      if (region) go("region", region.id);
    } else {
      throw new Error("서버 응답 오류");
    }
  } catch (err) {
    console.error("소원 제출 실패:", err);
    showFormMessage("저장에 실패했어요. 잠시 후 다시 시도해주세요.", "error");
  } finally {
    el.submitBtn.disabled = false;
    el.submitBtn.textContent = "감귤 톡! 맺기";
  }
}

/* =========================================================
   6. 모달
   ========================================================= */
function openWishModal(item, region) {
  el.wishRegion.textContent = region ? region.name : (item.region || "");
  el.wishMeta.textContent = `${item.age}세 · ${item.mbti}`;
  el.wishText.textContent = item.wish;
  el.wishModal.classList.remove("is-hidden");
}
function openFormModal() {
  el.formMessage.classList.add("is-hidden");
  // 지역 뷰에서 열었다면 그 지역을 기본 선택
  if (currentView === "region" && currentRegionId) {
    const r = REGIONS.find(x => x.id === currentRegionId);
    if (r) el.inputRegion.value = r.name;
  }
  el.formModal.classList.remove("is-hidden");
}
function closeModals() {
  el.wishModal.classList.add("is-hidden");
  el.formModal.classList.add("is-hidden");
}

/* =========================================================
   7. 유틸
   ========================================================= */
// 사용자 입력이 소원 카드에 그대로 들어가므로 HTML 이스케이프
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function showFormMessage(text, type) {
  el.formMessage.textContent = text;
  el.formMessage.className = "form__message " + (type === "error" ? "is-error" : "is-success");
  el.formMessage.classList.remove("is-hidden");
}
function fillSelectOptions() {
  REGIONS.forEach(r => el.inputRegion.appendChild(new Option(r.name, r.name)));
  MBTI_TYPES.forEach(t => el.inputMbti.appendChild(new Option(t, t)));
}

/* =========================================================
   8. 이벤트 연결
   ========================================================= */
function bindEvents() {
  // data-go 속성이 붙은 모든 버튼 → 해당 뷰로 이동
  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => go(btn.dataset.go));
  });
  el.mapRetry.addEventListener("click", loadWishes);
  el.openFormBtn.addEventListener("click", openFormModal);

  document.querySelectorAll("[data-close]").forEach(n => n.addEventListener("click", closeModals));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

  el.inputWish.addEventListener("input", () => { el.wishLen.textContent = el.inputWish.value.length; });
  el.wishForm.addEventListener("submit", onSubmit);
}

/* =========================================================
   9. 시작
   ========================================================= */
function init() {
  document.body.dataset.view = "intro";   // 초기 뷰 표시
  fillSelectOptions();
  bindEvents();
  loadWishes();   // 시작하자마자 데이터 로드 (지도 열면 바로 보이도록)
}
document.addEventListener("DOMContentLoaded", init);
