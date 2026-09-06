# Claude 神スキル7選 セットアップガイド

このリポジトリには、記事「【超便利】Claudeガチで使える神スキル7選」で紹介されている
7つのツールのうち、**プロジェクト設定として自動化できるもの**があらかじめ組み込まれています。

## このリポジトリで自動的に有効になるもの（5つ）

このリポジトリを Claude Code で開くだけで、以下が有効になります
（初回に承認の確認が表示されたら「許可」してください）。

### 公式プラグイン4つ（`.claude/settings.json` で設定済み）

| # | プラグイン | 役割 |
|---|-----------|------|
| 1 | `claude-code-setup` | 困ったときの相談役。設定方法や自動化の提案をしてくれる |
| 2 | `superpowers` | 計画→作業分担→ダブルチェックまで自動化し、出力の質を底上げ |
| 3 | `frontend-design` | サイト・画面のデザインを「AIっぽさ」のない仕上がりに |
| 4 | `skill-creator` | 毎日の作業を自分専用スキル（手順書）に変換してくれる |

### Playwright MCP（`.mcp.json` で設定済み）

| # | ツール | 役割 |
|---|-------|------|
| 5 | `playwright` | Claude が実際にブラウザ（Chrome）を開いて情報収集・操作 |

**使い方のコツ**: 頼むときは「**Playwright MCPで**〜して」と頭に付けてください。
「スクリプトを書きます」と言い出したらブラウザを使っていないので、一度止めて頼み直します。
※ログインが必要なサイト（X・Instagram等）はログイン画面で止まるため対象外です。

## 手元のパソコンで別途セットアップが必要なもの（2つ）

以下の2つはローカルマシンでの作業（トークン登録・プロジェクト作成）が必要なため、
このリポジトリには含めていません。ターミナルで以下を実施してください。

### 6. Remotion（動画作成）

```bash
# Node.js が入っているか不明なら、Claude Code にそのまま確認を頼めばOK
npx create-video@latest        # デスクトップに remotion-video 等の名前で作成（半角英数字のみ）
cd remotion-video
npx skills add remotion-dev/skills   # Remotion 公式スキルを追加
```

作った `remotion-video` フォルダを Claude Code で開き、
「この動画にテロップを入れて」等と日本語で指示するだけです。
※個人および3人までの会社なら無料。4人以上の会社はライセンスが必要です。

### 7. Discord 連携（スマホから指示）

準備に30分〜1時間かかります。大まかな流れ:

1. **Bun を入れる**: `curl -fsSL https://bun.sh/install | bash`
2. **Discord Developer Portal で Bot を作成**
   - 「Bot」ページで **MESSAGE CONTENT INTENT を必ずオン**にして保存
   - トークンをコピー（パスワード同様、他人に見せない）
   - OAuth2 URL ジェネレーターで scope「bot」+ 必要な6権限のみでサーバーに招待
     （「管理者」にはチェックしない）
3. **プラグインを入れて接続**
   ```bash
   claude plugin install discord@claude-plugins-official   # user scope を選択
   claude
   # 起動後: /discord:configure <トークン>
   ```
4. **専用コマンドで起動**（普通に起動しても繋がりません）
   ```bash
   claude --channels plugin:discord@claude-plugins-official
   ```
5. **自分専用にする**: Bot に DM → 返ってきたペアリングコードで
   `/discord:access pair ○○○○○○` → 続けて `/discord:access policy allowlist`

※パソコンを起動したままにしておく必要があります。
※Bot が緑にならない場合は「MESSAGE CONTENT INTENT の保存忘れ」
「トークン未登録」「`--channels` を付けずに起動」のどれかをまず疑ってください。

## 注意: スキルは信頼できる提供元のものだけを

スキルは Claude に新しい能力を渡すものなので、悪意のあるスキルを入れると
意図しない動きをさせられる可能性があります。ここで設定しているのは
**Anthropic 公式マーケットプレイス**のプラグインと大手企業のツールのみです。
慣れるまではこの範囲で使うのが安全です。
