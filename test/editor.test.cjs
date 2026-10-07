const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><body></body>', {pretendToBeVisual:true});
for (const key of ['window','Window','document','MutationObserver','HTMLElement','Node','getComputedStyle']) {
  global[key] = key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : dom.window[key];
}
global.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
global.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
dom.window.Range.prototype.getClientRects = () => [];
dom.window.Range.prototype.getBoundingClientRect = () => ({left:0,right:0,top:0,bottom:0,width:0,height:0});
const { EditorState } = require('@codemirror/state');
const { EditorView, keymap } = require('@codemirror/view');
const { defaultKeymap, cursorCharLeft, cursorCharRight, cursorLineStart, cursorLineEnd } = require('@codemirror/commands');
const { vim, Vim, getCM } = require('@replit/codemirror-vim');
const { createExtension } = require('../lib/extension');

function editor(withVim, doc = 'x **ab** y') {
  let view;
  const block = () => !!view?.cm?.state.vim && !view.cm.state.vim.insertMode && !view.cm.state.vim.visualMode;
  view = new EditorView({parent:document.body, state:EditorState.create({doc, extensions:[withVim ? vim() : [], keymap.of(defaultKeymap), createExtension(block)]})});
  return view;
}

test('通常の左右移動に記号ぶんの停止がない', () => {
  const view = editor(false);
  try {
    const positions = [];
    for(let i=0;i<6;i++) { cursorCharRight(view); positions.push(view.state.selection.main.head); }
    assert.deepEqual(positions, [1,2,5,8,9,10]);
    cursorCharLeft(view);
    assert.equal(view.state.selection.main.head, 9);
    cursorCharLeft(view);
    assert.equal(view.state.selection.main.head, 8);
    cursorLineStart(view);
    assert.equal(view.state.selection.main.head, 0);
    cursorLineEnd(view);
    assert.equal(view.state.selection.main.head, 10);
  } finally {view.destroy();}
});

test('実際の Vim で h l 0 $ と挿入モードが記号を飛び越える', () => {
  const view = editor(true);
  const cm = getCM(view);
  try {
    const positions=[];
    for(let i=0;i<5;i++) {Vim.handleKey(cm,'l'); positions.push(view.state.selection.main.head);}
    assert.deepEqual(positions,[1,4,5,8,9]);
    Vim.handleKey(cm,'h');
    assert.equal(view.state.selection.main.head,8);
    Vim.handleKey(cm,'h');
    assert.equal(view.state.selection.main.head,5);
    Vim.handleKey(cm,'0');
    assert.equal(view.state.selection.main.head,0);
    Vim.handleKey(cm,'$');
    assert.equal(view.state.selection.main.head,9);
    Vim.handleKey(cm,'i');
    assert.equal(cm.state.vim.insertMode,true);
    cursorCharLeft(view);
    assert.equal(view.state.selection.main.head,8);
  } finally {view.destroy();}
});

test('有効化・エディタ再生成・無効化で装飾と登録を管理する', () => {
  const view = new EditorView({parent:document.body,state:EditorState.create({doc:'**a**'})});
  const plugin = require('../lib/hide-markup');
  let registered = [];
  let additions = 0;
  function openNote(doc) { view.setState(EditorState.create({doc, extensions: registered})); }
  global.inkdrop = {
    ensureEditorLoaded(fn) { fn(); },
    commands: { dispatch(target, command, args) {
      assert.equal(target,document.body);
      if(command === 'editor:add-extension') { registered.push(args.extension); additions++; }
      else if(command === 'editor:remove-extension') registered = registered.filter(ext => ext !== args.extension);
      else throw new Error(command);
      openNote(view.state.doc.toString());
    } },
    getActiveEditor(){return view;},
  };
  try {
    plugin.activate();
    assert.equal(view.contentDOM.textContent,'a');
    openNote('**b**');
    assert.equal(view.contentDOM.textContent,'b');
    openNote('**a**');
    assert.equal(view.contentDOM.textContent,'a');
    assert.equal(additions,1);
    plugin.deactivate();
    assert.equal(view.contentDOM.textContent,'**a**');
    assert.equal(registered.length,0);
    plugin.activate();
    assert.equal(view.contentDOM.textContent,'a');
    plugin.deactivate();
  } finally {plugin.deactivate();view.destroy();delete global.inkdrop;}
});

