import { MATERIAL_CARD_CSS } from './materialCard'

function escapeForScript(html: string): string {
  return JSON.stringify(html || '<p><br></p>')
}

/** 原生 App 内嵌完整富文本编辑页（与 Web 功能对齐） */
export function buildNativeEditorHtml(initialHtml: string): string {
  const initial = escapeForScript(initialHtml)
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: transparent;
    color: #1d2b30;
    -webkit-tap-highlight-color: transparent;
  }
  body {
    display: flex; flex-direction: column;
    font-family: Georgia, "Songti SC", "Source Han Serif SC", serif;
  }
  .notebox-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(29,43,48,0.12);
    background: rgba(255,255,255,0.88);
    flex-shrink: 0;
    position: sticky; top: 0; z-index: 20;
  }
  .notebox-toolbar button {
    border: 1px solid rgba(29,43,48,0.12);
    background: rgba(255,255,255,0.92);
    border-radius: 8px;
    padding: 7px 10px;
    color: #1d2b30;
    font-size: 13px;
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.2;
  }
  .notebox-toolbar button.primary {
    background: #2e8b80; border-color: #2e8b80; color: #fff;
  }
  .notebox-toolbar button.active {
    background: #c9852a; border-color: #c9852a; color: #fff;
  }
  .notebox-toolbar button:disabled { opacity: 0.5; }
  .notebox-toolbar .sep {
    width: 1px; height: 20px; background: rgba(29,43,48,0.12); margin: 0 2px;
  }
  .notebox-toolbar .field {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 0 4px; color: #5d6d74; font-size: 12px;
    font-family: system-ui, sans-serif;
  }
  .notebox-toolbar input[type="number"] {
    width: 52px; border: 1px solid rgba(29,43,48,0.15);
    border-radius: 6px; padding: 5px 6px; font-size: 13px;
  }
  .notebox-toolbar input[type="color"] {
    width: 28px; height: 28px; border: none; padding: 0;
    background: transparent;
  }
  .notebox-editor-wrap {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    position: relative;
  }
  .notebox-editor {
    flex: 1; outline: none; padding: 14px 16px;
    overflow: auto; font-size: 16px; line-height: 1.7;
    min-height: 240px; -webkit-user-select: text; user-select: text;
  }
  .notebox-editor h1 { font-size: 1.75rem; font-weight: 700; margin: 0.6em 0 0.35em; }
  .notebox-editor h2 { font-size: 1.35rem; font-weight: 700; margin: 0.55em 0 0.3em; }
  .notebox-editor p { margin: 0.4em 0; }
  .notebox-editor img {
    max-width: 100%; height: auto; border-radius: 8px;
    display: inline-block; vertical-align: middle;
  }
  .notebox-editor img.notebox-img-selected {
    outline: 2px solid #2e8b80; outline-offset: 2px;
  }
  .notebox-editor ul, .notebox-editor ol { padding-left: 1.4em; }
  .notebox-editor.format-brush-cursor,
  .notebox-editor.format-brush-cursor * { cursor: cell !important; }
  ${MATERIAL_CARD_CSS}
  @media (max-width: 860px) {
    .notebox-editor .notebox-material-card-split { flex-direction: column; }
    .notebox-editor .notebox-card-pane {
      border-right: none;
      border-bottom: 1px solid rgba(29,43,48,0.1);
      min-height: 80px;
    }
    .notebox-editor .notebox-card-pane:last-child { border-bottom: none; }
  }
