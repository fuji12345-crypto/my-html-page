/**
 * 起票に失敗した相談を自動で起票し直す。30分ごとのトリガーで動く（LB_setup で設定）。
 * 送信時の1回を含めて LB_RETRY.MAX_ATTEMPTS 回失敗したら、藤本さんにメールで知らせる。
 */
function LB_retryFailed() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // 前回の処理がまだ動いている
  try {
    const cs = LB_sheet_(LB_SHEETS.CONSULTS);
    if (cs.getLastRow() < 2) return;
    const idx = LB_headerIndex_(cs);
    const rows = cs.getRange(2, 1, cs.getLastRow() - 1, cs.getLastColumn()).getDisplayValues();
    const staleBefore = LB_fmt_(new Date(Date.now() - LB_RETRY.STALE_MIN * 60000), 'yyyy-MM-dd HH:mm:ss');
    const giveUp = [];

    rows.forEach(function (r, i) {
      const get = function (h) { return r[idx[h] - 1]; };
      const rowNum = i + 2;
      const state = get('状態');
      const attempts = Number(get('試行回数') || 0);
      const needsTask = state === '起票失敗' || (state === '起票待ち' && get('送信日時') < staleBefore);
      const needsComment = (state === '起票済' || state === '要確認') && get('日報コメント') === '失敗';
      // 起票はできたが列が📥社長がやるになっていないもの。自動では直さず知らせる
      if (state === '要確認' && !needsComment && get('失敗通知') !== '済') {
        giveUp.push({ row: rowNum, c: LB_rowObject_(cs, rowNum) });
        return;
      }
      if (!needsTask && !needsComment) return;

      if (attempts < LB_RETRY.MAX_ATTEMPTS) {
        LB_processConsult_(cs, rowNum);
      }
      const after = LB_rowObject_(cs, rowNum);
      const stillBad = after['状態'] === '起票失敗' || after['日報コメント'] === '失敗';
      if (stillBad && Number(after['試行回数']) >= LB_RETRY.MAX_ATTEMPTS && after['失敗通知'] !== '済') {
        giveUp.push({ row: rowNum, c: after });
      }
    });

    if (giveUp.length) {
      LB_notifyFailures_(giveUp);
      giveUp.forEach(function (g) { LB_updateRow_(cs, g.row, { '失敗通知': '済' }); });
    }
  } finally {
    lock.releaseLock();
  }
}

function LB_notifyFailures_(items) {
  const url = SpreadsheetApp.openById(LB_prop_('LB_SHEET_ID')).getUrl();
  const body = [
    'BEACONからTodoistへの起票で、うまくいかなかった相談があります。',
    '報告はスプレッドシートに保存されています。原因を直したあと、「相談」シートの該当行の「試行回数」を 0 にすると、30分以内にもう一度起票します。',
    ''
  ];
  items.forEach(function (g) {
    const c = g.c;
    body.push('■ ' + c['相談ID'] + '　' + c['報告者'] + 'さん（' + c['部署'] + '）');
    body.push('　' + LB_taskContent_(c));
    if (c['TodoistURL']) body.push('　' + c['TodoistURL']);
    body.push('　状態：' + c['状態'] + (c['日報コメント'] === '失敗' ? '（日報のコメントが付いていません）' : ''));
    body.push('　エラー：' + c['エラー']);
    body.push('');
  });
  body.push('スプレッドシート：' + url);
  MailApp.sendEmail({
    to: LB_BOSS.email,
    subject: '【BEACON】Todoistへの起票を確認してください（' + items.length + '件）',
    body: body.join('\n')
  });
}
