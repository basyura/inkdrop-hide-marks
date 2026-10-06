# プラグイン雛形の作成計画

## 目的

Markdown エディタ Inkdrop で `**strong**` の `**` を非表示にするプラグイン `hide-markup` の雛形を作成する。

## 修正案

- `/Users/tatsuya/repos/inkdrop/link-compact` の構成を参考にする。
- `package.json` に名前、初期バージョン、説明、エントリーポイント、対応する Inkdrop のバージョンを定義する。
- `lib/hide-markup.js` に有効化・無効化のライフサイクルを用意する。
- `README.md` に目的、開発時の導入方法、雛形段階であることを記載する。
- 今回は `**` を非表示にする処理を実装せず、次の段階で追加する。

## 手順

1. 計画を Shiba.app で表示し、具体的な修正を進めるか確認する。
2. 承認後に上記のファイルを作成する。
3. メタデータと JavaScript の構文を確認する。

## 完了条件

- Inkdrop プラグインの基本構成が揃っている。
- 有効化・無効化のエントリーポイントが存在する。
- 強調記号の非表示処理は未実装であることが説明されている。

## 実施結果

- `package.json`、`lib/hide-markup.js`、`README.md` を作成した。
- Node.js でメタデータ、JavaScript の構文、有効化・無効化の呼び出しを確認し、成功した。
- Inkdrop 上での動作確認は未実施。
