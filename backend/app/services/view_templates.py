"""Self-contained HTML view templates for data files.

Each generator returns a complete HTML document with embedded data,
CSS and JS.  The output is rendered inside a sandboxed iframe
(`sandbox="allow-scripts"`).
"""

import json

_CSS_RESET = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
color:#1f2937;background:#fff;font-size:14px;line-height:1.5}
"""

_CSV_PARSER_JS = """
function parseCSV(text){
  var lines=text.trim().split('\\n');
  if(!lines.length)return{headers:[],rows:[]};
  function parseLine(l){
    var r=[],c='',q=false;
    for(var i=0;i<l.length;i++){
      var ch=l[i];
      if(q){if(ch==='"'&&l[i+1]==='"'){c+='"';i++}else if(ch==='"')q=false;else c+=ch}
      else if(ch==='"')q=true;
      else if(ch===','){r.push(c.trim());c=''}
      else c+=ch;
    }
    r.push(c.trim());return r;
  }
  return{headers:parseLine(lines[0]),rows:lines.slice(1).filter(function(l){return l.trim()}).map(parseLine)};
}
"""


def generate_table_html(csv_content: str, title: str) -> str:
    safe = json.dumps(csv_content)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} – Table</title>
<style>
{_CSS_RESET}
body{{padding:24px}}
h1{{font-size:16px;font-weight:700;margin-bottom:16px;color:#111827}}
.wrap{{border:1px solid #e5e7eb;border-radius:8px;overflow:auto}}
table{{width:100%;border-collapse:collapse}}
th{{text-align:left;padding:8px 12px;font-size:12px;font-weight:600;text-transform:uppercase;
letter-spacing:.05em;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;
position:sticky;top:0;white-space:nowrap;cursor:pointer;user-select:none}}
th:hover{{color:#4f46e5}}
td{{padding:8px 12px;border-bottom:1px solid #f3f4f6;white-space:nowrap;color:#374151}}
tr:hover td{{background:#f0f0ff}}
.count{{font-size:12px;color:#9ca3af;margin-bottom:12px}}
</style></head><body>
<h1>{title}</h1>
<div class="count" id="count"></div>
<div class="wrap"><table><thead id="hd"></thead><tbody id="bd"></tbody></table></div>
<script>
{_CSV_PARSER_JS}
var d=parseCSV({safe});
document.getElementById('count').textContent=d.rows.length+' rows';
var hd=document.getElementById('hd'),bd=document.getElementById('bd');
var tr=document.createElement('tr');
d.headers.forEach(function(h){{var th=document.createElement('th');th.textContent=h;tr.appendChild(th)}});
hd.appendChild(tr);
d.rows.forEach(function(r){{var tr=document.createElement('tr');
r.forEach(function(c){{var td=document.createElement('td');td.textContent=c;tr.appendChild(td)}});
bd.appendChild(tr)}});
</script></body></html>"""


def generate_board_html(csv_content: str, title: str) -> str:
    safe = json.dumps(csv_content)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} – Board</title>
