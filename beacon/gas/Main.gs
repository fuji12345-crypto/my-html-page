/** Webアプリの入口 */

function doGet() {
  const user = LB_currentUser_();
  const t = HtmlService.createTemplateFromFile('Index');
  t.ctxJson = JSON.stringify(LB_context_(user)).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('LANDEX BEACON')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function LB_include_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** ログインしているGoogleアカウントから、使ってよい人かを判定する */
function LB_currentUser_() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (!email) {
    return { allowed: false, email: '', message: 'Googleアカウントを確認できませんでした。landex-ltd.com のアカウントでログインして開いてください。' };
  }
  if (email === LB_BOSS.email) return { allowed: true, email: email, isBoss: true };
  const person = LB_PEOPLE[email];
  if (!person) return { allowed: false, email: email, message: email + ' はBEACONの利用者に登録されていません。' };
  if (!LB_isLive_()) return { allowed: false, email: email, message: 'BEACONは準備中です。使えるようになったらお知らせします。' };
  return { allowed: true, email: email, person: person };
}

function LB_personByKey_(key) {
  const emails = Object.keys(LB_PEOPLE);
  for (let i = 0; i < emails.length; i++) {
    if (LB_PEOPLE[emails[i]].key === key) return LB_PEOPLE[emails[i]];
  }
  return null;
}

/** 画面に渡す情報 */
function LB_context_(user) {
  if (!user.allowed) return { allowed: false, message: user.message };
  const people = user.isBoss
    ? Object.keys(LB_PEOPLE).map(function (e) { return LB_PEOPLE[e]; })
    : [user.person];
  const forms = {};
  people.forEach(function (p) { forms[p.key] = LB_FORMS[p.form]; });
  const now = new Date();
  let defaultDue = '';
  try { defaultDue = LB_nextBusinessDay_(now); } catch (err) { console.warn(err); }
  return {
    allowed: true,
    isBoss: !!user.isBoss,
    live: LB_isLive_(),
    people: people.map(function (p) {
      return { key: p.key, name: p.name, dept: p.dept, project: user.isBoss ? LB_ROUTES.test.project : LB_ROUTES[p.route].project };
    }),
    forms: forms,
    kinds: LB_KINDS,
    today: LB_fmt_(now, 'yyyy-MM-dd'),
    defaultDue: defaultDue
  };
}
