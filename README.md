# hide-markup

This plugin hides Markdown syntax markers, such as the `**` delimiters in `**strong**`.

The saved Markdown remains unchanged; only its appearance in the editor is modified. Press `Enter` inside a strong emphasis span to temporarily reveal its markers without inserting a newline. The markers are hidden again when the cursor moves outside the span, including its delimiters. Works with both the standard editor and Vim.

## Supported syntax

* [x] `**strong**`
* [x] `[Inkdrop](https://www.inkdrop.app)` → [link-compact](https://my.inkdrop.app/plugins/link-compact)
* [ ] `~~delete~~`
* [ ] `inline code`
* [ ] `> blockquote`

## Requirements

- Inkdrop 6

## LICENSE

MIT