test('無効化後の遅延ロードと古いロード通知では登録しない', () => {
  const plugin = require('../lib/hide-markup');
  const callbacks = [];
  let additions = 0;
  const env = { ensureEditorLoaded(fn){callbacks.push(fn);}, getActiveEditor(){return null;}, commands:{dispatch(){additions++;}} };
  plugin.activate(env);
  plugin.deactivate();
  callbacks[0]();
  assert.equal(additions,0);
  plugin.activate(env);
  plugin.activate(env);
  callbacks[1]();
  assert.equal(additions,0);
  callbacks[2]();
  callbacks[2]();
  assert.equal(additions,1);
  plugin.deactivate();
});

test('Vim の回数指定も非表示の記号を数えない', () => {
  const view = editor(true);
  Vim.handleKey(view.cm,'<Esc>');
  view.focus();
  const press = key => view.contentDOM.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,keyCode:key.toUpperCase().charCodeAt(0),bubbles:true,cancelable:true}));
  try {
    press('3'); press('l');
    assert.equal(view.state.selection.main.head,5);
    press('2'); press('h');
    assert.equal(view.state.selection.main.head,1);
  } finally {view.destroy();}
});

function press(view, key) {
  view.contentDOM.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key, bubbles:true, cancelable:true}));
}

test('Vim の左端の i は開始記号の前から挿入し、入力後も外側を維持する', () => {
  for (const [doc, from] of [['**ab**',0], ['x **ab** y',2], ['***ab***',1]]) {
    const view = editor(true,doc);
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:from+2}});
      press(view,'i');
      assert.equal(view.cm.state.vim.insertMode,true);
      assert.equal(view.state.selection.main.head,from);
      press(view,'X');
      view.dispatch(view.state.replaceSelection('X'));
      press(view,'Y');
      view.dispatch(view.state.replaceSelection('Y'));
      assert.equal(view.state.doc.toString(),doc.slice(0,from)+'XY'+doc.slice(from));
      assert.equal(view.state.selection.main.head,from+2);
      assert.equal(view.contentDOM.textContent.includes('**'),false);
      press(view,'Escape');
      assert.equal(view.cm.state.vim.insertMode,false);
      assert.equal(view.state.selection.main.head,from+1);
      press(view,'l');
      assert.equal(view.state.selection.main.head,from+4);
    } finally {view.destroy();}
  }
});

test('本文の途中の i と先頭の a は強調本文内で挿入する', () => {
  for (const [head,key,expected] of [[5,'i',5],[4,'a',5]]) {
    const view=editor(true);
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:head}});
      press(view,key);
      assert.equal(view.cm.state.vim.insertMode,true);
      assert.equal(view.state.selection.main.head,expected);
      view.dispatch(view.state.replaceSelection('X'));
      assert.equal(view.state.doc.toString(),'x **aXb** y');
    } finally {view.destroy();}
  }
});

test('通常・Vim の Enter は対象の記号を表示し、外に移動すると再び隠す', () => {
  for (const withVim of [false,true]) {
    const view = editor(withVim,'x **ab** y **cd** z');
    try {
      if(withVim) Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:4}});
      press(view,'Enter');
      assert.equal(view.state.doc.toString(),'x **ab** y **cd** z');
      assert.equal(view.contentDOM.textContent,'x **ab** y cd z');
      view.dispatch({selection:{anchor:3}});
      assert.equal(view.state.selection.main.head,3);
      assert.equal(view.contentDOM.textContent,'x **ab** y cd z');
      view.dispatch({selection:{anchor:9}});
      assert.equal(view.contentDOM.textContent,'x ab y cd z');
      view.dispatch({selection:{anchor:4}});
      assert.equal(view.contentDOM.textContent,'x ab y cd z');
    } finally {view.destroy();}
  }
});

test('表示中の通常 Enter は改行し、編集後の範囲と記号表示を維持する', () => {
  const view=editor(false);
  try {
    view.dispatch({selection:{anchor:5}});
    press(view,'Enter');
    press(view,'Enter');
    assert.equal(view.state.doc.toString(),'x **a\nb** y');
    assert.equal(view.contentDOM.textContent.includes('**'),true);
    view.dispatch(view.state.replaceSelection('XYZ'));
    assert.equal(view.contentDOM.textContent.includes('**'),true);
    view.dispatch({selection:{anchor:view.state.doc.length}});
    assert.equal(view.contentDOM.textContent.includes('**'),false);
  } finally {view.destroy();}
});

