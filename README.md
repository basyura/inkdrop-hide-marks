# hide-markup

Markdown エディタ Inkdrop で、`**strong**` の強調記号 `**` を非表示にするためのプラグインです。

現在は雛形のみです。有効化・無効化の入口を用意していますが、強調記号を非表示にする処理は未実装です。

## 対応環境

- Inkdrop 6

## 開発時の導入

このリポジトリのディレクトリで以下を実行します。

```sh
ipm link
```

Inkdrop を再起動し、設定のプラグイン一覧で `hide-markup` を有効にします。

## ファイル構成

- `package.json`: プラグインのメタデータ
- `lib/hide-markup.js`: 有効化・無効化の入口
- `docs/plans/001-plugin-scaffold.md`: 雛形作成の計画
