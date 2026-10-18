#!/usr/bin/env python3
"""Ajoute data-content-key / data-image-key aux textes et images qui n'en ont pas.

Idempotent : les éléments déjà clés sont ignorés. Usage : python3 tools/add-keys.py
"""
import hashlib, re, sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = {
    'index.html': 'home', 'a-propos.html': 'about', 'massage.html': 'massage',
    'soins-energetiques.html': 'reiki', 'tarifs.html': 'tarifs', 'temoignages.html': 'testy',
    'contact.html': 'contact', 'mentions-legales.html': 'legal', 'confidentialite.html': 'privacy',
}
VOID = {'br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track'}
INLINE = {'a', 'abbr', 'b', 'br', 'cite', 'code', 'em', 'i', 'mark', 'small', 'span', 'strong', 'sub', 'sup', 'u', 'time', 'q', 's', 'wbr', 'font', 'bdi'}
CANDIDATES = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'span', 'a', 'div', 'cite', 'blockquote',
              'figcaption', 'td', 'th', 'dt', 'dd', 'strong', 'em', 'small', 'summary', 'label'}
SKIP = {'script', 'style', 'svg', 'noscript', 'select', 'option', 'textarea', 'form', 'head', 'button'}
ENTITY_OK = re.compile(r'&(amp|euro|eacute|egrave|agrave|ecirc|ccedil|rsquo|lsquo|laquo|raquo|hellip|oelig);', re.I)


class Node:
    def __init__(self, tag, attrs, insert_pos, parent):
        self.tag, self.attrs, self.insert_pos, self.parent = tag, dict(attrs), insert_pos, parent
        self.children, self.text = [], ''


class Builder(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.lines = [0]
        for m in re.finditer('\n', src):
            self.lines.append(m.end())
        self.root = Node('#root', [], 0, None)
        self.cur = self.root

    def abs_pos(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        raw = self.get_starttag_text()
        end = self.abs_pos() + len(raw)
        pos = end - 2 if raw.endswith('/>') else end - 1
        n = Node(tag, attrs, pos, self.cur)
        self.cur.children.append(n)
        if tag not in VOID and not raw.endswith('/>'):
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.text += data

    def handle_entityref(self, name):
        self.cur.text += '&%s;' % name if ENTITY_OK.match('&%s;' % name) else ' '

    def handle_charref(self, name):
        self.cur.text += ' '


def has_text(n):
    if re.search(r'[A-Za-zÀ-ÿ0-9]', n.text) or ENTITY_OK.search(n.text):
        return True
    return any(has_text(c) for c in n.children)


def direct_text(n):
    return bool(re.search(r'[A-Za-zÀ-ÿ0-9]', n.text))


def is_inline(c):
    if c.tag not in INLINE:
        return False
    if c.tag == 'a' and 'btn' in c.attrs.get('class', '').split():
        return False
    return all_inline(c)


def all_inline(n):
    if 'marquee-track' in n.attrs.get('class', '') or 'hero-actions' in n.attrs.get('class', ''):
        return False
    links = [c for c in n.children if c.tag == 'a']
    if len(links) >= 2 and not direct_text(n):
        return False
    return all(is_inline(c) for c in n.children)


def has_key(n):
    return 'data-content-key' in n.attrs or 'data-image-key' in n.attrs


def process(path, prefix):
    src = path.read_text(encoding='utf-8')
    b = Builder(src)
    b.feed(src)
    inserts = []
    counters = {'t': 0, 'img': 0}
    used_footer = {}

    def walk(n, in_footer, in_nav):
        for c in n.children:
            if c.tag in SKIP:
                continue
            is_nav = c.tag == 'nav' and 'navbar' in c.attrs.get('class', '')
            if is_nav:
                continue
            footer = in_footer or c.tag == 'footer'
            if c.tag == 'img':
                if 'data-image-key' not in c.attrs and 'data-content-key' not in c.attrs:
                    if footer:
                        key = 'footer_auto_logo' if 'footer-logo' in c.attrs.get('class', '') else None
                    else:
                        counters['img'] += 1
                        key = '%s_auto_img%d' % (prefix, counters['img'])
                    if key:
                        inserts.append((c.insert_pos, ' data-image-key="%s"' % key))
                continue
            if has_key(c):
                continue
            if c.tag in CANDIDATES and 'id' not in c.attrs and has_text(c) and all_inline(c):
                if footer:
                    h = hashlib.sha1((c.tag + re.sub(r'\s+', ' ', collect(c))).encode()).hexdigest()[:6]
                    used_footer[h] = used_footer.get(h, 0) + 1
                    key = 'footer_auto_' + h + ('' if used_footer[h] == 1 else '_%d' % used_footer[h])
                else:
                    counters['t'] += 1
                    key = '%s_auto_t%d' % (prefix, counters['t'])
                inserts.append((c.insert_pos, ' data-content-key="%s"' % key))
                continue
            walk(c, footer, in_nav)

    def collect(n):
        return n.text + ''.join(collect(c) for c in n.children)

    walk(b.root, False, False)
    for pos, text in sorted(inserts, reverse=True):
        src = src[:pos] + text + src[pos:]
    path.write_text(src, encoding='utf-8')
    return len(inserts)


if __name__ == '__main__':
    for name, prefix in PAGES.items():
        print(name, process(ROOT / name, prefix))
