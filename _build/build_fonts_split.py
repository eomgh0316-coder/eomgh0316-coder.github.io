"""Subset Pretendard into Latin and Hangul woff2 files for the bilingual portfolio, and write two stylesheets.

fonts.css         -> url(fonts/*.woff2), for the hosted site (browsers fetch the Hangul files only when Korean text renders)
fonts-inline.css  -> the same faces as data URIs, for the claude.ai artifact (its CSP only reliably allows inlined fonts)

Characters come from index.html and app.js, so re-run after any copy change.
Usage: python build_fonts_split.py <site_dir> <Pretendard-1.3.9.zip>
"""
import base64, io, sys, zipfile
from pathlib import Path
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

site = Path(sys.argv[1])
archive = zipfile.ZipFile(sys.argv[2])
names = {Path(i.filename).name: i for i in archive.infolist()}

FACES = [  # (family, file, CSS weight range, slug)
    ('Pretendard', 'Pretendard-Regular.otf', '300 400', 'regular'),
    ('Pretendard', 'Pretendard-Medium.otf', '500', 'medium'),
    ('Pretendard', 'Pretendard-SemiBold.otf', '600', 'semibold'),
    ('Pretendard', 'Pretendard-Bold.otf', '700 900', 'bold'),
]

text = (site / 'index.html').read_text(encoding='utf-8') + (site / 'app.js').read_text(encoding='utf-8')
used = {ord(c) for c in text if ord(c) >= 0x20}
hangul = sorted(c for c in used if 0xAC00 <= c <= 0xD7A3 or 0x3130 <= c <= 0x318F)
# Latin: printable ASCII, Latin-1, punctuation and anything else non-Hangul the page uses.
latin_base = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2010, 0x2028)) | set(range(0x2030, 0x203B)) | {0x2212}
latin = sorted(latin_base | {c for c in used if not (0xAC00 <= c <= 0xD7A3 or 0x3130 <= c <= 0x318F)})


def ranges(points):
    spans, start = [], points[0]
    for prev, cur in zip(points, points[1:] + [None]):
        if cur != prev + 1:
            spans.append(f'U+{start:X}' if start == prev else f'U+{start:X}-{prev:X}')
            start = cur
    return ', '.join(spans)


out_dir = site / 'fonts'
out_dir.mkdir(exist_ok=True)
linked, inline = [], []
for family, filename, weight, slug in FACES:
    raw = archive.read(names[filename])
    for part, points in (('latin', latin), ('hangul', hangul)):
        font = TTFont(io.BytesIO(raw))
        cmap = font.getBestCmap()
        points = [p for p in points if p in cmap]  # only what the face can draw; the rest falls back
        if not points:
            continue
        options = Options()
        options.flavor = 'woff2'
        options.layout_features = Options().layout_features + ['tnum']  # tabular figures for the stat numerals
        options.name_IDs = ['*']  # keep the copyright and OFL licence records the licence requires
        subsetter = Subsetter(options)
        subsetter.populate(unicodes=points)
        subsetter.subset(font)
        buf = io.BytesIO()
        font.flavor = 'woff2'
        font.save(buf)
        data = buf.getvalue()
        name = f'pretendard-{slug}-{part}.woff2'
        (out_dir / name).write_bytes(data)
        rule = '@font-face {{ font-family: "{f}"; src: {src} format("woff2"); font-weight: {w}; font-style: normal; font-display: swap; unicode-range: {r}; }}'
        linked.append(rule.format(f=family, src=f'url("fonts/{name}")', w=weight, r=ranges(points)))
        inline.append(rule.format(f=family, src=f'url(data:font/woff2;base64,{base64.b64encode(data).decode()})', w=weight, r=ranges(points)))
        print(f'{name}: {len(data) / 1024:.1f} KB, {len(points)} code points')

(out_dir / 'OFL.txt').write_bytes(archive.read(names['LICENSE.txt']))
header = '/* Pretendard (c) 2021 Kil Hyung-jin, SIL Open Font License 1.1 (fonts/OFL.txt). Subset to this site by tools/build_fonts_split.py; re-run after copy changes. */\n'
(site / 'fonts.css').write_text(header + '\n'.join(linked) + '\n', encoding='utf-8')
(site / 'fonts-inline.css').write_text(header + '\n'.join(inline) + '\n', encoding='utf-8')
print(f'latin {len(latin)} / hangul {len(hangul)} code points -> fonts.css, fonts-inline.css')
