/**
 * 初期設定。GASエディタで LB_setup を1回実行する。
 * スプレッドシートを作り（すでにあれば見出しを確認するだけ）、30分ごとの起票し直しのトリガーを設定する。
 */

const LB_HEADERS = {
  '報告': ['報告ID', '送信日時', '報告日', 'メール', '報告者', '部署', '書式', 'テスト', '日報', '日報JSON', '相談件数'],
  '相談': ['相談ID', '報告ID', '送信日時', '報告日', '報告者', 'メール', '部署', '種類', '何を決めてほしいか', '相手先・件名',
           '背景・事実', '期限（入力）', '期限（設定）', '仮期限', '資料', '起票先', '状態', 'TodoistタスクID', 'TodoistURL',
           '日報コメント', '試行回数', '最終試行', 'エラー', '失敗通知', '完了'],
  '会社休日': ['日付', 'メモ']
};

function LB_setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const id = props.getProperty('LB_SHEET_ID');
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.create('LANDEX BEACON データ');
    props.setProperty('LB_SHEET_ID', ss.getId());
  }

  Object.keys(LB_HEADERS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = LB_HEADERS[name];
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
      sh.setFrozenRows(1);
      // 日付などが勝手に変換されないよう、会社休日以外は文字列で保存する
      if (name !== '会社休日') sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@');
    } else {
      // 新しい版で増えた見出しは右端に足す
      const now = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      head.forEach(function (h) {
        if (now.indexOf(h) >= 0) return;
        const col = sh.getLastColumn() + 1;
        sh.getRange(1, col).setValue(h).setFontWeight('bold');
        sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat('@');
      });
    }
  });
  const blank = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'LB_retryFailed') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('LB_retryFailed').timeBased().everyMinutes(LB_RETRY.INTERVAL_MIN).create();

  if (!props.getProperty('LB_MODE')) props.setProperty('LB_MODE', 'test');
  console.log('設定完了：' + ss.getUrl() + '（モード：' + props.getProperty('LB_MODE') + '）');
}

/** 設定の確認。トークン・起票先・祝日判定を試す（Todoistには何も書き込まない） */
function LB_checkSetup() {
  const me = LB_todoist_('get', '/user');
  console.log('Todoist：' + me.full_name + '（ID ' + me.id + '）');
  if (String(me.id) !== LB_BOSS.todoistId) console.warn('トークンが藤本さんのものではありません');
  Object.keys(LB_ROUTES).forEach(function (k) {
    const r = LB_ROUTES[k];
    const inbox = LB_todoist_('get', '/sections/' + r.sectionId);
    const ans = LB_todoist_('get', '/sections/' + r.answeredId);
    const ok = inbox.project_id === r.projectId && ans.project_id === r.projectId;
    console.log((ok ? 'OK ' : 'NG ') + r.project + '：' + inbox.name + '／' + ans.name);
  });
  console.log('今日の翌営業日：' + LB_nextBusinessDay_(new Date()));
  console.log('モード：' + (LB_isLive_() ? '本番（live）' : 'テスト'));
}
