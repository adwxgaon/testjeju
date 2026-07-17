/**
 * =========================================================
 * 언젠가, 제주 — Google Apps Script 백엔드 (Code.gs)
 * ---------------------------------------------------------
 * · 스프레드시트를 간단한 데이터베이스처럼 사용합니다.
 * · doGet  : 저장된 모든 소원을 JSON 배열로 반환
 * · doPost : 새 소원을 스프레드시트에 한 행 추가
 *
 * [스프레드시트 컬럼 구조 — 첫 행은 헤더]
 *   A: 타임스탬프 | B: 나이 | C: MBTI | D: 소원 | E: 지역
 *   ※ 리디자인 버전에서 E열(지역)이 추가되었습니다.
 *     기존 시트를 쓰던 경우, E1 셀에 "지역" 헤더만 추가하면 됩니다.
 *     (기존 행들은 지역이 비어 있어 지도에서 '미분류'로 빠집니다.)
 *
 * ※ 이 코드는 doPost로 받은 데이터를 e.postData.contents 로
 *    읽어 JSON.parse 합니다. 프론트에서 Content-Type을
 *    'text/plain;charset=utf-8' 로 보내는 이유는, 브라우저가
 *    application/json POST 앞에 CORS preflight(OPTIONS) 요청을
 *    보내는데 Apps Script가 이를 처리하지 못해 막히기 때문입니다.
 *    text/plain 으로 보내면 preflight 없이 바로 전송됩니다.
 * =========================================================
 */

// 데이터가 저장될 시트 이름 (기본 시트명이 "시트1" 또는 "Sheet1")
// 필요하면 아래 이름을 실제 시트 탭 이름으로 바꾸세요.
var SHEET_NAME = "시트1";

// 맛집이 저장될 시트 이름 (없으면 자동으로 만들어집니다)
// [맛집 시트 컬럼 구조 — 첫 행은 헤더]
//   A: 타임스탬프 | B: 지역 | C: 카테고리 | D: 가게이름 | E: 소개
var FOOD_SHEET_NAME = "맛집";

/**
 * 작업할 시트를 가져옵니다.
 * 지정한 이름의 시트가 없으면 현재 활성 시트를 사용합니다.
 */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0]; // 첫 번째 시트로 대체
  }
  return sheet;
}

/**
 * 맛집 시트를 가져옵니다. 없으면 헤더와 함께 새로 만듭니다.
 */
function getFoodSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(FOOD_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(FOOD_SHEET_NAME);
    sheet.appendRow(["타임스탬프", "지역", "카테고리", "가게이름", "소개"]);
  }
  return sheet;
}

/**
 * JSON 문자열을 HTTP 응답으로 만들어 반환하는 헬퍼.
 * (Apps Script는 응답 MIME 타입을 JSON으로 지정할 수 있습니다.)
 */
function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ---------------------------------------------------------
 * doGet — 저장된 모든 소원을 JSON 배열로 반환
 * ---------------------------------------------------------
 * 반환 예:
 *   [
 *     { "timestamp": "...", "age": "24", "mbti": "INFJ", "wish": "..." },
 *     ...
 *   ]
 */
function doGet(e) {
  try {
    // ?type=food → 맛집 목록 반환
    if (e && e.parameter && e.parameter.type === "food") {
      var foodSheet = getFoodSheet_();
      var foodValues = foodSheet.getDataRange().getValues();
      var foodList = [];
      for (var j = 1; j < foodValues.length; j++) {
        var fRow = foodValues[j];
        if (!fRow[3]) continue; // 가게이름(D열)이 빈 행은 건너뜀
        foodList.push({
          timestamp: fRow[0], // A열: 타임스탬프
          region:    fRow[1], // B열: 지역
          category:  fRow[2], // C열: 카테고리
          name:      fRow[3], // D열: 가게이름
          desc:      fRow[4], // E열: 소개
        });
      }
      return jsonOutput_(foodList);
    }

    var sheet = getSheet_();
    var values = sheet.getDataRange().getValues(); // 전체 셀 값 (2차원 배열)

    var list = [];
    // i = 1 부터 시작 → 0번째(헤더 행)는 건너뜀
    for (var i = 1; i < values.length; i++) {
      var row = values[i];

      // 소원(D열)이 비어 있는 행은 건너뜀
      if (!row[3]) continue;

      list.push({
        timestamp: row[0], // A열: 타임스탬프
        age:       row[1], // B열: 나이
        mbti:      row[2], // C열: MBTI
        wish:      row[3], // D열: 소원
        region:    row[4], // E열: 지역 (없으면 빈 값)
      });
    }

    return jsonOutput_(list);
  } catch (err) {
    // 에러가 나도 JSON 형태로 반환 (프론트에서 처리 가능)
    return jsonOutput_({ result: "error", message: String(err) });
  }
}

/**
 * ---------------------------------------------------------
 * doPost — 새 소원을 스프레드시트에 추가
 * ---------------------------------------------------------
 * 프론트에서 보낸 body(JSON 문자열)를 파싱해서
 *   [타임스탬프, 나이, MBTI, 소원] 한 행을 추가합니다.
 * 성공 시 { "result": "success" } 를 반환합니다.
 */
function doPost(e) {
  try {
    // 프론트가 text/plain 으로 보낸 JSON 문자열을 파싱
    var data = JSON.parse(e.postData.contents);

    // type이 "food"면 맛집 시트에 저장
    if (data.type === "food") {
      var foodName = data.name || "";
      if (!foodName) {
        return jsonOutput_({ result: "error", message: "가게 이름이 비어 있습니다." });
      }
      getFoodSheet_().appendRow([
        new Date(), data.region || "", data.category || "", foodName, data.desc || "",
      ]);
      return jsonOutput_({ result: "success" });
    }

    var age    = data.age    || "";
    var mbti   = data.mbti   || "";
    var wish   = data.wish   || "";
    var region = data.region || "";

    // 소원이 비어 있으면 저장하지 않음
    if (!wish) {
      return jsonOutput_({ result: "error", message: "소원 내용이 비어 있습니다." });
    }

    var sheet = getSheet_();
    // 새 행 추가: [타임스탬프(현재시각), 나이, MBTI, 소원, 지역]
    sheet.appendRow([new Date(), age, mbti, wish, region]);

    return jsonOutput_({ result: "success" });
  } catch (err) {
    return jsonOutput_({ result: "error", message: String(err) });
  }
}
