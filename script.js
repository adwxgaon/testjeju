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
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDDfv5Cknt_5D0BI5Mcb-UtKA6Z3tgq1rPZ57cPtyRi7wbs1Z7EThSjotGYxTClALqfg/exec";

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

/* ----- 맛집 카테고리 (기본 4종 + 제주 특화 3종) ----- */
const FOOD_CATEGORIES = [
  { name: "한식",   emoji: "🍚" },
  { name: "중식",   emoji: "🥟" },
  { name: "일식",   emoji: "🍣" },
  { name: "양식",   emoji: "🍝" },
  { name: "흑돼지", emoji: "🐷" },
  { name: "횟집",   emoji: "🐟" },
  { name: "갈치집", emoji: "🐠" },
];
const CATEGORY_BY_NAME = Object.fromEntries(FOOD_CATEGORIES.map(c => [c.name, c]));

/* ----- 기본 맛집 데이터 (네이버 지도·인스타그램에서 유명한 곳들) ----- */
const SEED_FOODS = [
  // 제주시
  { region: "제주시",     category: "한식",   name: "우진해장국",        desc: "고사리육개장으로 유명한 제주 대표 해장국집" },
  { region: "제주시",     category: "흑돼지", name: "돈사돈",            desc: "두툼한 근고기 흑돼지 구이의 원조 맛집" },
  { region: "제주시",     category: "한식",   name: "자매국수",          desc: "줄 서서 먹는 진한 고기국수 한 그릇" },
  // 애월
  { region: "애월",       category: "한식",   name: "이춘옥원조고등어쌈밥", desc: "노릇한 고등어구이와 쌈밥 한 상" },
  { region: "애월",       category: "양식",   name: "몽상드애월",        desc: "애월 바다를 통유리로 보는 카페 브런치" },
  // 한림·협재
  { region: "한림·협재",  category: "일식",   name: "협재수우동",        desc: "협재 바다 앞 쫄깃한 붓카케 우동" },
  { region: "한림·협재",  category: "한식",   name: "한림칼국수",        desc: "제주 보말이 듬뿍 들어간 보말칼국수" },
  { region: "한림·협재",  category: "흑돼지", name: "협재온다정",        desc: "맑은 흑돼지곰탕으로 유명한 아침 맛집" },
  // 성산·우도
  { region: "성산·우도",  category: "갈치집", name: "맛나식당",          desc: "줄 서서 먹는 갈치조림·갈치구이 정식" },
  { region: "성산·우도",  category: "횟집",   name: "경미네집",          desc: "우도 앞바다 해산물과 회 한 접시" },
  { region: "성산·우도",  category: "한식",   name: "가시아방국수",      desc: "성산일출봉 옆 돔베고기와 고기국수" },
  // 표선·남원
  { region: "표선·남원",  category: "한식",   name: "춘자멸치국수",      desc: "40년 전통 소박한 멸치국수 한 그릇" },
  { region: "표선·남원",  category: "횟집",   name: "공천포식당",        desc: "남원 바닷가 시원한 제주식 물회" },
  // 서귀포
  { region: "서귀포",     category: "갈치집", name: "네거리식당",        desc: "서귀포 대표 갈치국·갈치조림 노포" },
  { region: "서귀포",     category: "중식",   name: "덕성원",            desc: "3대째 이어온 서귀포 중화요리, 깐풍기 맛집" },
  { region: "서귀포",     category: "횟집",   name: "쌍둥이횟집",        desc: "푸짐한 스페셜 모둠회로 유명한 횟집" },
  // 중문
  { region: "중문",       category: "갈치집", name: "색달식당",          desc: "냄비째 나오는 매콤한 갈치조림" },
  { region: "중문",       category: "흑돼지", name: "숙성도",            desc: "숙성 흑돼지 뼈등심으로 인스타를 달군 곳" },
  { region: "중문",       category: "양식",   name: "더클리프",          desc: "중문 해변 절벽 위 피자와 선셋 라운지" },
  // 한라산
  { region: "한라산",     category: "한식",   name: "성미가든",          desc: "교래리 토종닭 샤브샤브와 닭죽 코스" },
  { region: "한라산",     category: "한식",   name: "교래손칼국수",      desc: "한라산 가는 길 메밀 손칼국수" },
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
  mapTitle:    document.getElementById("mapTitle"),
  mapSub:      document.getElementById("mapSub"),
  // 지역 뷰
  regionName:  document.getElementById("regionName"),
  regionEn:    document.getElementById("regionEn"),
  regionCount: document.getElementById("regionCount"),
  regionCountSuffix: document.getElementById("regionCountSuffix"),
  regionBg:    document.getElementById("regionBg"),
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
  fabLabel:    document.getElementById("fabLabel"),
  wishForm:    document.getElementById("wishForm"),
  inputRegion: document.getElementById("inputRegion"),
  inputAge:    document.getElementById("inputAge"),
  inputMbti:   document.getElementById("inputMbti"),
  inputWish:   document.getElementById("inputWish"),
  wishLen:     document.getElementById("wishLen"),
  submitBtn:   document.getElementById("submitBtn"),
  formMessage: document.getElementById("formMessage"),
  // 맛집 상세 모달
  foodModal:    document.getElementById("foodModal"),
  foodEmoji:    document.getElementById("foodEmoji"),
  foodRegion:   document.getElementById("foodRegion"),
  foodName:     document.getElementById("foodName"),
  foodCategory: document.getElementById("foodCategory"),
  foodDesc:     document.getElementById("foodDesc"),
  // 맛집 입력 폼
  foodFormModal:     document.getElementById("foodFormModal"),
  foodForm:          document.getElementById("foodForm"),
  foodInputRegion:   document.getElementById("foodInputRegion"),
  foodInputCategory: document.getElementById("foodInputCategory"),
  foodInputName:     document.getElementById("foodInputName"),
  foodInputDesc:     document.getElementById("foodInputDesc"),
  foodDescLen:       document.getElementById("foodDescLen"),
  foodSubmitBtn:     document.getElementById("foodSubmitBtn"),
  foodFormMessage:   document.getElementById("foodFormMessage"),
};

