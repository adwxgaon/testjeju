/**
 * =========================================================
 * 언젠가, 제주 — Google Apps Script 백엔드 (Code.gs)
 * ---------------------------------------------------------
 * · 스프레드시트를 간단한 데이터베이스처럼 사용합니다.
 * · doGet  : 저장된 모든 소원을 JSON 배열로 반환
 * · doPost : 새 소원을 스프레드시트에 한 행 추가
 *
 * [스프레드시트 컬럼 구조 — 첫 행은 헤더]
 *   A: 타임스탬프 | B: 나이 | C: MBTI | D: 소원
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

    var age  = data.age  || "";
    var mbti = data.mbti || "";
    var wish = data.wish || "";

    // 소원이 비어 있으면 저장하지 않음
    if (!wish) {
      return jsonOutput_({ result: "error", message: "소원 내용이 비어 있습니다." });
    }

    var sheet = getSheet_();
    // 새 행 추가: [타임스탬프(현재시각), 나이, MBTI, 소원]
    sheet.appendRow([new Date(), age, mbti, wish]);

    return jsonOutput_({ result: "success" });
  } catch (err) {
    return jsonOutput_({ result: "error", message: String(err) });
  }
}