test('記号表示中の Vim i は本文位置を維持して挿入する', () => {
  const view=editor(true);
  try {
    Vim.handleKey(view.cm,'<Esc>');
    view.dispatch({selection:{anchor:4}});
    press(view,'Enter');
    press(view,'i');
    assert.equal(view.state.selection.main.head,4);
    view.dispatch(view.state.replaceSelection('X'));
    assert.equal(view.state.doc.toString(),'x **Xab** y');
    assert.equal(view.contentDOM.textContent,'x **Xab** y');
  } finally {view.destroy();}
});

test('入れ子は内側から表示し、次の Enter は通常の改行になる', () => {
  const view=editor(false,'**a **bc** c**');
  try {
    view.dispatch({selection:{anchor:7}});
    press(view,'Enter');
    assert.equal(view.contentDOM.textContent,'a **bc** c');
    press(view,'Enter');
    assert.equal(view.state.doc.toString(),'**a **b\nc** c**');
    view.dispatch({selection:{anchor:3}});
    assert.equal(view.contentDOM.textContent.includes('**'),false);
  } finally {view.destroy();}
});

test('記号表示用 Enter は既定動作と後続ハンドラの改行を抑止する', () => {
  for (const withVim of [false,true]) {
    const view=editor(withVim);
    let propagated=0;
    const afterEditor = event => {
      if(event.key === 'Enter') {
        propagated++;
        view.dispatch(view.state.replaceSelection('\n'));
      }
    };
    document.body.addEventListener('keydown',afterEditor);
    try {
      if(withVim) Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:5}});
      const event=new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
      view.contentDOM.dispatchEvent(event);
      assert.equal(event.defaultPrevented,true);
      assert.equal(propagated,0);
      assert.equal(view.state.doc.toString(),'x **ab** y');
      assert.equal(view.state.selection.main.head,5);
      assert.equal(view.contentDOM.textContent,'x **ab** y');
    } finally {document.body.removeEventListener('keydown',afterEditor);view.destroy();}
  }
});

test('開始・終了記号の各文字上では表示を維持し、記号の外で隠す', () => {
  for (const withVim of [false,true]) {
    for (const outside of [1,8]) {
      const view=editor(withVim);
      try {
        if(withVim) Vim.handleKey(view.cm,'<Esc>');
        view.dispatch({selection:{anchor:4}});
        press(view,'Enter');
        for (const head of [3,2,6,7,2]) {
          view.dispatch({selection:{anchor:head}});
          assert.equal(view.state.selection.main.head,head);
          assert.equal(view.contentDOM.textContent,'x **ab** y');
        }
        view.dispatch({selection:{anchor:outside}});
        assert.equal(view.contentDOM.textContent,'x ab y');
      } finally {view.destroy();}
    }
  }
});

test('Vim I は行頭の非表示開始記号の前で挿入する', () => {
  for (const [doc, head, boundary] of [['**ab**',3,0],['   **ab** tail',12,3],['prefix\n  **ab** tail',18,9]]) {
    const view=editor(true,doc);
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:head}});
      press(view,'I');
      assert.equal(view.cm.state.vim.insertMode,true);
      assert.equal(view.state.selection.main.head,boundary);
      view.dispatch(view.state.replaceSelection('X'));
      view.dispatch(view.state.replaceSelection('Y'));
      assert.equal(view.state.doc.toString(),doc.slice(0,boundary)+'XY'+doc.slice(boundary));
      assert.equal(view.state.selection.main.head,boundary+2);
      assert.equal(view.contentDOM.textContent.includes('**'),false);
    } finally {view.destroy();}
  }
});

test('行途中の強調と表示中の記号では Vim I の通常の移動先を保つ', () => {
  for (const showMarkers of [false,true]) {
    const view=editor(true,'  x **ab** y');
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:6}});
      if(showMarkers) press(view,'Enter');
      press(view,'I');
      assert.equal(view.state.selection.main.head,2);
      view.dispatch(view.state.replaceSelection('X'));
      assert.equal(view.state.doc.toString(),'  Xx **ab** y');
    } finally {view.destroy();}
  }
  const view=editor(true,'  **ab**');
  try {
    Vim.handleKey(view.cm,'<Esc>');
    view.dispatch({selection:{anchor:4}});
    press(view,'Enter');
    press(view,'I');
    assert.equal(view.state.selection.main.head,2);
    assert.equal(view.contentDOM.textContent,'  **ab**');
  } finally {view.destroy();}
});

