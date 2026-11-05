// A tiny element builder. All page content is created with h() and appended as
// nodes, and text only ever goes in as text nodes. Nothing in this app builds
// markup from strings (no innerHTML), so a title like "<img onerror=...>" typed
// by a user is shown literally and can never run as code. Keep it that way.

// h('a', { class: 'row', href: '/x', onclick: fn }, 'Label', otherNode)
export function h(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  let value;

  for (const [name, setting] of Object.entries(props ?? {})) {
    if (setting === undefined || setting === null || setting === false) continue;

    if (name.startsWith('on') && typeof setting === 'function') {
      element.addEventListener(name.slice(2).toLowerCase(), setting);
    } else if (name === 'class') {
      element.className = setting;
    } else if (name === 'dataset') {
      Object.assign(element.dataset, setting);
    } else if (name === 'value') {
      value = setting; // applied after children so <select> already has its options
    } else if (name === 'checked' || name === 'selected' || name === 'indeterminate') {
      element[name] = Boolean(setting);
    } else if ((name === 'href' || name === 'src') && /^\s*(javascript|data|vbscript):/i.test(String(setting))) {
      continue; // never let a URL run code
    } else {
      element.setAttribute(name, setting === true ? '' : setting);
    }
  }

  appendChildren(element, children);
  if (value !== undefined) element.value = value;
  return element;
}

export function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false || child === true) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// Replaces everything inside `parent`.
export function render(parent, ...children) {
  parent.replaceChildren();
  appendChildren(parent, children);
}

export const $ = (selector, root = document) => root.querySelector(selector);
