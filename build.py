import re, html, sys
def md2html(src, title):
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
    body='\n'.join(out)
    return f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<style>
:root{{--bg:#F1F4EF;--ink:#16201A;--muted:#58665C;--accent:#1E3F73;--line:#D5DDD3}}
@media(prefers-color-scheme:dark){{:root{{--bg:#0F1411;--ink:#E4EBE5;--muted:#9AA79E;--accent:#8DB2E8;--line:#2B362E}}}}
body{{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}}
main{{max-width:680px;margin:0 auto;padding:40px 20px 60px}}
h1{{font-size:30px;line-height:1.15;margin:0 0 6px}}h2{{font-size:20px;margin:32px 0 8px}}
a{{color:var(--accent)}}hr{{border:0;border-top:1px solid var(--line);margin:32px 0}}
nav{{font-size:14px;color:var(--muted);margin-bottom:24px}}nav a{{margin-right:14px}}
</style></head><body><main>
<nav><a href="index.html">Support</a><a href="privacy.html">Privacy policy</a></nav>
{body}
</main></body></html>'''
open('index.html','w').write(md2html(open('support.md').read(),'First Ultra — Support'))
open('privacy.html','w').write(md2html(open('privacy.md').read(),'First Ultra — Privacy Policy'))