test('Vim なしの左端は左矢印を押さずに開始記号の前へ入力できる', () => {
  for (const [doc,from] of [['**ab**',0],['x **ab** y',2],['  **ab**',2]]) {
    const view=editor(false,doc);
    try {
      view.dispatch({selection:{anchor:from+2}});
      assert.equal(view.state.selection.main.head,from);
      assert.equal(view.contentDOM.textContent.includes('**'),false);
      press(view,'X');
      view.dispatch(view.state.replaceSelection('X'));
      press(view,'Y');
      view.dispatch(view.state.replaceSelection('Y'));
      assert.equal(view.state.doc.toString(),doc.slice(0,from)+'XY'+doc.slice(from));
      assert.equal(view.state.selection.main.head,from+2);
      press(view,'ArrowRight');
      assert.equal(view.state.selection.main.head,from+5);
    } finally {view.destroy();}
  }
});

test('記号の手前からさらに左へ移動でき、表示中の記号は通常どおり移動する', () => {
  const view=editor(false);
  try {
    view.dispatch({selection:{anchor:4}});
    assert.equal(view.state.selection.main.head,2);
    press(view,'ArrowLeft');
    assert.equal(view.state.selection.main.head,1);
    view.dispatch({selection:{anchor:4}});
    press(view,'Enter');
    view.dispatch({selection:{anchor:4}});
    press(view,'ArrowLeft');
    assert.equal(view.state.selection.main.head,3);
    assert.equal(view.contentDOM.textContent,'x **ab** y');
  } finally {view.destroy();}
});

test('Vim 挿入モードの左矢印でも開始記号の前へ移動して外側に入力する', () => {
  for (const [doc,from] of [['**ab**',0],['x **ab** y',2],['  **ab**',2]]) {
    const view=editor(true,doc);
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:from+3}});
      press(view,'i');
      assert.equal(view.cm.state.vim.insertMode,true);
      press(view,'ArrowLeft');
      assert.equal(view.state.selection.main.head,from);
      press(view,'X');
      view.dispatch(view.state.replaceSelection('X'));
      press(view,'Y');
      view.dispatch(view.state.replaceSelection('Y'));
      assert.equal(view.state.doc.toString(),doc.slice(0,from)+'XY'+doc.slice(from));
      assert.equal(view.state.selection.main.head,from+2);
      press(view,'ArrowRight');
      assert.equal(view.state.selection.main.head,from+5);
      assert.equal(view.cm.state.vim.insertMode,true);
      assert.equal(view.contentDOM.textContent.includes('**'),false);
    } finally {view.destroy();}
  }
});

test('Vim 挿入モードでも表示中の記号上は通常どおり移動する', () => {
  const view=editor(true);
  try {
    Vim.handleKey(view.cm,'<Esc>');
    view.dispatch({selection:{anchor:4}});
    press(view,'Enter');
    press(view,'i');
    press(view,'ArrowLeft');
    assert.equal(view.state.selection.main.head,3);
    press(view,'ArrowLeft');
    assert.equal(view.state.selection.main.head,2);
    assert.equal(view.contentDOM.textContent,'x **ab** y');
    assert.equal(view.cm.state.vim.insertMode,true);
  } finally {view.destroy();}
});

test('見た目の左端は通常・挿入モードとも一回の左矢印で前へ移動する', () => {
  for (const withVim of [false,true]) {
    const view=editor(withVim,'x **ああああ** y');
    try {
      if(withVim) {
        Vim.handleKey(view.cm,'<Esc>');
        view.dispatch({selection:{anchor:5}});
        press(view,'i');
      }
      view.dispatch({selection:{anchor:4},userEvent:'select.pointer'});
      assert.equal(view.state.selection.main.head,2);
      press(view,'ArrowLeft');
      assert.equal(view.state.selection.main.head,1);
      press(view,'ArrowRight');
      assert.equal(view.state.selection.main.head,2);
      press(view,'ArrowRight');
      assert.equal(view.state.selection.main.head,5);
      press(view,'ArrowLeft');
      assert.equal(view.state.selection.main.head,2);
      press(view,'X');
      view.dispatch(view.state.replaceSelection('X'));
      assert.equal(view.state.doc.toString(),'x X**ああああ** y');
    } finally {view.destroy();}
  }
});

