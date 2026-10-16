/**
 * フェーズ2：自分の相談の一覧・続報・完了、過去の報告。
 * 相談の状態はTodoistから読む（📥社長がやる＝回答待ち、↩️社長回答済み＝回答あり、完了＝完了）。
 */

const LB_MINE_DAYS = 60;
const LB_MINE_MAX = 40;
const LB_BOSS_PREFIXES = ['【社長回答', '【社長差し戻し', '【社長確認'];
const LB_FOLLOW_PREFIX = '【続報';

/** 画面から呼ばれる。自分が出した相談を新しい順に返す */
function LB_getMyConsults(asKey) {
  const me = LB_requireReporter_(asKey);
  const cs = LB_sheet_(LB_SHEETS.CONSULTS);
  if (cs.getLastRow() < 2) return [];
  const since = LB_fmt_(new Date(Date.now() - LB_MINE_DAYS * 86400000), 'yyyy-MM-dd');
  const rows = LB_allRows_(cs).filter(function (c) {
    return LB_isMine_(c, me) && c['報告日'] >= since;
  }).reverse().slice(0, LB_MINE_MAX);

  // 完了済みと共有のみはTodoistに聞かない。それ以外はまとめて問い合わせる
  const ask = rows.filter(function (c) { return c['TodoistタスクID'] && c['完了'] !== '済'; });
  const reqs = [];
  ask.forEach(function (c) {
    reqs.push('/tasks/' + c['TodoistタスクID']);
    reqs.push('/comments?task_id=' + c['TodoistタスクID']);
  });
  const res = LB_todoistMany_(reqs);
  const live = {};
  ask.forEach(function (c, i) { live[c['相談ID']] = { task: res[i * 2], comments: res[i * 2 + 1] }; });

  return rows.map(function (c) { return LB_consultView_(c, live[c['相談ID']]); });
}

/** 画面から呼ばれる。続報をTodoistにコメントし、↩️社長回答済みにあれば📥社長がやるへ戻す */
function LB_postFollowUp(consultId, text, asKey) {
  const me = LB_requireReporter_(asKey);
  text = String(text == null ? '' : text).trim().slice(0, LB_MAX_LEN);
  if (!text) throw new Error('続報が空です');
  const found = LB_findMyConsult_(consultId, me);
  const c = found.c;
  const taskId = c['TodoistタスクID'];
  if (!taskId) throw new Error('この相談はTodoistに起票されていないため、続報を出せません');
  const route = LB_ROUTES[c['起票先']];

  const task = LB_todoist_('get', '/tasks/' + taskId);
  if (task.checked) throw new Error('この相談は完了しています。続きがある場合は、新しい相談として出してください');

  const head = '【続報：BEACON ' + LB_fmt_(new Date(), 'yyyy/MM/dd') + ' ' + c['報告者'] + '】';
  LB_addComment_(taskId, head + '\n' + text, consultId + '-fu-' + LB_digest_(text));

  // 定期処理「社長回答済みの続報チェック」と同じ戻し方。すでに📥にあれば何もしない
  if (task.section_id === route.answeredId) {
    LB_todoist_('post', '/tasks/' + taskId + '/move', { section_id: route.sectionId });
    const labels = (task.labels || []).indexOf(LB_TODOIST.LABEL) >= 0 ? task.labels : (task.labels || []).concat([LB_TODOIST.LABEL]);
    try {
      LB_todoist_('post', '/tasks/' + taskId, { labels: labels, assignee_id: LB_BOSS.todoistId });
    } catch (err) {
      // BEACONテストは個人プロジェクトなので担当者を付けられないことがある。ラベルだけ付け直す
      if (route !== LB_ROUTES.test) throw err;
      LB_todoist_('post', '/tasks/' + taskId, { labels: labels });
    }
  }
  return LB_consultView_(c, {
    task: LB_todoist_('get', '/tasks/' + taskId),
    comments: LB_todoist_('get', '/comments?task_id=' + taskId)
  });
}

/** 画面から呼ばれる。Todoistのタスクを完了にする */
function LB_completeConsult(consultId, asKey) {
  const me = LB_requireReporter_(asKey);
  const found = LB_findMyConsult_(consultId, me);
  const taskId = found.c['TodoistタスクID'];
  if (!taskId) throw new Error('この相談はTodoistに起票されていません');
  LB_todoist_('post', '/tasks/' + taskId + '/close');
  LB_updateRow_(found.sheet, found.row, { '完了': '済' });
  found.c['完了'] = '済';
  return LB_consultView_(found.c, null);
}

