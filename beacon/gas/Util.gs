/** 日付・休日・シート操作の小物 */

function LB_fmt_(date, pattern) {
  return Utilities.formatDate(date, 'Asia/Tokyo', pattern);
}

/** 'YYYY-MM-DD' → その日の0時(JST)の Date */
function LB_parseYmd_(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return LB_fmt_(d, 'yyyy-MM-dd') === ymd ? d : null;
}

/** 会社休日シート（A列に日付）と日本の祝日カレンダーから休日の集合を作る */
function LB_holidaySet_(from, days) {
  const set = {};
  const to = new Date(from.getTime() + days * 86400000);
  try {
    const cal = CalendarApp.getCalendarById(LB_JP_HOLIDAY_CAL);
    if (cal) cal.getEvents(from, to).forEach(function (e) { set[LB_fmt_(e.getStartTime(), 'yyyy-MM-dd')] = true; });
  } catch (err) {
    console.warn('祝日カレンダーを読めませんでした: ' + err);
  }
  const sh = LB_sheet_(LB_SHEETS.HOLIDAYS);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      if (r[0] instanceof Date) set[LB_fmt_(r[0], 'yyyy-MM-dd')] = true;
    });
  }
  return set;
}

/** 翌営業日（土日・祝日・会社休日を除く）を 'YYYY-MM-DD' で返す */
function LB_nextBusinessDay_(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const holidays = LB_holidaySet_(base, 40);
  const d = new Date(base);
  for (let i = 0; i < 40; i++) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    const ymd = LB_fmt_(d, 'yyyy-MM-dd');
    if (wd !== 0 && wd !== 6 && !holidays[ymd]) return ymd;
  }
  throw new Error('翌営業日を決められませんでした');
}

function LB_sheet_(name) {
  const id = LB_prop_('LB_SHEET_ID');
  if (!id) throw new Error('スプレッドシートが未設定です。LB_setup を実行してください');
  const sh = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。LB_setup を実行してください');
  return sh;
}

/** 数式として解釈されないようにする（= + - @ で始まる文字列の先頭に ' を付ける） */
function LB_safeCell_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

/** シートの見出し行から {見出し: 列番号(1始まり)} を作る */
function LB_headerIndex_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = {};
  head.forEach(function (h, i) { idx[h] = i + 1; });
  return idx;
}

/** 見出し名をキーにしたオブジェクトを1行として追記する */
function LB_appendRow_(sh, obj) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = head.map(function (h) { return obj[h] === undefined ? '' : LB_safeCell_(obj[h]); });
  const rowNum = sh.getLastRow() + 1;
  if (rowNum > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 50);
  // 日付や数字が勝手に変換されないよう文字列として保存する
  sh.getRange(rowNum, 1, 1, row.length).setNumberFormat('@').setValues([row]);
  return rowNum;
}

/** 指定行の指定見出しの値を書き換える */
function LB_updateRow_(sh, rowNum, obj) {
  const idx = LB_headerIndex_(sh);
  Object.keys(obj).forEach(function (k) {
    if (!idx[k]) throw new Error('見出し「' + k + '」がありません');
    sh.getRange(rowNum, idx[k]).setValue(LB_safeCell_(obj[k]));
  });
}

function LB_escapeHtml_(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