/* ----- 앱 상태 ----- */
let wishes = [];            // 전체 소원 [{timestamp, age, mbti, wish, region}]
let foods = [];             // 서버에서 불러온 맛집 [{timestamp, region, category, name, desc}]
let localFoods = [];        // 서버 저장 실패 시 이 브라우저에만 저장된 맛집
let mapMode = "wish";       // 지도 모드: "wish"(소원) | "food"(맛집)
let currentView = "intro";  // 현재 뷰
let currentRegionId = null; // 지역 뷰에서 보고 있는 지역
let map = null;             // Leaflet 지도 인스턴스
let markers = {};          // 지역별 마커 캐시
let dataLoaded = false;    // 데이터 최초 로드 여부

const LOCAL_FOODS_KEY = "jeju_local_foods";

// 화면에 보여줄 전체 맛집 = 기본(시드) + 서버 저장분 + 브라우저 저장분
function allFoods() {
  return SEED_FOODS.concat(foods, localFoods);
}

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
  // 데이터가 준비됐으면 마커 갱신 (맛집 모드는 기본 데이터가 있어 바로 표시)
  if (dataLoaded || mapMode === "food") renderMarkers();
}

// 제주도 외곽선(간략화 GeoJSON) — 스타일형 지도의 육지 폴리곤
const JEJU_GEO = {"type":"MultiPolygon","coordinates":[[[[126.2679,33.1243],[126.2704,33.1165],[126.2678,33.1124],[126.2648,33.118],[126.2679,33.1243]]],[[[126.2289,33.4121],[126.2322,33.41],[126.2308,33.406],[126.2225,33.4059],[126.2228,33.4116],[126.2289,33.4121]]],[[[126.9018,33.5153],[126.899,33.5131],[126.8996,33.5097],[126.9096,33.5097],[126.9134,33.5032],[126.9094,33.4954],[126.9114,33.4905],[126.9036,33.4877],[126.902,33.4817],[126.9049,33.4791],[126.9116,33.4794],[126.9116,33.4739],[126.9204,33.4694],[126.9248,33.472],[126.9208,33.4647],[126.9233,33.4555],[126.9282,33.4578],[126.9317,33.464],[126.9279,33.4673],[126.9286,33.4729],[126.9352,33.4736],[126.9355,33.4785],[126.9365,33.4642],[126.9453,33.4596],[126.9462,33.4562],[126.9433,33.4551],[126.9322,33.4602],[126.9224,33.4489],[126.9223,33.4396],[126.9365,33.4292],[126.9294,33.4226],[126.9231,33.4264],[126.9255,33.4299],[126.9239,33.4343],[126.9161,33.4339],[126.918,33.4273],[126.9142,33.4238],[126.9083,33.4064],[126.9027,33.4019],[126.9077,33.3982],[126.9065,33.3915],[126.8835,33.3835],[126.8785,33.3764],[126.8713,33.3722],[126.8735,33.3682],[126.8674,33.3638],[126.8697,33.3618],[126.8684,33.354],[126.8599,33.3469],[126.8566,33.3381],[126.844,33.3328],[126.8448,33.3255],[126.8499,33.325],[126.8484,33.3196],[126.8437,33.319],[126.8358,33.3089],[126.8225,33.3053],[126.8162,33.3076],[126.8078,33.3018],[126.8056,33.3056],[126.7918,33.3027],[126.7778,33.3068],[126.7725,33.3005],[126.7662,33.2985],[126.7647,33.2919],[126.7598,33.2911],[126.7428,33.2777],[126.7333,33.2816],[126.7313,33.2785],[126.7259,33.2793],[126.7213,33.276],[126.7134,33.2762],[126.6995,33.271],[126.6784,33.2707],[126.6776,33.267],[126.6582,33.2739],[126.6607,33.2689],[126.6422,33.2659],[126.6436,33.2617],[126.6402,33.257],[126.6198,33.2497],[126.6183,33.2415],[126.6047,33.2387],[126.5999,33.2345],[126.5858,33.2436],[126.5827,33.2422],[126.5778,33.2448],[126.5688,33.243],[126.5673,33.2399],[126.5712,33.2359],[126.5675,33.2327],[126.5702,33.2357],[126.5617,33.2399],[126.561,33.243],[126.5592,33.2387],[126.5629,33.2383],[126.5642,33.2347],[126.5508,33.2413],[126.5435,33.2386],[126.5402,33.2416],[126.5332,33.2391],[126.5209,33.2409],[126.5105,33.2304],[126.4986,33.2292],[126.497,33.232],[126.4913,33.2325],[126.4772,33.2277],[126.4778,33.2237],[126.4755,33.2231],[126.4615,33.2313],[126.462,33.2373],[126.4571,33.2412],[126.4499,33.2411],[126.4423,33.2371],[126.4382,33.239],[126.4341,33.2349],[126.4293,33.2352],[126.4181,33.2436],[126.4086,33.2446],[126.3865,33.2345],[126.3754,33.2336],[126.3729,33.2297],[126.3671,33.2313],[126.3667,33.2289],[126.3618,33.2371],[126.3603,33.2342],[126.3442,33.2363],[126.3278,33.2318],[126.3354,33.2348],[126.3337,33.2395],[126.3277,33.2408],[126.3164,33.2364],[126.3087,33.2264],[126.3061,33.2279],[126.2979,33.2227],[126.2903,33.2054],[126.2946,33.1968],[126.288,33.1958],[126.2849,33.2005],[126.2756,33.1985],[126.277,33.1965],[126.2722,33.1941],[126.2616,33.199],[126.2646,33.2052],[126.2632,33.2094],[126.256,33.2105],[126.2596,33.2072],[126.2565,33.2074],[126.2511,33.2196],[126.2478,33.2178],[126.241,33.2215],[126.2336,33.2349],[126.2193,33.2429],[126.2025,33.2455],[126.1823,33.2597],[126.1789,33.268],[126.169,33.275],[126.1687,33.2826],[126.1623,33.2866],[126.1609,33.2908],[126.1674,33.2989],[126.1635,33.3066],[126.1684,33.3166],[126.1667,33.3234],[126.1625,33.3246],[126.1625,33.3293],[126.1656,33.3314],[126.1615,33.3341],[126.167,33.3388],[126.1668,33.343],[126.172,33.3427],[126.1687,33.3454],[126.1734,33.3431],[126.1798,33.3463],[126.1829,33.3585],[126.205,33.3684],[126.2061,33.3723],[126.2133,33.375],[126.2146,33.3821],[126.2232,33.39],[126.2346,33.3895],[126.2366,33.3951],[126.2402,33.3944],[126.2427,33.3984],[126.2501,33.401],[126.2488,33.4042],[126.2522,33.409],[126.2587,33.4094],[126.2552,33.4094],[126.2529,33.4158],[126.2558,33.4127],[126.2628,33.4167],[126.2606,33.4231],[126.2578,33.4172],[126.2523,33.4169],[126.2579,33.4176],[126.257,33.4215],[126.2598,33.425],[126.2642,33.4237],[126.2614,33.4342],[126.2631,33.4368],[126.2731,33.4351],[126.2789,33.4423],[126.2996,33.4472],[126.3104,33.4599],[126.3077,33.4658],[126.3128,33.4698],[126.3216,33.4665],[126.3314,33.4695],[126.3381,33.467],[126.3404,33.4707],[126.3508,33.4734],[126.3538,33.4779],[126.3689,33.4784],[126.3857,33.4893],[126.3913,33.4894],[126.3945,33.4841],[126.4006,33.4834],[126.4076,33.4852],[126.4104,33.49],[126.4209,33.4908],[126.42,33.4924],[126.427,33.4959],[126.4281,33.4939],[126.4451,33.4988],[126.4516,33.4973],[126.4536,33.5044],[126.4631,33.5031],[126.4635,33.507],[126.467,33.5057],[126.4662,33.5086],[126.4834,33.5111],[126.4858,33.5175],[126.4942,33.5209],[126.5146,33.5158],[126.5178,33.5195],[126.5319,33.5174],[126.5317,33.5213],[126.5353,33.5198],[126.5428,33.5229],[126.5417,33.5296],[126.5462,33.5245],[126.5534,33.5242],[126.5469,33.5219],[126.55,33.5206],[126.559,33.523],[126.5618,33.5275],[126.5653,33.5242],[126.5692,33.527],[126.5738,33.5253],[126.5748,33.5281],[126.585,33.5254],[126.5902,33.5332],[126.5975,33.5377],[126.6031,33.535],[126.6135,33.5381],[126.6345,33.536],[126.6366,33.5404],[126.634,33.542],[126.6349,33.5452],[126.6393,33.5459],[126.6447,33.5556],[126.6499,33.5533],[126.6481,33.549],[126.6512,33.549],[126.6529,33.5528],[126.6671,33.5428],[126.6743,33.545],[126.6779,33.5525],[126.684,33.5482],[126.6893,33.5484],[126.6993,33.553],[126.7165,33.5536],[126.7194,33.5579],[126.7299,33.5607],[126.7381,33.5548],[126.7455,33.5557],[126.7393,33.5575],[126.7403,33.5598],[126.7572,33.557],[126.7619,33.5588],[126.762,33.5654],[126.7654,33.566],[126.7748,33.565],[126.7747,33.5611],[126.7791,33.5661],[126.7837,33.5649],[126.7981,33.5553],[126.8136,33.5614],[126.8276,33.5594],[126.8257,33.5544],[126.8296,33.551],[126.8272,33.5478],[126.8287,33.5432],[126.8365,33.5394],[126.8408,33.5336],[126.8517,33.5322],[126.8613,33.5249],[126.8714,33.5307],[126.8928,33.5269],[126.9059,33.5207],[126.9012,33.5181],[126.9018,33.5153]]]]};