test('左端をクリックした直後も矢印なしで強調の外に入力できる', () => {
  for (const withVim of [false,true]) {
    const view=editor(withVim,'**ああああ**');
    try {
      if(withVim) {
        Vim.handleKey(view.cm,'<Esc>');
        view.dispatch({selection:{anchor:3}});
        press(view,'i');
      }
      view.dispatch({selection:{anchor:2},userEvent:'select.pointer'});
      assert.equal(view.state.selection.main.head,0);
      press(view,'X');
      view.dispatch(view.state.replaceSelection('X'));
      assert.equal(view.state.doc.toString(),'X**ああああ**');
      assert.equal(view.state.selection.main.head,1);
    } finally {view.destroy();}
  }
});

test('右矢印一回で最後の強調文字を越えて終了記号の外側へ挿入する', () => {
  for (const withVim of [false,true]) {
    for (const [doc,head,end] of [['**あいうえお**',6,9],['前 **あいうえお** 後',8,11],['**👩‍💻**',2,9]]) {
      const view=editor(withVim,doc);
      try {
        if(withVim) {
          Vim.handleKey(view.cm,'<Esc>');
          view.dispatch({selection:{anchor:head}});
          press(view,'i');
        }
        view.dispatch({selection:{anchor:head}});
        press(view,'ArrowRight');
        assert.equal(view.state.selection.main.head,end);
        press(view,'ArrowLeft');
        assert.equal(view.state.selection.main.head,head === 2 ? 0 : head);
        press(view,'ArrowRight');
        view.dispatch(view.state.replaceSelection('X'));
        view.dispatch(view.state.replaceSelection('Y'));
        assert.equal(view.state.doc.toString(),doc.slice(0,end)+'XY'+doc.slice(end));
        assert.equal(view.state.selection.main.head,end+2);
        assert.equal(view.contentDOM.textContent.includes('**'),false);
      } finally {view.destroy();}
    }
  }
});

test('右端クリックと右矢印は終了記号の外側で二重に停止しない', () => {
  const view=editor(false,'前 **あいうえお** 後');
  try {
    view.dispatch({selection:{anchor:9},userEvent:'select.pointer'});
    assert.equal(view.state.selection.main.head,11);
    press(view,'ArrowRight');
    assert.equal(view.state.selection.main.head,12);
    press(view,'ArrowLeft');
    assert.equal(view.state.selection.main.head,11);
    view.dispatch(view.state.replaceSelection('X'));
    assert.equal(view.state.doc.toString(),'前 **あいうえお**X 後');
  } finally {view.destroy();}
});

test('Vim の最後の強調文字上の a は終了記号の外側から連続入力する', () => {
  for (const [doc,head,end] of [['**あいうえお**',6,9],['前 **あいうえお** 後',8,11],['***ab***',4,7],['**👩‍💻**',2,9]]) {
    const view=editor(true,doc);
    try {
      Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:head}});
      press(view,'a');
      assert.equal(view.cm.state.vim.insertMode,true);
      assert.equal(view.state.selection.main.head,end);
      view.dispatch(view.state.replaceSelection('X'));
      view.dispatch(view.state.replaceSelection('Y'));
      assert.equal(view.state.doc.toString(),doc.slice(0,end)+'XY'+doc.slice(end));
      press(view,'Escape');
      assert.equal(view.cm.state.vim.insertMode,false);
      assert.equal(view.state.selection.main.head,end+1);
    } finally {view.destroy();}
  }
});

test('表示中の終了記号では右矢印と Vim a の通常の挿入位置を維持する', () => {
  for (const withVim of [false,true]) {
    const view=editor(withVim,'**あいうえお**');
    try {
      if(withVim) Vim.handleKey(view.cm,'<Esc>');
      view.dispatch({selection:{anchor:6}});
      press(view,'Enter');
      if(withVim) press(view,'a');
      else press(view,'ArrowRight');
      assert.equal(view.state.selection.main.head,7);
      view.dispatch(view.state.replaceSelection('X'));
      assert.equal(view.state.doc.toString(),'**あいうえおX**');
      assert.equal(view.contentDOM.textContent.includes('**'),true);
    } finally {view.destroy();}
  }
});