</style>
</head>
<body>
  <div class="notebox-toolbar" id="toolbar">
    <button type="button" data-cmd="bold" title="加粗">B</button>
    <button type="button" data-cmd="italic" title="斜体">I</button>
    <button type="button" data-cmd="underline" title="下划线">U</button>
    <button type="button" data-cmd="strikeThrough" title="删除线">S</button>
    <span class="sep"></span>
    <button type="button" data-block="h1">标题</button>
    <button type="button" data-block="h2">小标题</button>
    <button type="button" data-block="p">正文</button>
    <span class="sep"></span>
    <label class="field">字号<input id="fontSize" type="number" min="8" max="96" value="16" />px</label>
    <button type="button" id="applySize">应用字号</button>
    <span class="sep"></span>
    <label class="field">颜色<input id="fontColor" type="color" value="#1d2b30" /></label>
    <button type="button" id="applyColor">应用颜色</button>
    <span class="sep"></span>
    <button type="button" data-cmd="insertUnorderedList">• 列表</button>
    <button type="button" data-cmd="insertOrderedList">1. 列表</button>
    <button type="button" data-cmd="removeFormat">清除样式</button>
    <button type="button" id="formatBrush">格式刷</button>
    <span class="sep"></span>
    <button type="button" class="primary" id="btnImage">图片</button>
    <span class="sep"></span>
    <button type="button" class="primary" id="btnCard">插入材料 card</button>
  </div>
  <div class="notebox-editor-wrap">
    <div class="notebox-editor" id="editor" contenteditable="true"></div>
  </div>