function initMap() {
  map = L.map(el.mapEl, {
    center: [33.37, 126.55],
    zoom: 10,
    minZoom: 9,
    maxZoom: 14,
    zoomControl: false,          // 기본 위치(좌상단) 대신 아래에서 좌하단으로 배치
    attributionControl: true,
  });

  // 확대/축소 버튼을 왼쪽 아래로 (상단 "언젠가, 제주" 브랜드와 겹치지 않도록)
  L.control.zoom({ position: "bottomleft" }).addTo(map);

  // 바다가 파란색으로 보이는 밝은 타일(Voyager). 인터넷 필요.
  // (타일이 아직 안 뜬 영역의 바다는 CSS의 .leaflet-container 배경색으로 보임)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: "abcd",
  }).addTo(map);

  // 제주도 밖으로 너무 벗어나지 않도록 범위 제한
  map.setMaxBounds([[33.0, 126.0], [33.75, 127.1]]);
}

/* ----- 소원 지도 ↔ 맛집 지도 전환 ----- */
function setMode(mode) {
  if (mapMode === mode) return;
  mapMode = mode;

  // 스위치 버튼 활성 표시
  document.querySelectorAll(".mode-switch__btn").forEach(b => {
    b.classList.toggle("is-on", b.dataset.mode === mode);
  });

  // 제목/설명/FAB 문구 교체
  if (mode === "wish") {
    el.mapTitle.textContent = "제주 소원 지도";
    el.mapSub.textContent = "지역을 누르면 그곳에 쌓인 소원을 볼 수 있어요. 숫자는 소원 개수예요.";
    el.fabLabel.textContent = "소원 남기기";
  } else {
    el.mapTitle.textContent = "제주 맛집 지도";
    el.mapSub.textContent = "지역을 누르면 그곳의 맛집을 볼 수 있어요. 숫자는 맛집 개수예요.";
    el.fabLabel.textContent = "맛집 추가하기";
  }
  document.body.dataset.mode = mode;

  if (map) renderMarkers();
}

