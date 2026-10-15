/** Todoist API（v1）の呼び出し。トークンはスクリプトプロパティ TODOIST_TOKEN */

function LB_todoist_(method, path, body, requestId) {
  const token = LB_prop_('TODOIST_TOKEN');
  if (!token) throw new Error('TODOIST_TOKEN が未設定です');
  const opt = {
    method: method,
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  };
  if (requestId) opt.headers['X-Request-Id'] = requestId;
  if (body) opt.payload = JSON.stringify(body);

  let lastErr = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) Utilities.sleep(1000 * attempt);
    let res;
    try {
      res = UrlFetchApp.fetch(LB_TODOIST.API + path, opt);
    } catch (err) {
      lastErr = '通信エラー: ' + err;
      continue;
    }
    const code = res.getResponseCode();
    const text = res.getContentText();
    if (code >= 200 && code < 300) return text ? JSON.parse(text) : {};
    lastErr = 'Todoist API ' + code + ': ' + text.slice(0, 300);
    // 4xx（429 以外）は何度送っても同じなので止める
    if (code >= 400 && code < 500 && code !== 429) break;
  }
  throw new Error(lastErr);
}

/** 相談のタスクを作る。作成後に sectionId を確かめ、ずれていれば📥へ移す */
function LB_createConsultTask_(route, task, requestId) {
  const body = {
    content: task.content,
    description: task.description,
    project_id: route.projectId,
    section_id: route.sectionId,
    labels: [LB_TODOIST.LABEL],
    priority: LB_TODOIST.PRIORITY,
    assignee_id: LB_BOSS.todoistId,
    due_date: task.dueDate
  };
  let note = '';
  let created;
  try {
    created = LB_todoist_('post', '/tasks', body, requestId);
  } catch (err) {
    // BEACONテストは共有していない個人プロジェクトなので、担当者を付けられない場合がある。テストのときだけ担当者なしで作り直す
    if (route !== LB_ROUTES.test || !/API 4\d\d/.test(String(err.message))) throw err;
    delete body.assignee_id;
    created = LB_todoist_('post', '/tasks', body, requestId + '-noassign');
    note = 'テスト用プロジェクトのため担当者なしで起票';
  }
  if (!created || !created.id) throw new Error('Todoistの戻り値にタスクIDがありません');

  if (created.section_id !== route.sectionId) {
    LB_todoist_('post', '/tasks/' + created.id + '/move', { section_id: route.sectionId });
    const again = LB_todoist_('get', '/tasks/' + created.id);
    if (again.section_id !== route.sectionId) note = '列が📥社長がやるになっていません（' + again.section_id + '）';
  }
  return { id: String(created.id), note: note, misplaced: !!note && note.indexOf('列が') === 0 };
}

function LB_addComment_(taskId, content, requestId) {
  return LB_todoist_('post', '/comments', { task_id: taskId, content: content }, requestId);
}

function LB_taskUrl_(taskId) {
  return 'https://app.todoist.com/app/task/' + taskId;
}