<script>
(function () {
  var CARD_ATTR = 'data-notebox-card';
  var CARD_VALUE = 'material';
  var editor = document.getElementById('editor');
  var savedRange = null;
  var copiedFormat = null;
  var paintSticky = false;
  var formatBrushOn = false;
  var lastExternalKey = '';
  var suppressEmit = false;

  function post(msg) {
    try {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } catch (e) {}
  }

  function stripSelection(html) {
    return (html || '').replace(/\\s*is-active/g, '').replace(/\\s*notebox-img-selected/g, '');
  }

  function emit() {
    if (suppressEmit) return;
    stripTransientCardStyles(editor);
    post({ type: 'change', html: stripSelection(editor.innerHTML || '') });
  }

  function status(message, error) {
    post({ type: 'status', message: message || '', error: !!error });
  }

  function saveSelection() {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      savedRange = range.cloneRange();
    }
  }

  function restoreSelection() {
    if (!savedRange) return;
    var sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function focusEditor() {
    editor.focus();
    restoreSelection();
  }

  function runCommand(cmd, value) {
    focusEditor();
    document.execCommand(cmd, false, value);
    saveSelection();
    emit();
  }

  function applyInlineStyle(style) {
    focusEditor();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    var range = sel.getRangeAt(0);
    var span = document.createElement('span');
    Object.assign(span.style, style);
    if (range.collapsed) {
      span.appendChild(document.createTextNode('\\u200b'));
      range.insertNode(span);
      var textNode = span.firstChild;
      if (textNode) {
        var next = document.createRange();
        next.setStart(textNode, 1);
        next.collapse(true);
        sel.removeAllRanges();
        sel.addRange(next);
      }
    } else {
      try {
        range.surroundContents(span);
      } catch (e) {
        var fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
      var next2 = document.createRange();
      next2.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(next2);
    }
    saveSelection();
    emit();
  }

  function findMaterialCard(from) {
    if (!from || !from.closest) return null;
    return from.closest('[' + CARD_ATTR + '="' + CARD_VALUE + '"]');
  }

  function isCancelControl(target) {
    if (!target || !target.closest) return false;
    return !!(target.closest('[data-card-action="cancel"]') ||
      (target.classList && target.classList.contains('notebox-card-cancel')));
  }

  function buildCancelControl() {
    var cancel = document.createElement('span');
    cancel.className = 'notebox-card-cancel';
    cancel.setAttribute('role', 'button');
    cancel.setAttribute('tabindex', '0');
    cancel.setAttribute('contenteditable', 'false');
    cancel.setAttribute('data-card-action', 'cancel');
    cancel.textContent = '取消 card';
    return cancel;
  }

  function buildResizeHandle() {
    var handle = document.createElement('div');
    handle.className = 'notebox-card-resize';
    handle.contentEditable = 'false';
    handle.setAttribute('data-card-action', 'resize');
    handle.title = '拖动调整高度';
    var tip = document.createElement('span');
    tip.className = 'notebox-card-resize-text';
    tip.textContent = '拖动调整高度';
    handle.appendChild(tip);
    return handle;
  }

  function ensureMaterialCardChrome(root) {
    root.querySelectorAll('[' + CARD_ATTR + '="' + CARD_VALUE + '"]').forEach(function (node) {
      var card = node;
      card.contentEditable = 'false';
      card.setAttribute(CARD_ATTR, CARD_VALUE);
      var bar = card.querySelector('.notebox-material-card-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'notebox-material-card-bar';
        bar.contentEditable = 'false';
        var label = document.createElement('span');
        label.className = 'notebox-material-card-label';
        label.textContent = '材料对照';
        bar.appendChild(label);
        bar.appendChild(buildCancelControl());
        card.insertBefore(bar, card.firstChild);
      } else {
        var oldBtn = bar.querySelector('button.notebox-card-cancel, [data-card-action="cancel"]');
        if (oldBtn && oldBtn.tagName === 'BUTTON') {
          oldBtn.replaceWith(buildCancelControl());
        } else if (!bar.querySelector('[data-card-action="cancel"]')) {
          bar.appendChild(buildCancelControl());
        }
      }
      var split = card.querySelector('.notebox-material-card-split');
      if (split && !split.style.height) {
        var h = Math.round(split.getBoundingClientRect().height || 220);
        split.style.height = Math.max(120, h) + 'px';
      }
      if (!card.querySelector('.notebox-card-resize')) {
        card.appendChild(buildResizeHandle());
      }
      fixMaterialCardLayout(card);
    });
  }

  var lastPane = null;

  function fixMaterialCardLayout(card) {
    if (!card) return;
    var split = card.querySelector('.notebox-material-card-split');
    if (!split) return;
    var h = parseFloat(split.style.height) || Math.round(split.getBoundingClientRect().height) || 220;
    var px = Math.max(120, Math.min(900, h)) + 'px';
    split.style.height = px;
    if (!split.style.minHeight) split.style.minHeight = px;
    if (!split.style.maxHeight) split.style.maxHeight = px;
    card.querySelectorAll('.notebox-card-pane-body').forEach(function (node) {
      var pane = node;
      pane.querySelectorAll('[style]').forEach(function (el) {
        if (el === pane) return;
        if (el.style.position === 'absolute' || el.style.position === 'fixed') {
          el.style.position = 'static';
        }
        if (el.style.float && el.style.float !== 'none') {
          el.style.float = 'none';
        }
      });
      pane.classList.add('notebox-pane-reflow');
      void pane.offsetHeight;
      pane.classList.remove('notebox-pane-reflow');
    });
  }

  function stripTransientCardStyles(root) {
    root.querySelectorAll('.notebox-card-pane-body').forEach(function (node) {
      node.style.removeProperty('overflow');
      node.style.removeProperty('max-height');
      node.classList.remove('notebox-pane-reflow');
    });
    root.querySelectorAll('.notebox-material-card-split').forEach(function (node) {
      node.style.removeProperty('overflow');
    });
  }

  function resolvePastePane(editorEl) {
    var sel = window.getSelection();
    var anchor = sel && sel.anchorNode;
    var anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
    var active = document.activeElement;
    var fromSel = anchorEl && anchorEl.closest && anchorEl.closest('.notebox-card-pane-body');
    if (fromSel && editorEl.contains(fromSel)) return fromSel;
    var fromActive = active && active.closest && active.closest('.notebox-card-pane-body');
    if (fromActive && editorEl.contains(fromActive)) return fromActive;
    var card = findMaterialCard(anchorEl || active);
    if (card && editorEl.contains(card)) {
      if (lastPane && card.contains(lastPane) && editorEl.contains(lastPane)) return lastPane;
      var paneWrap = (anchorEl || active) && (anchorEl || active).closest && (anchorEl || active).closest('.notebox-card-pane');
      if (paneWrap && card.contains(paneWrap)) {
        var body = paneWrap.querySelector('.notebox-card-pane-body');
        if (body) return body;
      }
      return card.querySelector('.notebox-card-material-body');
    }
    return null;
  }

  function insertHtmlIntoEditable(host, html) {
    host.focus();
    var sel = window.getSelection();
    var inside = sel && sel.rangeCount > 0 && host.contains(sel.anchorNode);
    if (!inside) {
      var r = document.createRange();
      r.selectNodeContents(host);
      r.collapse(false);
      if (sel) { sel.removeAllRanges(); sel.addRange(r); }
    }
    var stillOutside = !sel || sel.rangeCount === 0 || !host.contains(sel.anchorNode);
    if (stillOutside) {
      var onlyEmpty = (host.textContent || '').replace(/\\u200b/g, '').trim() === '';
      var wrap = document.createElement('div');
      wrap.innerHTML = html;
      if (onlyEmpty) host.innerHTML = '';
      while (wrap.firstChild) host.appendChild(wrap.firstChild);
      if (!host.innerHTML.trim()) host.innerHTML = '<p><br></p>';
      return;
    }
    document.execCommand('insertHTML', false, html);
  }

  function normalizePaneHtml(html) {
    var trimmed = (html || '').trim();
    if (!trimmed || trimmed === '<br>' || trimmed === '<p><br></p>') return '';
    var text = trimmed.replace(/<br\\s*\\/?>/gi, '').replace(/&nbsp;/gi, ' ').replace(/<[^>]+>/g, '').trim();
    if (!text) return '';
    return trimmed;
  }

  function unwrapMaterialCard(card) {
    var material = (card.querySelector('.notebox-card-material-body') || {}).innerHTML || '';
    var questions = (card.querySelector('.notebox-card-questions-body') || {}).innerHTML || '';
    var parts = [normalizePaneHtml(material), normalizePaneHtml(questions)].filter(Boolean);
    var parent = card.parentNode;
    if (!parent) return;
    if (!parts.length) {
      var placeholder = document.createElement('p');
      placeholder.appendChild(document.createElement('br'));
      parent.insertBefore(placeholder, card);
      card.remove();
      return;
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = parts.join('');
    var fragment = document.createDocumentFragment();
    while (wrap.firstChild) fragment.appendChild(wrap.firstChild);
    parent.insertBefore(fragment, card);
    card.remove();
  }

  function removeMaterialCard(card) {
    var parent = card.parentNode;
    if (!parent) return;
    var placeholder = document.createElement('p');
    placeholder.appendChild(document.createElement('br'));
    parent.insertBefore(placeholder, card);
    card.remove();
  }

  function clearActiveCards() {
    editor.querySelectorAll('.notebox-material-card.is-active').forEach(function (el) {
      el.classList.remove('is-active');
    });
  }

  function buildMaterialCardHtml() {
    var id = 'mc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    return '<div class="notebox-material-card" ' + CARD_ATTR + '="' + CARD_VALUE + '" data-card-id="' + id + '" contenteditable="false">' +
      '<div class="notebox-material-card-bar" contenteditable="false">' +
      '<span class="notebox-material-card-label">材料对照</span>' +
      '<span role="button" tabindex="0" class="notebox-card-cancel" contenteditable="false" data-card-action="cancel">取消 card</span>' +
      '</div>' +
      '<div class="notebox-material-card-split" style="height:220px">' +
      '<div class="notebox-card-pane"><div class="notebox-card-pane-title" contenteditable="false">材料内容</div>' +
      '<div class="notebox-card-pane-body notebox-card-material-body" contenteditable="true"><p><br></p></div></div>' +
      '<div class="notebox-card-pane"><div class="notebox-card-pane-title" contenteditable="false">问题</div>' +
      '<div class="notebox-card-pane-body notebox-card-questions-body" contenteditable="true"><p><br></p></div></div>' +
      '</div>' +
      '<div class="notebox-card-resize" contenteditable="false" data-card-action="resize" title="拖动调整高度"><span class="notebox-card-resize-text">拖动调整高度</span></div>' +
      '</div><p><br></p>';
  }

  function startMaterialCardResize(handle, clientY, pointerId) {
    var card = findMaterialCard(handle);
    var split = card && card.querySelector('.notebox-material-card-split');
    if (!card || !split) return;
    var startY = clientY;
    var startH = parseFloat(split.style.height) || split.getBoundingClientRect().height || 220;
    card.classList.add('is-resizing');
    document.body.style.userSelect = 'none';
    if (pointerId != null) {
      try { handle.setPointerCapture(pointerId); } catch (e) {}
    }
    function applyHeight(y) {
      var next = Math.min(900, Math.max(120, startH + (y - startY)));
      var px = Math.round(next) + 'px';
      split.style.height = px;
      split.style.minHeight = px;
      split.style.maxHeight = px;
    }
    function onMove(ev) {
      ev.preventDefault();
      applyHeight(ev.clientY);
    }
    function onUp(ev) {
      applyHeight(ev.clientY);
      card.classList.remove('is-resizing');
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('touchmove', onMove, true);
      window.removeEventListener('touchend', onUp, true);
      emit();
      status('已调整材料 card 高度');
    }
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('touchmove', onMove, { capture: true, passive: false });
    window.addEventListener('touchend', onUp, true);
  }

  function escapeText(text) {
    return String(text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function plainTextToHtml(text) {
    var lines = String(text).replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n').split('\\n');
    if (!lines.length) return '<p><br></p>';
    return lines.map(function (line) {
      return '<p>' + (line ? escapeText(line) : '<br>') + '</p>';
    }).join('');
  }

  function sanitizePastedHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var styleBlocks = Array.from(doc.querySelectorAll('style')).map(function (s) { return s.outerHTML; }).join('');
    doc.querySelectorAll('[' + CARD_ATTR + '="' + CARD_VALUE + '"], .notebox-material-card').forEach(function (card) {
      var material = ((card.querySelector('.notebox-card-material-body') || {}).innerHTML || '').trim();
      var questions = ((card.querySelector('.notebox-card-questions-body') || {}).innerHTML || '').trim();
      var parts = [material, questions].filter(function (p) {
        return p && p !== '<br>' && p !== '<p><br></p>';
      });
      var wrap = doc.createElement('div');
      wrap.innerHTML = parts.length ? parts.join('') : escapeText(card.textContent || '');
      var frag = doc.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      card.replaceWith(frag);
    });
    doc.querySelectorAll('.notebox-card-cancel, .notebox-card-resize, .notebox-material-card-bar, .notebox-card-pane-title, [data-card-action]').forEach(function (el) {
      el.remove();
    });
    doc.querySelectorAll('.notebox-card-pane, .notebox-material-card-split').forEach(function (el) {
      var wrap = doc.createElement('div');
      wrap.innerHTML = el.innerHTML;
      var frag = doc.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      el.replaceWith(frag);
    });
    var bodyHtml = (doc.body && doc.body.innerHTML || '').trim();
    if (!bodyHtml) return '';
    return styleBlocks ? styleBlocks + bodyHtml : bodyHtml;
  }

  function shouldPreferPlainTextPaste(text, html) {
    if (!text.trim()) return false;
    if (!html.trim()) return true;
    var stripped = html.replace(/<!--[\\s\\S]*?-->/g, '').replace(/<\\/?(html|body|meta|link|head|style|xml)[^>]*>/gi, '').trim();
    var textOnly = stripped.replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim();
    var plain = text.replace(/\\s+/g, ' ').trim();
    if (textOnly && plain && textOnly === plain && !/style\\s*=|class\\s*=|<img\\b|<table\\b|<span\\b|<div\\b[^>]+style/i.test(html)) {
      return true;
    }
    return false;
  }

  function clipboardEventToHtml(e) {
    var html = (e.clipboardData && e.clipboardData.getData('text/html') || '').trim();
    var text = (e.clipboardData && e.clipboardData.getData('text/plain')) || '';
    if (html) {
      var cleaned = sanitizePastedHtml(html);
      if (cleaned && cleaned.replace(/<[^>]+>/g, '').trim()) {
        if (!shouldPreferPlainTextPaste(text, cleaned)) return cleaned;
      }
    }
    if (shouldPreferPlainTextPaste(text, html)) return plainTextToHtml(text);
    if (html) {
      var cleaned2 = sanitizePastedHtml(html);
      if (cleaned2) return cleaned2;
    }
    return plainTextToHtml(text);
  }

  function captureFormatFromSelection() {
    var sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0 || sel.isCollapsed) && savedRange) {
      try {
        sel.removeAllRanges();
        sel.addRange(savedRange.cloneRange());
      } catch (e) { return null; }
    }
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    var node = sel.anchorNode;
    if (!node || !editor.contains(node)) return null;
    var el = node.nodeType === 1 ? node : node.parentElement;
    if (!el) return null;
    var cs = window.getComputedStyle(el);
    var blockTag = null;
    var walk = el;
    while (walk && walk !== editor) {
      var tag = walk.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'p') { blockTag = tag; break; }
      walk = walk.parentElement;
    }
    var deco = (cs.textDecorationLine || '') + ' ' + (cs.textDecoration || '');
    return {
      bold: document.queryCommandState('bold') || cs.fontWeight === 'bold' || Number(cs.fontWeight) >= 600,
      italic: document.queryCommandState('italic') || cs.fontStyle === 'italic',
      underline: document.queryCommandState('underline') || deco.indexOf('underline') >= 0,
      strike: document.queryCommandState('strikeThrough') || deco.indexOf('line-through') >= 0,
      fontSize: cs.fontSize,
      color: cs.color,
      fontFamily: cs.fontFamily,
      blockTag: blockTag
    };
  }

  function applyCopiedFormat(fmt, range) {
    if (range.collapsed) return false;
    editor.focus();
    var sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    var span = document.createElement('span');
    span.style.fontSize = fmt.fontSize;
    span.style.color = fmt.color;
    span.style.fontFamily = fmt.fontFamily;
    if (fmt.bold) span.style.fontWeight = '700';
    if (fmt.italic) span.style.fontStyle = 'italic';
    var decorations = [];
    if (fmt.underline) decorations.push('underline');
    if (fmt.strike) decorations.push('line-through');
    if (decorations.length) span.style.textDecoration = decorations.join(' ');
    try {
      var live = sel.getRangeAt(0);
      try { live.surroundContents(span); }
      catch (e) {
        var fragment = live.extractContents();
        span.appendChild(fragment);
        live.insertNode(span);
      }
    } catch (e2) { return false; }
    saveSelection();
    emit();
    return true;
  }

  function exitFormatBrush(silent) {
    copiedFormat = null;
    paintSticky = false;
    formatBrushOn = false;
    editor.classList.remove('format-brush-cursor');
    document.getElementById('formatBrush').classList.remove('active');
    document.getElementById('formatBrush').textContent = '格式刷';
    if (!silent) status('');
  }

  function toggleFormatBrush(sticky) {
    if (formatBrushOn && !sticky) {
      exitFormatBrush();
      status('已取消格式刷');
      return;
    }
    var fmt = captureFormatFromSelection();
    if (!fmt) {
      status('请先选中一段有格式的文字，再点格式刷', true);
      return;
    }
    copiedFormat = fmt;
    paintSticky = sticky;
    formatBrushOn = true;
    editor.classList.add('format-brush-cursor');
    document.getElementById('formatBrush').classList.add('active');
    document.getElementById('formatBrush').textContent = '格式刷中';
    status(sticky
      ? '格式刷已锁定：选中文字即可刷格式，再点格式刷结束'
      : '格式刷已启用：拖选目标文字即可刷上格式');
  }

  function insertMaterialCard() {
    focusEditor();
    var wrap = document.createElement('div');
    wrap.innerHTML = buildMaterialCardHtml();
    var frag = document.createDocumentFragment();
    var insertedCard = null;
    while (wrap.firstChild) {
      if (!insertedCard && wrap.firstChild.classList && wrap.firstChild.classList.contains('notebox-material-card')) {
        insertedCard = wrap.firstChild;
      }
      frag.appendChild(wrap.firstChild);
    }
    var sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      var range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.appendChild(frag);
    }
    ensureMaterialCardChrome(editor);
    var materialBody = insertedCard && insertedCard.querySelector('.notebox-card-material-body');
    if (materialBody) {
      lastPane = materialBody;
      materialBody.focus();
      var r = document.createRange();
      r.selectNodeContents(materialBody);
      r.collapse(true);
      var s = window.getSelection();
      if (s) { s.removeAllRanges(); s.addRange(r); }
    }
    saveSelection();
    emit();
    status('已插入材料 card，可直接粘贴到「材料内容」');
  }

  // Toolbar
  document.getElementById('toolbar').addEventListener('mousedown', function (ev) {
    var btn = ev.target.closest('button');
    if (!btn) return;
    ev.preventDefault();
  });

  document.querySelectorAll('[data-cmd]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      runCommand(btn.getAttribute('data-cmd'));
    });
  });
  document.querySelectorAll('[data-block]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      runCommand('formatBlock', btn.getAttribute('data-block'));
    });
  });
  document.getElementById('applySize').addEventListener('click', function () {
    var px = Number(document.getElementById('fontSize').value);
    if (!isFinite(px) || px < 8 || px > 96) {
      status('字号无效，请输入 8–96', true);
      return;
    }
    applyInlineStyle({ fontSize: px + 'px' });
  });
  document.getElementById('applyColor').addEventListener('click', function () {
    applyInlineStyle({ color: document.getElementById('fontColor').value });
  });
  document.getElementById('fontColor').addEventListener('change', function (e) {
    applyInlineStyle({ color: e.target.value });
  });
  document.getElementById('fontColor').addEventListener('focus', saveSelection);
  document.getElementById('formatBrush').addEventListener('click', function () {
    toggleFormatBrush(false);
  });
  document.getElementById('formatBrush').addEventListener('dblclick', function (ev) {
    ev.preventDefault();
    toggleFormatBrush(true);
  });
  document.getElementById('btnImage').addEventListener('click', function () {
    post({ type: 'requestImage' });
  });
  document.getElementById('btnCard').addEventListener('click', insertMaterialCard);

  editor.addEventListener('input', function () {
    saveSelection();
    emit();
  }, true);

  editor.addEventListener('keyup', saveSelection);
  editor.addEventListener('mouseup', function () {
    saveSelection();
    if (formatBrushOn && copiedFormat && savedRange && !savedRange.collapsed) {
      applyCopiedFormat(copiedFormat, savedRange.cloneRange());
      if (!paintSticky) exitFormatBrush(true);
    }
  });
  editor.addEventListener('blur', saveSelection);

  editor.addEventListener('focusin', function (ev) {
    var t = ev.target;
    var pane = t && t.closest && t.closest('.notebox-card-pane-body');
    if (pane && editor.contains(pane)) lastPane = pane;
  }, true);

  editor.addEventListener('paste', function (ev) {
    var html = clipboardEventToHtml(ev);
    if (!html) return;
    ev.preventDefault();
    ev.stopPropagation();
    var pane = resolvePastePane(editor);
    if (pane) {
      lastPane = pane;
      insertHtmlIntoEditable(pane, html);
      ensureMaterialCardChrome(editor);
      var card = findMaterialCard(pane);
      fixMaterialCardLayout(card);
      requestAnimationFrame(function () { fixMaterialCardLayout(card); });
      saveSelection();
      emit();
      return;
    }
    document.execCommand('insertHTML', false, html);
    ensureMaterialCardChrome(editor);
    saveSelection();
    emit();
  }, true);

  document.addEventListener('pointerdown', function (ev) {
    var target = ev.target;
    if (isCancelControl(target)) {
      var card = findMaterialCard(target);
      if (card && editor.contains(card)) {
        ev.preventDefault();
        ev.stopPropagation();
        unwrapMaterialCard(card);
        clearActiveCards();
        emit();
        status('已取消 card');
      }
      return;
    }
    var handle = target.classList && target.classList.contains('notebox-card-resize')
      ? target
      : (target.closest && target.closest('.notebox-card-resize'));
    if (handle && editor.contains(handle)) {
      ev.preventDefault();
      ev.stopPropagation();
      startMaterialCardResize(handle, ev.clientY, ev.pointerId);
    }
  }, true);

  editor.addEventListener('click', function (ev) {
    var target = ev.target;
    if (isCancelControl(target)) return;
    if (target.classList && (target.classList.contains('notebox-card-resize') || target.closest('.notebox-card-resize'))) return;
    var card = findMaterialCard(target);
    clearActiveCards();
    if (card && editor.contains(card)) {
      card.classList.add('is-active');
      var paneWrap = target.closest && target.closest('.notebox-card-pane');
      var paneBody = (paneWrap && paneWrap.querySelector('.notebox-card-pane-body'))
        || (target.closest && target.closest('.notebox-card-pane-body'))
        || card.querySelector('.notebox-card-material-body');
      if (paneBody && !(target.closest && target.closest('.notebox-card-pane-body'))) {
        ev.preventDefault();
        lastPane = paneBody;
        paneBody.focus();
        var r = document.createRange();
        r.selectNodeContents(paneBody);
        r.collapse(false);
        var s = window.getSelection();
        if (s) { s.removeAllRanges(); s.addRange(r); }
      } else if (paneBody) {
        lastPane = paneBody;
      }
    }
    if (target.tagName === 'IMG') {
      editor.querySelectorAll('img.notebox-img-selected').forEach(function (img) {
        img.classList.remove('notebox-img-selected');
      });
      target.classList.add('notebox-img-selected');
    } else {
      editor.querySelectorAll('img.notebox-img-selected').forEach(function (img) {
        img.classList.remove('notebox-img-selected');
      });
    }
    saveSelection();
  });

  editor.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Backspace' && ev.key !== 'Delete') return;
    var active = editor.querySelector('.notebox-material-card.is-active');
    var anchor = window.getSelection() && window.getSelection().anchorNode;
    var anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
    var fromSel = findMaterialCard(anchorEl);
    var card = active || fromSel;
    if (!card || !editor.contains(card)) return;
    var t = ev.target;
    if (t && t.closest && t.closest('.notebox-card-pane-body')) {
      var body = t.closest('.notebox-card-pane-body');
      var text = (body.innerText || '').replace(/\\u200b/g, '').trim();
      if (text.length > 0) return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    removeMaterialCard(card);
    clearActiveCards();
    emit();
    status('已删除材料 card');
  }, true);

  window.__NOTEBOX_SET_HTML = function (html, key) {
    lastExternalKey = key || '';
    suppressEmit = true;
    editor.innerHTML = html || '<p><br></p>';
    ensureMaterialCardChrome(editor);
    clearActiveCards();
    exitFormatBrush(true);
    suppressEmit = false;
  };

  window.__NOTEBOX_INSERT_HTML = function (html) {
    focusEditor();
    document.execCommand('insertHTML', false, html);
    ensureMaterialCardChrome(editor);
    saveSelection();
    emit();
  };

  window.__NOTEBOX_SET_UPLOADING = function (uploading) {
    var btn = document.getElementById('btnImage');
    btn.disabled = !!uploading;
    btn.textContent = uploading ? '上传中…' : '图片';
  };

  suppressEmit = true;
  editor.innerHTML = ${initial};
  ensureMaterialCardChrome(editor);
  suppressEmit = false;
  post({ type: 'ready' });
})();
</script>
</body>
</html>`
}
