/**
 * LANDEX BEACON 設定
 * 人・部署・Todoistの起票先・入力項目をここで管理する。
 * Todoistのトークンはコードに書かず、スクリプトプロパティ TODOIST_TOKEN に保存する。
 */

const LB_BOSS = { name: '藤本', email: 'fujimoto@landex-ltd.com', todoistId: '29017314' };

/** Todoistの起票先。sectionId は 📥社長がやる、answeredId は ↩️社長回答済み */
const LB_ROUTES = {
  sales:    { project: '営業部',         projectId: '6hRMGqFfWMpF4Pq9', sectionId: '6hhQHR27JmGrX8R9', answeredId: '6hhfJQ8WJxJgJG79' },
  soumu:    { project: '総務部',         projectId: '6hRMJWMJRRMRP2x6', sectionId: '6hhQWQjw39Wcwxm6', answeredId: '6hhfJQ96v6vHJQqc' },
  oono:     { project: '管理部【大野】', projectId: '6hm3q7rW5q2498hx', sectionId: '6hm3qfJjq7fjgQ9x', answeredId: '6hm3qfPW2JHFW3jQ' },
  fujiwara: { project: '管理部【藤原】', projectId: '6hm3vHCGhfq38RwV', sectionId: '6hm3w7mMj7jRjwWV', answeredId: '6hm3w7mXGP522443' },
  mukai:    { project: '不動産事業部',   projectId: '6hm3vmp29r4cfRP5', sectionId: '6hm3w7m4pQQc3345', answeredId: '6hm3w7p7gmGMh7GX' },
  test:     { project: 'BEACONテスト',   projectId: '6hmHpvHwFwwppqJH', sectionId: '6hmHpwFvmQwrvCfH', answeredId: '6hmHpwFq6Xhpf55H' }
};

/** 入力項目。progress は「案件ごとの進捗」のように何件でも追加できる欄 */
const LB_FORMS = {
  sales: {
    label: '営業報告',
    fields: [{ id: 'work', t: '本日の業務内容', ph: '・見積作成\n・営業訪問' }],
    progress: { t: '案件ごとの進捗', name: '案件名', ph: '状況を書いてください' }
  },
  soumu: {
    label: '総務部業務報告',
    fields: [
      { id: 'work', t: '業務実績', ph: '・請求書作成\n・勤怠確認' },
      { id: 'report', t: 'ご報告事項', hint: '社長に決めてほしいこと・頼みたいことは、下の「相談」に1件ずつ書いてください' }
    ]
  },
  oono: {
    label: '業務報告',
    fields: [
      { id: 'work', t: '業務実績', ph: '・請求書作成\n・勤怠確認' },
      { id: 'report', t: 'ご報告事項', hint: '押印や支払いなど社長にお願いしたいことは、下の「相談」に1件ずつ書いてください' }
    ]
  },
  fujiwara: {
    label: '業務報告',
    fields: [
      { id: 'work', t: '業務実績' },
      { id: 'report', t: 'ご報告事項' },
      { id: 'cross', t: '部署間の調整・共有事項', hint: '営業部・現場・総務との間で決めたこと、引き継いだこと' }
    ],
    progress: { t: '案件ごとの進捗', name: '案件名', ph: '状況を書いてください' }
  },
  mukai: {
    label: '業務報告',
    note: '永友さんの様子・所感は、これまでどおりL-Reportに書いてください（BEACONには書きません）。',
    fields: [
      { id: 'work', t: '業務実績' },
      { id: 'report', t: 'ご報告事項' }
    ],
    progress: { t: '案件ごとの進捗', name: '物件・案件名', ph: '状況を書いてください' }
  }
};

/** 使う人。メールで本人を判定する。form と route は上の LB_FORMS / LB_ROUTES のキー */
const LB_PEOPLE = {
  'hakkaku@landex-ltd.com':  { key: 'hakkaku',  name: '八角', dept: '営業部',             form: 'sales',    route: 'sales',    todoistId: '60621004' },
  'iwata@landex-ltd.com':    { key: 'iwata',    name: '岩田', dept: '営業部',             form: 'sales',    route: 'sales',    todoistId: '60621005' },
  'mikawa@landex-ltd.com':   { key: 'mikawa',   name: '三川', dept: '総務部',             form: 'soumu',    route: 'soumu',    todoistId: '60621508' },
  'mori@landex-ltd.com':     { key: 'mori',     name: '森',   dept: '総務部',             form: 'soumu',    route: 'soumu',    todoistId: '60621509' },
  'oono@landex-ltd.com':     { key: 'oono',     name: '大野', dept: '管理部',             form: 'oono',     route: 'oono',     todoistId: '39287398' },
  'fujiwara@landex-ltd.com': { key: 'fujiwara', name: '藤原', dept: '管理部（執行役員）', form: 'fujiwara', route: 'fujiwara', todoistId: '39308809' },
  'mukai@landex-ltd.com':    { key: 'mukai',    name: '向井', dept: '不動産事業部',       form: 'mukai',    route: 'mukai',    todoistId: '39290909' }
};

const LB_KINDS = ['判断', '確認', '共有のみ'];

const LB_TODOIST = {
  API: 'https://api.todoist.com/api/v1',
  LABEL: '📥社長がやる',
  PRIORITY: 4 // 画面上の p1
};

/** 起票に失敗したときの自動の起票し直し。送信時の1回＋自動3回で駄目なら藤本さんにメール */
const LB_RETRY = { MAX_ATTEMPTS: 4, INTERVAL_MIN: 30, STALE_MIN: 10 };

const LB_SHEETS = {
  REPORTS: '報告',
  CONSULTS: '相談',
  HOLIDAYS: '会社休日'
};

const LB_JP_HOLIDAY_CAL = 'ja.japanese#holiday@group.v.calendar.google.com';

function LB_prop_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

/**
 * LB_MODE が 'live' でなければテストモード。
 * テストモード：使えるのは藤本さんだけ。起票先はすべて BEACONテスト。
 * 本番（live）：社員が使える。藤本さんの送信は常に BEACONテスト に起票する。
 */
function LB_isLive_() {
  return LB_prop_('LB_MODE') === 'live';
}
