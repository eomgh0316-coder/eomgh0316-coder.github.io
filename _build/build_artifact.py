"""Package the hosted site (index.html + fonts-inline.css + styles.css + app.js) as one claude.ai artifact page.

The artifact viewer wraps the file in its own <html>/<head>/<body>, cannot print (so the Print CV buttons are removed),
and only reliably loads inlined fonts. The language attribute is set by a tiny script at the very top so the page
never flashes both languages before app.js runs. Referenced images and videos are copied next to the page.
Usage: python build_artifact.py <site_dir> <out_dir>
"""
import re, shutil, sys
from pathlib import Path

site, out = Path(sys.argv[1]), Path(sys.argv[2])
html = (site / 'index.html').read_text(encoding='utf-8')

desc = re.search(r'<meta name="description" content="([^"]*)"', html)
body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
body, n_print = re.subn(r'<button\b[^>]*\bdata-print\b[^>]*>.*?</button>', '', body, flags=re.S)  # window.print() is inert in the viewer
body = re.sub(r'<script\b[^>]*\bsrc="app\.js"[^>]*>\s*</script>', '', body)
# mailto: is unreliable in the viewer: the hero button jumps to the contact section, and the address becomes
# selectable text next to the copy button (app.js selects its first text node when the clipboard API is refused).
body, n_hero = re.subn(r'(<a class="button secondary") href="mailto:[^"]+"(>.*?)<span aria-hidden="true">↗</span></a>',
                       r'\1 href="#contact"\2<span aria-hidden="true">↓</span></a>', body, count=1, flags=re.S)
body, n_mail = re.subn(r'<a class="contact-email" href="mailto:[^"]+">([^<]+?)\s*<span aria-hidden="true">↗</span></a>',
                       r'<p class="contact-email" translate="no">\1</p>', body, count=1)
assert n_hero == 1 and n_mail == 1, f'mailto rewrites matched {n_hero}, {n_mail}'
for banned in ('data-print', 'mailto:', 'cdn-cgi', '<script src='):
    assert banned not in body, f'{banned!r} left in the artifact body'

early_lang = ("<script>(function(){var l='en';try{l=localStorage.getItem('gheom-language')||'en';}catch(e){}"
              "if(l!=='ko')l='en';var r=document.documentElement;r.setAttribute('data-lang',l);r.lang=l;})();</script>")
page = '\n'.join([
    '<title>Ga-Hyeon Eom</title>',
    f'<meta name="description" content="{desc.group(1)}">' if desc else '',
    '<style>',
    (site / 'fonts-inline.css').read_text(encoding='utf-8'),
    (site / 'styles.css').read_text(encoding='utf-8'),
    'p.contact-email { user-select: all; cursor: text; }',
    '</style>',
    early_lang,
    body.strip(),
    '<script>',
    (site / 'app.js').read_text(encoding='utf-8'),
    '</script>',
])
out.mkdir(parents=True, exist_ok=True)
(out / 'gahyeon-eom.html').write_text(page, encoding='utf-8')

media = sorted(set(re.findall(r'(?:src|poster|data-image|href)="((?:img|video)/[^"]+)"', page)))
for rel in media:
    dest = out / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(site / rel, dest)
print(f'artifact page: {len(page) / 1024:.0f} KB; {len(media)} media files; print buttons removed: {n_print}')
print('MEDIA ' + ' '.join(media))