/** 画面から呼ばれる。自分の過去の報告（新しい順） */
function LB_getMyReports(asKey) {
  const me = LB_requireReporter_(asKey);
  const rs = LB_sheet_(LB_SHEETS.REPORTS);
  if (rs.getLastRow() < 2) return [];
  const since = LB_fmt_(new Date(Date.now() - LB_MINE_DAYS * 86400000), 'yyyy-MM-dd');
  const consults = LB_sheet_(LB_SHEETS.CONSULTS).getLastRow() > 1 ? LB_allRows_(LB_sheet_(LB_SHEETS.CONSULTS)) : [];
  return LB_allRows_(rs).filter(function (r) { return LB_isMine_(r, me) && r['報告日'] >= since; })
    .reverse().slice(0, LB_MINE_MAX).map(function (r) {
      return {
        reportId: r['報告ID'], date: r['報告日'], label: r['書式'], daily: r['日報'],
        consults: consults.filter(function (c) { return c['報告ID'] === r['報告ID']; }).map(function (c) {
          return { kind: c['種類'], title: LB_taskContent_(c), state: c['状態'] };
        })
      };
    });
}

/* ---------- 内部 ---------- */

/** 本人と、記録を絞り込むための条件を返す。藤本さんはテストで選んだ報告者として扱う */
function LB_requireReporter_(asKey) {
  const user = LB_currentUser_();
  if (!user.allowed) throw new Error(user.message);
  if (user.isBoss) {
    const p = LB_personByKey_(asKey);
    if (!p) throw new Error('テストする報告者を選んでください');
    return { email: user.email, name: p.name };
  }
  return { email: user.email, name: user.person.name };
}

function LB_isMine_(row, me) {
  return String(row['メール']).toLowerCase() === me.email && row['報告者'] === me.name;
}

function LB_allRows_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getDisplayValues().map(function (v) {
    const o = {};
    head.forEach(function (h, i) { o[h] = v[i]; });
    return o;
  });
}

function LB_findMyConsult_(consultId, me) {
  const cs = LB_sheet_(LB_SHEETS.CONSULTS);
  const ids = cs.getRange(2, 1, Math.max(cs.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) !== consultId) continue;
    const c = LB_rowObject_(cs, i + 2);
    if (!LB_isMine_(c, me)) break;
    return { sheet: cs, row: i + 2, c: c };
  }
  throw new Error('この相談は見つかりませんでした');
}

/** 一覧1件分の表示用データ。live が null なら Todoist に聞かずに表示する */
function LB_consultView_(c, live) {
  const view = {
    consultId: c['相談ID'], reportId: c['報告ID'], date: c['報告日'], due: c['期限（設定）'],
    kind: c['種類'], title: c['状態'] === '共有のみ' ? c['何を決めてほしいか'] : LB_taskContent_(c),
    url: c['TodoistURL'], comments: [], status: 'wait'
  };
  if (c['状態'] === '共有のみ') { view.status = 'share'; return view; }
  if (c['状態'] === '起票失敗' || c['状態'] === '起票待ち') { view.status = 'pending'; return view; }
  if (c['完了'] === '済') { view.status = 'done'; return view; }
  if (!live || !live.task || live.task.error) {
    view.status = 'unknown';
    view.note = live && live.task && live.task.code === 404 ? 'Todoistでタスクが見つかりません' : 'Todoistの状態を読めませんでした';
    return view;
  }
  const route = LB_ROUTES[c['起票先']] || {};
  const t = live.task;
  if (t.checked) view.status = 'done';
  else if (t.section_id === route.answeredId) view.status = 'ans';
  else if (t.section_id === route.sectionId) view.status = 'wait';
  else { view.status = 'other'; view.note = 'Todoistで別の列に移っています'; }

  const list = live.comments && !live.comments.error ? (live.comments.results || live.comments) : [];
  view.comments = (Array.isArray(list) ? list : []).filter(function (m) {
    const s = String(m.content || '');
    return s.indexOf(LB_FOLLOW_PREFIX) === 0 || LB_BOSS_PREFIXES.some(function (p) { return s.indexOf(p) === 0; });
  }).map(function (m) {
    return { type: String(m.content).indexOf(LB_FOLLOW_PREFIX) === 0 ? 'follow' : 'boss', at: m.posted_at || '', text: m.content };
  });
  return view;
}

/** 複数のGETをまとめて送る。失敗したものは {error, code} を返す */
function LB_todoistMany_(paths) {
  if (!paths.length) return [];
  const token = LB_prop_('TODOIST_TOKEN');
  if (!token) throw new Error('TODOIST_TOKEN が未設定です');
  const out = [];
  for (let i = 0; i < paths.length; i += 40) {
    const chunk = paths.slice(i, i + 40);
    const res = UrlFetchApp.fetchAll(chunk.map(function (p) {
      return { url: LB_TODOIST.API + p, method: 'get', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
    }));
    res.forEach(function (r) {
      const code = r.getResponseCode();
      if (code >= 200 && code < 300) out.push(JSON.parse(r.getContentText() || '{}'));
      else out.push({ error: true, code: code });
    });
  }
  return out;
}

function LB_digest_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 12);
}
