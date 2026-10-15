# BEACON 引き継ぎメモ（PCのClaude Code向け）

このファイルは、クラウドのClaude Codeで作った LANDEX BEACON を、藤本さんのPCのClaude Codeで設置・テストするための引き継ぎです。
PCのClaude Codeは、最初にこのファイルと `beacon/README.md` を読んでください。

## 守ること（依頼主：藤本さん）

- 分からないこと・決まっていないことは、自分で判断せずに藤本さんに聞く。推測で仕様を埋めない。
- TodoistのAPIトークンはコードやチャットに書かない。スクリプト プロパティ `TODOIST_TOKEN` に藤本さんが自分で入れる。
- 定期処理（Claudeの定期タスク）とL-Report（建築事業部）は変更しない。必要なら変更案を出すだけ。
- Todoistのタスクは削除しない。
- 関数名の接頭辞は `LB_`。

## いまの状態（2026/10/15 時点）

- ブランチ `claude/beacon-mock` に、モック（`beacon/mock/`）と、フェーズ1のGASコード（`beacon/gas/`）がある。
- GASはまだ一度もGoogle上で動かしていない。Googleのサービスを偽物に置き換えた手元テストだけ通っている。
- Todoistに「BEACONテスト」プロジェクトを作成済み（藤本さんの個人プロジェクト、ボード表示）。
  - プロジェクト `6hmHpvHwFwwppqJH`
  - 📥社長がやる `6hmHpwFvmQwrvCfH`
  - ↩️社長回答済み `6hmHpwFq6Xhpf55H`
  - 2つの列の並び順が同じ値になっているので、Todoist上で📥を左にしておくとよい。

## 決まったこと

| 項目 | 決定 |
|---|---|
| 作り | GAS＋スプレッドシートのWebアプリ。AIは使わない |
| 藤本さんの画面 | 作らない。藤本さんはTodoistを見る。BEACONを開くのはテストのときだけ |
| 公開 | 実行ユーザー＝藤本さん、アクセス＝landex-ltd.com の全員 |
| 最初のテスト | 藤本さん。起票先は「BEACONテスト」 |
| 営業部（八角・岩田）の日報 | 【本日の業務内容】【案件ごとの進捗】（案件名＋内容を何件でも） |
| 総務部（三川・森）の日報 | 【業務実績】【ご報告事項】 |
| 大野さんの日報 | 総務部と同じ書式。起票先は 管理部【大野】 |
| 藤原さんの日報 | 【業務実績】【案件ごとの進捗】【ご報告事項】【部署間の調整・共有事項】 |
| 向井さんの日報 | 【業務実績】【案件ごとの進捗（物件・案件名）】【ご報告事項】。永友さんの様子はL-Reportを続ける |
| 相談の種類 | 判断／確認／共有のみ。共有のみは起票しない。種類は説明欄に【種類】として書く |
| 【出典】 | 「BEACON 日付 報告者（報告ID）」。その日の日報はタスクの最初のコメントに付ける |
| 相談らしい文のお知らせ | GASの決まり文句チェック（「よろしいでしょうか」「押印」など）。送る前の確認画面で「相談にしますか？」と出す |
| 起票に失敗したとき | 30分ごとに自動で起票し直す。4回失敗したら藤本さんにメール |
| 締め時間・催促 | 付けない |
| BEACONから完了にする | 付ける（フェーズ2） |
| 続報 | BEACONから出せる（フェーズ2）。コメントは必ず `【続報：BEACON YYYY/MM/DD 報告者】` で始める |
| Notionの報告ログ | 続ける。朝8時の定期処理がBEACONのスプレッドシートを読む方式。定期処理の変更案は藤本さんに出すだけ |

## 進め方

1. **フェーズ1（いまここ）**：報告の入力・保存・Todoist起票。藤本さんが「BEACONテスト」で試す。
2. **フェーズ2**：自分の相談の一覧（状態はTodoistから読む）、続報、完了。
3. **フェーズ3**：全員に展開（`LB_MODE` を `live` に）。同時にメール報告をやめ、朝8時の定期処理から営業報告・総務部業務報告の処理を外す（変更案を藤本さんに出す）。

## PCでの設置手順（clasp を使う場合）

前提：PCに Node.js と git がある。Googleは fujimoto@landex-ltd.com でログインする。

1. 「Google Apps Script API」がオンか確かめる（藤本さんは別件ですでにPCのClaudeとGASを連携しているので、オンのはず）。`clasp push` で API が無効というエラーが出たときだけ、https://script.google.com/home/usersettings でオンにする。
2. リポジトリを取ってきて、ブランチを切り替える。
   ```
   git clone https://github.com/fuji12345-crypto/my-html-page.git
   cd my-html-page
   git checkout claude/beacon-mock
   ```
3. clasp でGASプロジェクトを作って反映する。別件で使った clasp のログインが残っていれば `login` は要らない（`npx @google/clasp show-authorized-user` で fujimoto@landex-ltd.com か確かめる。古い版は `clasp login --status`）。
   ```
   npx @google/clasp login   # ログインが残っていないときだけ
   npx @google/clasp create --type standalone --title "LANDEX BEACON" --rootDir beacon/gas
   npx @google/clasp push
   ```
   - `create` が `beacon/gas/appsscript.json` を上書きした場合は、`git checkout beacon/gas/appsscript.json` で戻してから `push` し直す（ウェブアプリと権限の設定が入っているため）。
   - `.clasp.json` はスクリプトIDが入るので、コミットするかどうか藤本さんに聞く。
4. `npx @google/clasp open-script`（古い版は `clasp open`）でGASエディタを開く。ここからは藤本さんの操作。
   - 「プロジェクトの設定 → スクリプト プロパティ」に `TODOIST_TOKEN` を追加（Todoist「設定 → 連携機能 → 開発者」のAPIトークン）。
   - 関数 `LB_setup` を実行して権限を許可する。ログにスプレッドシートのURLが出る。
   - 関数 `LB_checkSetup` を実行し、`OK` が6行出ることを確認する。
5. デプロイする。
   ```
   npx @google/clasp deploy --description "フェーズ1"
   ```
   またはエディタの「デプロイ → 新しいデプロイ → ウェブアプリ」。出てきた `/exec` のURLを藤本さんに渡す。
6. `beacon/README.md` の「フェーズ1で確かめること」に沿って、藤本さんと一緒に確認する。エラーが出たら、メッセージをもとに直して `clasp push` → デプロイを更新する（URLは変えない）。

clasp が使えないときは、`beacon/README.md` の手順（GASエディタへの貼り付け）で同じことができる。

## テストで確かめたいこと（まだ分かっていない点）

- BEACONテストは共有していない個人プロジェクトなので、Todoistが担当者（藤本さん）を付けさせない可能性がある。その場合、テストのときだけ担当者なしで起票し、スプレッドシートの「エラー」欄にそう書く作りになっている。
- Todoist API v1 の実際の戻り値（`section_id` など）がコードの想定どおりか。
- 社長回答コメントスキルが、BEACONが作ったタスクをいつもどおり読めるか。
