/** 報告の受付・保存・Todoistへの起票 */

const LB_MAX_LEN = 5000;

/**
 * 画面から呼ばれる。報告を保存し、相談を1件ずつTodoistに起票する。
 * payload: { asKey, daily: {id: text}, progress: [{name, body}], consults: [{kind, what, to, bg, due, link}] }
 */
function LB_submitReport(payload) {
  const user = LB_currentUser_();
  if (!user.allowed) throw new Error(user.message);

  const reporter = user.isBoss ? LB_personByKey_(payload && payload.asKey) : user.person;
  if (!reporter) throw new Error('テストする報告者を選んでください');
  const routeKey = user.isBoss ? 'test' : reporter.route;
  const form = LB_FORMS[reporter.form];

  const clean = LB_validate_(payload, form);
  const now = new Date();
  const reportDate = LB_fmt_(now, 'yyyy-MM-dd');
  const dailyText = LB_dailyText_(form, clean);
  const defaultDue = clean.consults.some(function (c) { return c.kind !== '共有のみ' && !c.due; })
    ? LB_nextBusinessDay_(now) : '';

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let reportId;
  const consultRows = [];
  try {
    const rs = LB_sheet_(LB_SHEETS.REPORTS);
    reportId = LB_newReportId_(rs, now);
    LB_appendRow_(rs, {
      '報告ID': reportId,
      '送信日時': LB_fmt_(now, 'yyyy-MM-dd HH:mm:ss'),
      '報告日': reportDate,
      'メール': user.email,
      '報告者': reporter.name,
      '部署': reporter.dept,
      '書式': form.label,
      'テスト': routeKey === 'test' ? 'TRUE' : '',
      '日報': dailyText,
      '日報JSON': JSON.stringify({ daily: clean.daily, progress: clean.progress }),
      '相談件数': clean.consults.length
    });

    const cs = LB_sheet_(LB_SHEETS.CONSULTS);
    clean.consults.forEach(function (c, i) {
      const share = c.kind === '共有のみ';
      const row = LB_appendRow_(cs, {
        '相談ID': reportId + '-' + (i + 1),
        '報告ID': reportId,
        '送信日時': LB_fmt_(now, 'yyyy-MM-dd HH:mm:ss'),
        '報告日': reportDate,
        '報告者': reporter.name,
        'メール': user.email,
        '部署': reporter.dept,
        '種類': c.kind,
        '何を決めてほしいか': c.what,
        '相手先・件名': c.to,
        '背景・事実': c.bg,
        '期限（入力）': c.due,
        '期限（設定）': share ? '' : (c.due || defaultDue),
        '仮期限': !share && !c.due ? 'TRUE' : '',
        '資料': c.link,
        '起票先': share ? '' : routeKey,
        '状態': share ? '共有のみ' : '起票待ち',
        '試行回数': 0
      });
      consultRows.push(row);
    });
  } finally {
    lock.releaseLock();
  }

  const cs = LB_sheet_(LB_SHEETS.CONSULTS);
  const results = consultRows.map(function (row) { return LB_processConsult_(cs, row); });
  return { reportId: reportId, results: results };
}

function LB_validate_(payload, form) {
  payload = payload || {};
  const cut = function (s) { return String(s == null ? '' : s).trim().slice(0, LB_MAX_LEN); };
  const daily = {};
  form.fields.forEach(function (f) { daily[f.id] = cut((payload.daily || {})[f.id]); });
  const progress = form.progress
    ? (payload.progress || []).map(function (p) { return { name: cut(p.name), body: cut(p.body) }; })
        .filter(function (p) { return p.name || p.body; })
    : [];
  const consults = (payload.consults || []).map(function (c, i) {
    const n = i + 1;
    const out = { kind: cut(c.kind), what: cut(c.what).replace(/\s*\n\s*/g, ' '), to: cut(c.to).replace(/\s*\n\s*/g, ' '),
                  bg: cut(c.bg), due: cut(c.due), link: cut(c.link) };
    if (LB_KINDS.indexOf(out.kind) < 0) throw new Error('相談' + n + 'の種類を選んでください');
    if (!out.what) throw new Error('相談' + n + 'の「何を決めてほしいか」が空です');
    if (out.due && !LB_parseYmd_(out.due)) throw new Error('相談' + n + 'の期限の日付が正しくありません');
    if (out.link && !/^https:\/\//.test(out.link)) throw new Error('相談' + n + 'の資料のリンクは https:// で始まるURLにしてください');
    return out;
  });
  const hasDaily = Object.keys(daily).some(function (k) { return daily[k]; }) || progress.length;
  if (!hasDaily && !consults.length) throw new Error('日報か相談のどちらかを書いてください');
  return { daily: daily, progress: progress, consults: consults };
}

/** 日報を、今のメール報告と同じ【見出し】形式の文章にする */
function LB_dailyText_(form, clean) {
  const parts = [];
  form.fields.forEach(function (f) {
    if (clean.daily[f.id]) parts.push('【' + f.t + '】\n' + clean.daily[f.id]);
  });
  if (form.progress && clean.progress.length) {
    parts.push('【' + form.progress.t + '】\n' + clean.progress.map(function (p) {
      return '■' + (p.name || '（案件名なし）') + (p.body ? '\n' + p.body : '');
    }).join('\n'));
  }
  return parts.join('\n\n');
}

function LB_newReportId_(sh, now) {
  const prefix = 'R' + LB_fmt_(now, 'yyyyMMdd') + '-';
  let max = 0;
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const v = String(r[0]);
      if (v.indexOf(prefix) === 0) max = Math.max(max, Number(v.slice(prefix.length)) || 0);
    });
  }
  return prefix + ('00' + (max + 1)).slice(-3);
}

