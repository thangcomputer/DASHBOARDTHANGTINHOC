import { translateText } from '../../../shared/i18n/translate.mjs';

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'TEMPLATE',
  'TEXTAREA',
  'CODE',
  'PRE',
]);

const TRANSLATABLE_ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset']);

const originalTextMap = new WeakMap();
const lastWrittenTextMap = new WeakMap();
const originalAttrMap = new WeakMap();
const lastWrittenAttrMap = new WeakMap();
const groupedElements = new WeakSet();

let originalDocTitle = null;
let lastWrittenDocTitle = null;

function isSkippedElement(el) {
  if (!el || el.nodeType !== 1) return false;
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (typeof el.closest === 'function') {
    const blocked = el.closest(
      'script, style, noscript, template, textarea, code, pre, [contenteditable="true"], [contenteditable=""], [data-no-translate="true"], [data-no-translate=""], .notranslate'
    );
    if (blocked) return true;
  }
  return false;
}

function getElementForTextNode(node) {
  return node?.parentElement || node?.parentNode || null;
}

function getDirectTextNodes(el) {
  const nodes = [];
  if (!el || !el.childNodes) return nodes;
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const child = el.childNodes[i];
    if (child.nodeType === 1) return null; // contains Element child -> not pure inline text group
    if (child.nodeType === 3) nodes.push(child);
  }
  return nodes;
}

function syncTextGroupElement(el, lang) {
  if (!el || el.nodeType !== 1 || isSkippedElement(el)) return false;
  const textNodes = getDirectTextNodes(el);
  if (!textNodes || textNodes.length < 2) return false;

  const sources = textNodes.map((node) => {
    const current = node.nodeValue ?? '';
    const lastWritten = lastWrittenTextMap.get(node);
    if (!originalTextMap.has(node) || (lastWritten !== undefined && current !== lastWritten)) {
      originalTextMap.set(node, current);
    }
    return originalTextMap.get(node) ?? current;
  });

  const combinedSource = sources.join('');
  if (!combinedSource.trim()) return false;

  if (lang !== 'en') {
    textNodes.forEach((node, idx) => {
      const orig = sources[idx];
      lastWrittenTextMap.set(node, orig);
      if (node.nodeValue !== orig) node.nodeValue = orig;
    });
    return true;
  }

  const combinedTarget = translateText(combinedSource, 'en');
  if (combinedTarget !== combinedSource) {
    groupedElements.add(el);
    textNodes.forEach((node, idx) => {
      const nextVal = idx === 0 ? combinedTarget : '';
      lastWrittenTextMap.set(node, nextVal);
      if (node.nodeValue !== nextVal) node.nodeValue = nextVal;
    });
    return true;
  }

  textNodes.forEach((node) => syncTextNode(node, lang));
  return true;
}

function restoreElementIfCollapsed(el, lang) {
  if (!el || !groupedElements.has(el)) return;
  const textNodes = getDirectTextNodes(el);
  if (!textNodes || textNodes.length === 1) {
    groupedElements.delete(el);
    if (textNodes && textNodes[0]) {
      const node = textNodes[0];
      const orig = originalTextMap.get(node);
      if (orig !== undefined && lastWrittenTextMap.get(node) === node.nodeValue) {
        node.nodeValue = orig;
        lastWrittenTextMap.set(node, orig);
      }
      syncTextNode(node, lang);
    }
  }
}

function syncTextNode(node, lang) {
  if (!node || node.nodeType !== 3) return;
  const parent = getElementForTextNode(node);
  if (!parent || isSkippedElement(parent)) return;

  const current = node.nodeValue ?? '';
  if (!current.trim()) return;

  const lastWritten = lastWrittenTextMap.get(node);
  // If external code/React updated the text node cleanly (or first time seen), capture as new source.
  if (!originalTextMap.has(node) || (lastWritten !== undefined && current !== lastWritten)) {
    originalTextMap.set(node, current);
  }

  const source = originalTextMap.get(node) ?? current;
  const target = lang === 'en' ? translateText(source, 'en') : source;

  lastWrittenTextMap.set(node, target);
  if (current !== target) {
    node.nodeValue = target;
  }
}

function syncElementAttributes(el, lang) {
  if (!el || el.nodeType !== 1 || isSkippedElement(el)) return;

  let origAttrs = originalAttrMap.get(el);
  let lastAttrs = lastWrittenAttrMap.get(el);

  let attrs = TRANSLATABLE_ATTRS;
  if (el.tagName === 'INPUT' && BUTTON_INPUT_TYPES.has((el.type || '').toLowerCase())) {
    attrs = [...TRANSLATABLE_ATTRS, 'value'];
  } else if (el.tagName === 'OPTGROUP' || el.tagName === 'OPTION') {
    attrs = [...TRANSLATABLE_ATTRS, 'label'];
  }

  for (const attr of attrs) {
    if (!el.hasAttribute(attr)) continue;
    const current = el.getAttribute(attr);
    if (current == null || !String(current).trim()) continue;

    if (!origAttrs) {
      origAttrs = {};
      originalAttrMap.set(el, origAttrs);
    }
    if (!lastAttrs) {
      lastAttrs = {};
      lastWrittenAttrMap.set(el, lastAttrs);
    }

    if (!(attr in origAttrs) || (lastAttrs[attr] !== undefined && current !== lastAttrs[attr])) {
      origAttrs[attr] = current;
    }

    const source = origAttrs[attr] ?? current;
    const target = lang === 'en' ? translateText(source, 'en') : source;

    lastAttrs[attr] = target;
    if (current !== target) {
      el.setAttribute(attr, target);
    }
  }
}