// 지역별 개수를 세어 마커(뱃지) 생성/갱신 — 현재 모드 기준
function renderMarkers() {
  const counts = countByRegion(mapMode === "wish" ? wishes : allFoods());
  const foodCls = mapMode === "food" ? " pin--food" : "";

  REGIONS.forEach(region => {
    const count = counts[region.name] || 0;
    const zero = count === 0 ? " is-zero" : "";
    const html =
      `<div class="pin${foodCls}">
         <span class="pin__count${zero}">${count}</span>
         <span class="pin__name">${region.name}</span>
       </div>`;

    if (markers[region.id]) {
      // 이미 있으면 아이콘만 교체 (개수/모드 갱신)
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

// 지역 이름별 개수 집계 (소원/맛집 공용)
function countByRegion(list) {
  const counts = {};
  list.forEach(w => {
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

  // 지역 테마 배경 일러스트 교체
  el.regionBg.src = "assets/region-" + region.id + ".svg";

  // 기존 카드 비우기 (빈 상태 요소는 유지)
  el.orchard.querySelectorAll(".wish-card").forEach(c => c.remove());

  if (mapMode === "wish") renderRegionWishes(region);
  else renderRegionFoods(region);
}

// 지역 페이지 — 소원 모드
function renderRegionWishes(region) {
  const list = wishes.filter(w => (w.region || "").trim() === region.name);
  el.regionCount.textContent = list.length;
  el.regionCountSuffix.textContent = "개의 소원이 맺혔어요";

  if (list.length === 0) {
    el.regionEmpty.innerHTML = "<p>🌱 아직 이 지역엔 소원이 없어요.<br />첫 소원을 남겨보세요.</p>";
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

// 지역 페이지 — 맛집 모드
function renderRegionFoods(region) {
  const list = allFoods().filter(f => (f.region || "").trim() === region.name);
  el.regionCount.textContent = list.length;
  el.regionCountSuffix.textContent = "곳의 맛집이 있어요";

  if (list.length === 0) {
    el.regionEmpty.innerHTML = "<p>🍳 아직 등록된 맛집이 없어요.<br />첫 맛집을 추가해보세요.</p>";
    el.regionEmpty.classList.remove("is-hidden");
    return;
  }
  el.regionEmpty.classList.add("is-hidden");

  // 최신 등록이 위로 (시드는 원래 순서 유지되도록 reverse 전체 적용)
  list.slice().reverse().forEach((item, i) => {
    const cat = CATEGORY_BY_NAME[item.category] || { name: item.category || "기타", emoji: "🍽️" };
    const card = document.createElement("button");
    card.type = "button";
    card.className = "wish-card wish-card--food";
    card.style.animationDelay = (i % 10) * 0.04 + "s";
    card.innerHTML =
      `<div class="wish-card__fruit">${cat.emoji}</div>
       <div class="wish-card__text">${escapeHtml(item.name)}</div>
       <div class="wish-card__desc">${escapeHtml(item.desc || "")}</div>
       <div class="wish-card__meta wish-card__meta--food">${escapeHtml(cat.name)}</div>`;
    card.addEventListener("click", () => openFoodModal(item, region));
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

/* ----- 맛집 불러오기 (doGet?type=food) ----- */
async function loadFoods() {
  // 이 브라우저에만 저장해 둔 맛집 복원
  try {
    localFoods = JSON.parse(localStorage.getItem(LOCAL_FOODS_KEY)) || [];
  } catch (e) { localFoods = []; }

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL === "여기에_배포_URL") return;
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?type=food", { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    // 구버전 백엔드는 type을 몰라 소원 배열을 돌려줌 → name 필드가 있는 항목만 맛집으로 인정
    foods = Array.isArray(data) ? data.filter(x => x && x.name) : [];
    if (map && mapMode === "food") renderMarkers();
    if (currentView === "region" && mapMode === "food") enterRegion(currentRegionId);
  } catch (err) {
    console.warn("맛집 불러오기 실패(기본 맛집만 표시):", err);
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

/* ----- 맛집 제출 ----- */
async function onFoodSubmit(e) {
  e.preventDefault();

  const payload = {
    type:     "food",
    region:   el.foodInputRegion.value.trim(),
    category: el.foodInputCategory.value.trim(),
    name:     el.foodInputName.value.trim(),
    desc:     el.foodInputDesc.value.trim(),
  };
  if (!payload.region || !payload.category || !payload.name || !payload.desc) {
    showFoodFormMessage("모든 칸을 채워주세요.", "error");
    return;
  }

  el.foodSubmitBtn.disabled = true;
  el.foodSubmitBtn.textContent = "맛집 찍는 중…";
  el.foodFormMessage.classList.add("is-hidden");

  const entry = {
    timestamp: new Date().toISOString(),
    region: payload.region, category: payload.category,
    name: payload.name, desc: payload.desc,
  };

  try {
    const result = await submitWish(payload); // 같은 웹앱 URL로 POST (type으로 구분)
    if (result && result.result === "success") {
      foods.push(entry); // 낙관적 업데이트
    } else {
      throw new Error("서버 응답 오류");
    }
  } catch (err) {
    // 서버가 아직 맛집을 모르는 구버전이거나 통신 실패 → 이 브라우저에만 저장
    console.warn("맛집 서버 저장 실패, 브라우저에 저장:", err);
    localFoods.push(entry);
    try { localStorage.setItem(LOCAL_FOODS_KEY, JSON.stringify(localFoods)); } catch (e2) {}
  } finally {
    el.foodSubmitBtn.disabled = false;
    el.foodSubmitBtn.textContent = "맛집 콕! 찍기";
  }

  if (map) renderMarkers();
  el.foodForm.reset();
  el.foodDescLen.textContent = "0";
  closeModals();

  // 방금 추가한 지역으로 이동해 보여줌
  const region = REGION_BY_NAME[payload.region];
  if (region) go("region", region.id);
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
function openFoodModal(item, region) {
  const cat = CATEGORY_BY_NAME[item.category] || { name: item.category || "기타", emoji: "🍽️" };
  el.foodEmoji.textContent = cat.emoji;
  el.foodRegion.textContent = region ? region.name : (item.region || "");
  el.foodName.textContent = item.name;
  el.foodCategory.textContent = cat.name;
  el.foodDesc.textContent = item.desc || "";
  el.foodModal.classList.remove("is-hidden");
}
function openFoodFormModal() {
  el.foodFormMessage.classList.add("is-hidden");
  if (currentView === "region" && currentRegionId) {
    const r = REGIONS.find(x => x.id === currentRegionId);
    if (r) el.foodInputRegion.value = r.name;
  }
  el.foodFormModal.classList.remove("is-hidden");
}
function closeModals() {
  el.wishModal.classList.add("is-hidden");
  el.formModal.classList.add("is-hidden");
  el.foodModal.classList.add("is-hidden");
  el.foodFormModal.classList.add("is-hidden");
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
function showFoodFormMessage(text, type) {
  el.foodFormMessage.textContent = text;
  el.foodFormMessage.className = "form__message " + (type === "error" ? "is-error" : "is-success");
  el.foodFormMessage.classList.remove("is-hidden");
}
function fillSelectOptions() {
  REGIONS.forEach(r => {
    el.inputRegion.appendChild(new Option(r.name, r.name));
    el.foodInputRegion.appendChild(new Option(r.name, r.name));
  });
  MBTI_TYPES.forEach(t => el.inputMbti.appendChild(new Option(t, t)));
  FOOD_CATEGORIES.forEach(c => el.foodInputCategory.appendChild(new Option(c.emoji + " " + c.name, c.name)));
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
  // 플로팅 버튼 → 현재 모드에 맞는 입력 폼
  el.openFormBtn.addEventListener("click", () => {
    if (mapMode === "food") openFoodFormModal();
    else openFormModal();
  });

  // 소원 지도 ↔ 맛집 지도 스위치
  document.querySelectorAll(".mode-switch__btn").forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  document.querySelectorAll("[data-close]").forEach(n => n.addEventListener("click", closeModals));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });

  el.inputWish.addEventListener("input", () => { el.wishLen.textContent = el.inputWish.value.length; });
  el.wishForm.addEventListener("submit", onSubmit);
  el.foodInputDesc.addEventListener("input", () => { el.foodDescLen.textContent = el.foodInputDesc.value.length; });
  el.foodForm.addEventListener("submit", onFoodSubmit);
}

/* =========================================================
   9. 시작
   ========================================================= */
function init() {
  document.body.dataset.view = "intro";   // 초기 뷰 표시
  document.body.dataset.mode = "wish";    // 초기 지도 모드
  fillSelectOptions();
  bindEvents();
  loadWishes();   // 시작하자마자 데이터 로드 (지도 열면 바로 보이도록)
  loadFoods();    // 맛집 데이터도 함께 로드
}
document.addEventListener("DOMContentLoaded", init);