function LB_rowObject_(sh, rowNum) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const vals = sh.getRange(rowNum, 1, 1, head.length).getDisplayValues()[0];
  const o = {};
  head.forEach(function (h, i) { o[h] = vals[i]; });
  return o;
}

function LB_findReport_(reportId) {
  const rs = LB_sheet_(LB_SHEETS.REPORTS);
  const ids = rs.getRange(2, 1, Math.max(rs.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === reportId) return LB_rowObject_(rs, i + 2);
  }
  return null;
}

function LB_taskContent_(c) {
  return (c['相手先・件名'] ? '[' + c['相手先・件名'] + '] ' : '') + c['何を決めてほしいか'] + '（' + c['報告者'] + 'さん）';
}

function LB_taskDescription_(c) {
  const ymdSlash = function (s) { return s.replace(/-/g, '/'); };
  const due = ymdSlash(c['期限（設定）']) + (c['仮期限'] === 'TRUE' ? '（報告に期限の記載なし → 仮期限）' : '');
  const lines = [
    '【何を判断するか／担当：藤本さん】', c['何を決めてほしいか'], '',
    '【種類】', c['種類'], '',
    '【背景】', c['背景・事実'] || '（記載なし）', '',
    '【誰に返すか】', c['報告者'] + 'さん', '',
    '【期限】', due, ''
  ];
  if (c['資料']) lines.push('【資料】', c['資料'], '');
  lines.push('【出典】', 'BEACON ' + ymdSlash(c['報告日']) + ' ' + c['報告者'] + '（報告ID ' + c['報告ID'] + '）', 'この日の日報はコメント欄にあります');
  return lines.join('\n');
}

/**
 * 相談1件をTodoistに起票し、その日の日報をコメントに付ける。
 * 送信時と、自動の起票し直し（LB_retryFailed）の両方から呼ばれる。
 */
function LB_processConsult_(cs, rowNum) {
  const c = LB_rowObject_(cs, rowNum);
  const attempts = Number(c['試行回数'] || 0) + 1;
  const result = { consultId: c['相談ID'], what: c['何を決めてほしいか'], kind: c['種類'] };
  if (c['状態'] === '共有のみ') return Object.assign(result, { status: '共有のみ' });

  const route = LB_ROUTES[c['起票先']];
  let taskId = c['TodoistタスクID'];
  try {
    if (!route) throw new Error('起票先「' + c['起票先'] + '」が設定にありません');
    if (!taskId) {
      const created = LB_createConsultTask_(route, {
        content: LB_taskContent_(c),
        description: LB_taskDescription_(c),
        dueDate: c['期限（設定）']
      }, c['相談ID']);
      taskId = created.id;
      LB_updateRow_(cs, rowNum, {
        'TodoistタスクID': taskId, 'TodoistURL': LB_taskUrl_(taskId),
        '状態': created.misplaced ? '要確認' : '起票済', 'エラー': created.note
      });
    }
    if (c['日報コメント'] !== '済') {
      const report = LB_findReport_(c['報告ID']);
      if (report && report['日報']) {
        LB_addComment_(taskId, '【BEACON日報 ' + c['報告日'].replace(/-/g, '/') + ' ' + c['報告者'] + '】\n\n' + report['日報'], c['相談ID'] + '-daily');
        LB_updateRow_(cs, rowNum, { '日報コメント': '済' });
      } else {
        LB_updateRow_(cs, rowNum, { '日報コメント': '日報なし' });
      }
    }
    LB_updateRow_(cs, rowNum, { '試行回数': attempts, '最終試行': LB_fmt_(new Date(), 'yyyy-MM-dd HH:mm:ss') });
    if (c['状態'] === '起票失敗') LB_updateRow_(cs, rowNum, { '状態': '起票済', 'エラー': '' });
    return Object.assign(result, { status: '起票済', url: LB_taskUrl_(taskId) });
  } catch (err) {
    const msg = String(err && err.message || err).slice(0, 500);
    console.error('Todoistへの書き込み失敗 ' + c['相談ID'] + ': ' + msg);
    LB_updateRow_(cs, rowNum, {
      '状態': taskId ? (c['状態'] === '要確認' ? '要確認' : '起票済') : '起票失敗',
      '日報コメント': taskId ? '失敗' : c['日報コメント'],
      '試行回数': attempts,
      '最終試行': LB_fmt_(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      'エラー': msg
    });
    if (taskId) return Object.assign(result, { status: '起票済', url: LB_taskUrl_(taskId), note: '日報のコメントは後で付けます' });
    return Object.assign(result, { status: '起票失敗' });
  }
}