<style>
{_CSS_RESET}
body{{padding:24px}}
h1{{font-size:16px;font-weight:700;margin-bottom:16px;color:#111827}}
.board{{display:flex;gap:16px;overflow-x:auto;padding-bottom:16px}}
.col{{flex-shrink:0;width:260px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px}}
.col-hd{{padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#f3f4f6;border-radius:8px 8px 0 0}}
.col-hd h3{{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}}
.col-hd span{{font-size:11px;color:#9ca3af;margin-left:6px;font-weight:400}}
.cards{{padding:8px;display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto}}
.card{{background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:10px 12px;box-shadow:0 1px 2px rgba(0,0,0,.04)}}
.card-title{{font-size:13px;font-weight:600;color:#111827}}
.card-meta{{font-size:11px;color:#6b7280;margin-top:4px}}
.card-meta b{{font-weight:600}}
</style></head><body>
<h1>{title}</h1>
<div class="board" id="board"></div>
<script>
{_CSV_PARSER_JS}
var d=parseCSV({safe});
var cands=['status','stage','state','column','category'];
var si=d.headers.findIndex(function(h){{return cands.indexOf(h.toLowerCase())>=0}});
if(si<0)si=d.headers.length>1?1:0;
var groups={{}};
d.rows.forEach(function(r){{var s=r[si]||'Uncategorized';if(!groups[s])groups[s]=[];groups[s].push(r)}});
var board=document.getElementById('board');
Object.keys(groups).forEach(function(status){{
  var col=document.createElement('div');col.className='col';
  var hd=document.createElement('div');hd.className='col-hd';
  hd.innerHTML='<h3>'+status+'<span>'+groups[status].length+'</span></h3>';
  col.appendChild(hd);
  var cards=document.createElement('div');cards.className='cards';
  groups[status].forEach(function(r){{
    var card=document.createElement('div');card.className='card';
    var html='<div class="card-title">'+r[0]+'</div>';
    d.headers.forEach(function(h,i){{if(i!==0&&i!==si&&r[i])html+='<div class="card-meta"><b>'+h+':</b> '+r[i]+'</div>'}});
    card.innerHTML=html;cards.appendChild(card);
  }});
  col.appendChild(cards);board.appendChild(col);
}});
</script></body></html>"""


def generate_calendar_html(csv_content: str, title: str) -> str:
    safe = json.dumps(csv_content)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} – Calendar</title>
<style>
{_CSS_RESET}
body{{padding:24px}}
h1{{font-size:16px;font-weight:700;margin-bottom:16px;color:#111827}}
.month{{margin-bottom:24px}}
.month h2{{font-size:14px;font-weight:700;color:#374151;margin-bottom:8px}}
.entry{{display:flex;gap:12px;padding:8px 12px;background:#fff;border:1px solid #f3f4f6;border-radius:8px;margin-bottom:4px}}
.entry:hover{{border-color:#c7d2fe}}
.date-box{{text-align:center;flex-shrink:0;width:42px}}
.date-box .day{{font-size:18px;font-weight:700;color:#4f46e5}}
.date-box .dow{{font-size:9px;text-transform:uppercase;color:#9ca3af}}
.entry-body{{min-width:0}}
.entry-title{{font-size:13px;font-weight:600;color:#111827}}
.entry-meta{{font-size:11px;color:#6b7280}}
.entry-meta b{{font-weight:600}}
.no-date{{text-align:center;padding:32px;color:#9ca3af}}
</style></head><body>
<h1>{title}</h1>
<div id="cal"></div>
<script>
{_CSV_PARSER_JS}
var d=parseCSV({safe});
var cands=['date','due','due_date','start','start_date','created','deadline'];
var di=d.headers.findIndex(function(h){{return cands.indexOf(h.toLowerCase().replace(/\\s+/g,'_'))>=0}});
var cal=document.getElementById('cal');
if(di<0){{cal.innerHTML='<div class="no-date">No date column found. Add a column named "date", "due", or "deadline".</div>'}}
else{{
  var months={{}};
  d.rows.forEach(function(r){{
    var dt=new Date(r[di]);if(isNaN(dt.getTime()))return;
    var k=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');
    if(!months[k])months[k]=[];months[k].push({{date:dt,row:r}});
  }});
  Object.keys(months).sort().forEach(function(k){{
    months[k].sort(function(a,b){{return a.date-b.date}});
    var parts=k.split('-');
    var label=new Date(+parts[0],+parts[1]-1).toLocaleDateString('en',{{month:'long',year:'numeric'}});
    var sec=document.createElement('div');sec.className='month';
    sec.innerHTML='<h2>'+label+'</h2>';
    months[k].forEach(function(e){{
      var div=document.createElement('div');div.className='entry';
      var html='<div class="date-box"><div class="day">'+e.date.getDate()+'</div>';
      html+='<div class="dow">'+e.date.toLocaleDateString('en',{{weekday:'short'}})+'</div></div>';
      html+='<div class="entry-body"><div class="entry-title">'+e.row[0]+'</div>';
      d.headers.forEach(function(h,i){{if(i!==0&&i!==di&&e.row[i])html+='<div class="entry-meta"><b>'+h+':</b> '+e.row[i]+'</div>'}});
      html+='</div>';div.innerHTML=html;sec.appendChild(div);
    }});
    cal.appendChild(sec);
  }});
}}
</script></body></html>"""


def generate_document_html(md_content: str, title: str) -> str:
    safe = json.dumps(md_content)
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} – Document</title>
<style>
{_CSS_RESET}
body{{padding:32px;max-width:720px;margin:0 auto}}
h1{{font-size:24px;font-weight:700;margin:24px 0 12px;color:#111827}}
h2{{font-size:20px;font-weight:700;margin:20px 0 10px;color:#111827}}
h3{{font-size:16px;font-weight:600;margin:16px 0 8px;color:#111827}}
p{{margin-bottom:12px;color:#374151}}
strong{{font-weight:700}}
em{{font-style:italic}}
code{{background:#f3f4f6;padding:2px 5px;border-radius:4px;font-size:13px;font-family:ui-monospace,monospace;color:#db2777}}
pre{{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;overflow-x:auto;
font-size:13px;font-family:ui-monospace,monospace;color:#1f2937;margin:12px 0}}
a{{color:#4f46e5;text-decoration:none}}a:hover{{text-decoration:underline}}
ul,ol{{margin:0 0 12px 24px;color:#374151}}
li{{margin-bottom:4px}}
hr{{border:none;border-top:1px solid #e5e7eb;margin:16px 0}}
blockquote{{border-left:3px solid #c7d2fe;padding-left:16px;margin:12px 0;color:#6b7280}}
</style></head><body>
<div id="doc"></div>
<script>
var md={safe};
// Minimal markdown renderer
var html=md;
html=html.replace(/^### (.+)$/gm,'<h3>$1</h3>');
html=html.replace(/^## (.+)$/gm,'<h2>$1</h2>');
html=html.replace(/^# (.+)$/gm,'<h1>$1</h1>');
html=html.replace(/\\*\\*(.+?)\\*\\*/g,'<strong>$1</strong>');
html=html.replace(/\\*(.+?)\\*/g,'<em>$1</em>');
html=html.replace(/`([^`]+)`/g,'<code>$1</code>');
html=html.replace(/```[\\s\\S]*?\\n([\\s\\S]*?)```/g,'<pre>$1</pre>');
html=html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g,'<a href="$2" target="_blank">$1</a>');
html=html.replace(/^> (.+)$/gm,'<blockquote>$1</blockquote>');
html=html.replace(/^[*-] (.+)$/gm,'<li>$1</li>');
html=html.replace(/^---$/gm,'<hr>');
html=html.replace(/\\n\\n/g,'</p><p>');
html=html.replace(/\\n/g,'<br>');
document.getElementById('doc').innerHTML='<p>'+html+'</p>';
</script></body></html>"""
