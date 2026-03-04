const ALLOWED_TAGS = new Set([
  'p', 'br', 'b', 'i', 'u', 'em', 'strong', 'a', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'hr', 'sup', 'sub',
]);

const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  '*': new Set(['class']),
};

function isAllowedAttribute(tag: string, attr: string): boolean {
  const globalAllowed = ALLOWED_ATTRIBUTES['*'];
  const tagAllowed = ALLOWED_ATTRIBUTES[tag];
  return (globalAllowed?.has(attr) || tagAllowed?.has(attr)) ?? false;
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return parsed.href;
    }
    return '';
  } catch {
    return '';
  }
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  function walk(node: Node): Node | null {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const el = node as Element;
    const tagName = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = document.createDocumentFragment();
      for (const child of Array.from(el.childNodes)) {
        const cleaned = walk(child);
        if (cleaned) fragment.appendChild(cleaned);
      }
      return fragment;
    }

    const newEl = document.createElement(tagName);

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) continue;
      if (!isAllowedAttribute(tagName, name)) continue;

      let value = attr.value;
      if (name === 'href' || name === 'src') {
        value = sanitizeUrl(value);
        if (!value) continue;
      }
      newEl.setAttribute(name, value);
    }

    if (tagName === 'a' && !newEl.getAttribute('rel')) {
      newEl.setAttribute('rel', 'noopener noreferrer');
    }

    for (const child of Array.from(el.childNodes)) {
      const cleaned = walk(child);
      if (cleaned) newEl.appendChild(cleaned);
    }

    return newEl;
  }

  const fragment = document.createDocumentFragment();
  for (const child of Array.from(body.childNodes)) {
    const cleaned = walk(child);
    if (cleaned) fragment.appendChild(cleaned);
  }

  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}