export function syncDocumentTitle(lang) {
  if (typeof document === 'undefined') return;
  const current = document.title ?? '';
  if (!current) return;

  if (originalDocTitle === null || (lastWrittenDocTitle !== null && current !== lastWrittenDocTitle)) {
    originalDocTitle = current;
  }
  const source = originalDocTitle ?? current;
  const target = lang === 'en' ? translateText(source, 'en') : source;

  lastWrittenDocTitle = target;
  if (current !== target) {
    document.title = target;
  }
}

export function translateSubtree(root, lang) {
  if (!root || typeof document === 'undefined') return;

  if (root.nodeType === 3) {
    const parent = getElementForTextNode(root);
    if (parent && syncTextGroupElement(parent, lang)) return;
    syncTextNode(root, lang);
    return;
  }

  const handledGroups = new Set();

  if (root.nodeType === 1) {
    if (isSkippedElement(root)) return;
    syncElementAttributes(root, lang);
    if (syncTextGroupElement(root, lang)) {
      handledGroups.add(root);
    }
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node.nodeType === 1 && isSkippedElement(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    if (currentNode.nodeType === 1) {
      syncElementAttributes(currentNode, lang);
      if (syncTextGroupElement(currentNode, lang)) {
        handledGroups.add(currentNode);
      }
    } else if (currentNode.nodeType === 3) {
      if (!handledGroups.has(currentNode.parentNode)) {
        syncTextNode(currentNode, lang);
      }
    }
    currentNode = walker.nextNode();
  }
}

export function startDomAutoTranslation(getLanguage) {
  if (typeof document === 'undefined' || !document.body) {
    return { applyNow() {}, destroy() {} };
  }

  const applyAll = () => {
    const lang = getLanguage();
    syncDocumentTitle(lang);
    translateSubtree(document.body, lang);
  };

  const observer = new MutationObserver((mutations) => {
    const lang = getLanguage();
    if (lang !== 'en') {
      return;
    }

    const targets = new Set();
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const node = m.target;
        if (node.nodeValue !== lastWrittenTextMap.get(node)) {
          const parent = getElementForTextNode(node);
          if (parent && syncTextGroupElement(parent, lang)) {
            continue;
          }
          syncTextNode(node, lang);
        }
      } else if (m.type === 'attributes') {
        const el = m.target;
        const attrName = m.attributeName;
        if (
          el &&
          attrName &&
          el.getAttribute?.(attrName) !== lastWrittenAttrMap.get(el)?.[attrName]
        ) {
          syncElementAttributes(el, lang);
        }
      } else if (m.type === 'childList') {
        const parent = m.target;
        if (parent && parent.nodeType === 1 && !isSkippedElement(parent)) {
          if (m.removedNodes && m.removedNodes.length > 0) {
            restoreElementIfCollapsed(parent, lang);
          }
          if (getDirectTextNodes(parent)?.length >= 2) {
            targets.add(parent);
            continue;
          }
        }
        m.addedNodes.forEach((added) => {
          if (added && added.nodeType === 1) {
            targets.add(added);
          } else if (added && added.nodeType === 3) {
            const p = getElementForTextNode(added);
            targets.add(p && getDirectTextNodes(p)?.length >= 2 ? p : added);
          }
        });
      }
    }

    if (targets.size > 0) {
      targets.forEach((node) => translateSubtree(node, lang));
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...TRANSLATABLE_ATTRS, 'label'],
  });

  // Also observe <title> changes in <head>
  let titleObserver = null;
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver = new MutationObserver(() => {
      const lang = getLanguage();
      if (document.title !== lastWrittenDocTitle) {
        syncDocumentTitle(lang);
      }
    });
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  }

  // Wrap native browser alert/confirm/prompt dialogs when translating to English
  const origAlert = typeof window !== 'undefined' ? window.alert : null;
  const origConfirm = typeof window !== 'undefined' ? window.confirm : null;
  const origPrompt = typeof window !== 'undefined' ? window.prompt : null;
  if (typeof window !== 'undefined') {
    if (typeof origAlert === 'function') {
      window.alert = (msg) => {
        const lang = getLanguage();
        const nextMsg = lang === 'en' && typeof msg === 'string' ? translateText(msg, 'en') : msg;
        return origAlert.call(window, nextMsg);
      };
    }
    if (typeof origConfirm === 'function') {
      window.confirm = (msg) => {
        const lang = getLanguage();
        const nextMsg = lang === 'en' && typeof msg === 'string' ? translateText(msg, 'en') : msg;
        return origConfirm.call(window, nextMsg);
      };
    }
    if (typeof origPrompt === 'function') {
      window.prompt = (msg, defaultVal) => {
        const lang = getLanguage();
        const nextMsg = lang === 'en' && typeof msg === 'string' ? translateText(msg, 'en') : msg;
        return origPrompt.call(window, nextMsg, defaultVal);
      };
    }
  }

  applyAll();

  return {
    applyNow() {
      applyAll();
    },
    destroy() {
      observer.disconnect();
      if (titleObserver) titleObserver.disconnect();
      if (typeof window !== 'undefined') {
        if (origAlert) window.alert = origAlert;
        if (origConfirm) window.confirm = origConfirm;
        if (origPrompt) window.prompt = origPrompt;
      }
    },
  };
}
