import re, html

SITE = 'https://joshuasharmon-stack.github.io/first-ultra/'
APP_ID = '6824324954'
# Swap for the App Store Connect campaign link once it exists.
STORE = f'https://apps.apple.com/us/app/first-ultra/id{APP_ID}'
# Apple's official badge, saved from Apple's Marketing Resources, replaces the stand-in button.
import os
BADGE_FILE = 'assets/app-store-badge.svg'
BADGE = (f'<img src="{BADGE_FILE}" alt="Download on the App Store" width="168" height="56">' if os.path.exists(BADGE_FILE)
         else '<span class="store"><small>Download on the</small>App Store</span>')
EMAIL = 'Papaspudsllc@gmail.com'

def md2html(src):
    out=[]; inlist=False
    def inline(t):
        t=html.escape(t, quote=False)
        t=re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
        t=re.sub(r'_(.+?)_', r'<em>\1</em>', t)
        t=re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', t)
        return t
    for line in src.splitlines():
        if line.startswith('- '):
            if not inlist: out.append('<ul>'); inlist=True
            out.append('<li>'+inline(line[2:])+'</li>'); continue
        if inlist: out.append('</ul>'); inlist=False
        if line.startswith('# '): out.append('<h1>'+inline(line[2:])+'</h1>')
        elif line.startswith('## '): out.append('<h2>'+inline(line[3:])+'</h2>')
        elif line.strip()=='---': out.append('<hr>')
        elif line.strip(): out.append('<p>'+inline(line)+'</p>')
    if inlist: out.append('</ul>')
    return '\n'.join(out)

NAV = [('index.html','Home'),('support.html','Support'),('privacy.html','Privacy')]

def page(path, title, desc, body, wide=False):
    nav=''.join(f'<a href="{h}"{" aria-current=page" if h==path else ""}>{t}</a>' for h,t in NAV)
    canon = SITE + ('' if path=='index.html' else path)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="apple-itunes-app" content="app-id={APP_ID}">
<meta name="theme-color" content="#0B1B3A">
<link rel="canonical" href="{canon}">
<link rel="icon" href="assets/favicon.png"><link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<meta property="og:type" content="website"><meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}"><meta property="og:url" content="{canon}">
<meta property="og:image" content="{SITE}assets/og.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="assets/site.css">
</head><body>
<header class="top"><div class="wrap">
<a class="brand" href="index.html"><img src="assets/icon.png" alt="" width="32" height="32">First Ultra</a>
<nav>{nav}</nav>
</div></header>
<main{' class="doc"' if not wide else ''}>
{body}
</main>
<footer class="foot"><div class="wrap">
<p><a href="support.html">Support</a> · <a href="privacy.html">Privacy policy</a> · <a href="mailto:{EMAIL}">{EMAIL}</a></p>
<p>First Ultra is a training planner, not medical advice. Check with a doctor before starting, and stop if something hurts.</p>
<p>© 2026 PapaSpuds LLC. Apple, Apple Watch and iPhone are trademarks of Apple Inc.</p>
</div></footer>
</body></html>'''

def fill(t):
    return t.replace('{{STORE}}', STORE).replace('{{BADGE}}', BADGE).replace('{{EMAIL}}', EMAIL)

pages = [
    ('index.html', 'First Ultra: zero to your first ultramarathon',
     'Run/walk training for your first 50K, 50 miles, 100K or 100 miles, with a gentler plan for bigger runners. iPhone and Apple Watch. Pay once, no subscription.',
     fill(open('_home.html').read()), True),
    ('support.html', 'First Ultra: Support',
     'Help and contact for First Ultra, the run/walk ultramarathon training app for iPhone and Apple Watch.',
     md2html(open('support.md').read()), False),
    ('privacy.html', 'First Ultra: Privacy Policy',
     'First Ultra keeps your data on your devices and in your own iCloud. No accounts, no servers, no tracking.',
     md2html(open('privacy.md').read()), False),
]
for path, title, desc, body, wide in pages:
    open(path, 'w').write(page(path, title, desc, body, wide))
