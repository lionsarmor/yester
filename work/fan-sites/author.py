"""Drive the desktop editor's New, Add Page, Place, Properties, Save and Export actions."""
from pathlib import Path
from unittest.mock import patch
import sys, tkinter as tk, zipfile
ROOT = Path.cwd()
sys.path.insert(0, str(ROOT/'work/desktop-app'))
from app import Studio, ASSETS
from project import read_project
here = ROOT/'work/fan-sites'
out = ROOT/'outputs/fan-sites'
repo = ROOT/'work/github-pages'
root = tk.Tk()
root.withdraw()
s = Studio(root)
def form(values):
    def submit(title, fields, defaults, accept):
        accept({key: values.get(key, defaults.get(key,'')) for key, *_ in fields})
    return patch.object(s,'_form',submit)
def setting(**values):
    with form(values): s.settings()
def put(kind,x,y,w,h,text='',path=None,**kwargs):
    with patch.object(root,'after_idle'),form({}):
        s.insert(kind,x,y,path)
    values=dict(x=x,y=y,w=w,h=h,**kwargs)
    if kind not in ('rule','box'): values['text']=text
    with form(values): s.properties()
def txt(x,y,w,h,word,size,**kw):
    put('text',x,y,w,h,word,font_family=kw.pop('font','Verdana'),font_size=size,color=kw.pop('color',ink),**kw)
def pic(x,y,w,h,path,alt,**kwargs): put('image',x,y,w,h,alt,path,**kwargs)
def rule(x,y,w,color):put('rule',x,y,w,2,color=color)
def menu(links,y):
    for j,(label,destination) in enumerate(links):
        put('link',22+205*j,y,195,28,label,href='page:'+destination,font_family='Courier New',font_size=16,bold=True,color=accent)
def add_pages(names):
    for name in names:
        with patch('app.simpledialog.askstring',return_value=name):s.add_page()
    return [pid for pid,_ in s.page_entries()]
def credit(y,line):
    txt(22,y,600,22,line,13,font='Courier New',color=soft)
def child_header(kicker,title):
    credit(12,kicker)
    txt(20,40,600,58,title,40,font=headfont,color=accent,bold=True)
    rule(22,105,590,accent)
def chapter(y,label,body):
    txt(22,y,600,28,label,20,font=headfont,color=accent,bold=True)
    txt(22,y+32,596,65,body,17)
def deliver(slug):
    s.switch_page('home')
    with patch('app.filedialog.asksaveasfilename',return_value=str(out/(slug+'.yst'))): assert s.save(ask=True)
    s.load(out/(slug+'.yst'))
    assert len(s.page_entries())==3
    with patch('app.filedialog.asksaveasfilename',return_value=str(out/(slug+'.zip'))): s.export()
    folder=repo/slug;folder.mkdir(exist_ok=True)
    with zipfile.ZipFile(out/(slug+'.zip')) as z:z.extractall(folder)
    (folder/(slug+'.yst')).write_bytes((out/(slug+'.yst')).read_bytes())
    print('Saved, reopened and exported',slug,flush=True)

s.new()
slug='moon-relay'
ink,accent,soft='#f8e9f5','#ffb7c6','#b6d7f6'
headfont='Georgia'
setting(title='Moon Relay Tape Shrine',slug=slug,byline='miki / spoolcat',profile='Early 2000s',background='#182344',height=500,listed=True)
home,tape,dial=add_pages(['The tape index','The missing caller'])
s.switch_page(home)
credit(14,'miki-chan’s tape shelf     *     shrine version 3.2     *     2002')
txt(18,38,614,65,'Moon Relay',53,font='Georgia',color=accent,italic=True,bold=True)
rule(20,111,598,'#cb90b4')
pic(20,131,380,225,here/'art/moonrelay.gif','Nori at the lunar switchboard, waiting for the last call.')
txt(419,132,204,49,'The midnight\nswitchboard',21,font='Georgia',color=accent,bold=True)
txt(419,190,198,145,"I taped over Dad’s weather report for this frame. Nori’s headset lights up one whole second before the phone rings. I checked twice.\n\n~ miki",15)
txt(22,365,605,28,'Tape 03  /  tracking a little wobbly  /  cap by spoolcat',14,font='Courier New',color=soft)
menu([('Tape index',tape),('Missing caller?',dial)],405)
credit(460,'June 8   Found the last six seconds! See the missing caller page.')
s.switch_page(tape);child_header('MOON RELAY     /     MIKI’S VHS CABINET','The tape index')
chapter(129,'01  /  Night bus to the moon','A passenger pays with a shirt button. Nori keeps it in the coin tray. Watch the tray when the bus returns empty.')
chapter(232,'02  /  Please hold','The hold music is Nori humming into a paper cup. The caller asks for an encore. My copy loses the sound just there.')
chapter(331,'03  /  One ring late','Stop at the glass reflection. There are two headsets on the hook and only one operator on shift.')
menu([('Shrine home',home),('Missing caller?',dial)],446)
s.switch_page(dial);child_header('SPOOLCAT’S REWIND NOTES     /     TAPE 03','The missing caller')
chapter(127,'00:18:41  /  Before the ring','The empty chair squeaks. Nori looks straight at the unplugged jack. I wore out the pause button trying to read her lips.')
chapter(234,'00:18:47  /  Left channel only','A tiny voice says “save me a seat.” My friend Yuu heard “save the receipt.” We have agreed to disagree.')
txt(22,344,586,60,'My theory: it’s the night-bus driver calling from yesterday. He still owes her a button.',19,font='Georgia',italic=True,color=accent)
menu([('Shrine home',home),('Tape index',tape)],446)
deliver(slug)

s.new()
slug='player-two'
ink,accent,soft='#252333','#9e2936','#4a4651'
headfont='Arial'
setting(title='Player Two Repair Club',slug=slug,byline='Jo + Kit',profile='1990s graphical',background='#fff1cf',height=500,listed=True)
home,log,meet=add_pages(['Link cable log','Friday score slips'])
s.switch_page(home)
txt(0,0,640,30,'  JO + KIT’S UNOFFICIAL NINTENDO CLUB     /     WINTER 1999',15,font='Courier New',fill='#982337',color='#fff3cd',bold=True)
txt(17,39,613,65,'PLAYER TWO',56,font='Arial',color='#302c3b',bold=True)
txt(21,108,596,29,'REPAIR CLUB   //   the Game Boy table by the radiator',18,font='Courier New',color=accent,bold=True)
pic(240,158,380,225,here/'art/cartshift.gif','Two Game Boy handhelds and a red link cable on our club table.')
txt(20,159,211,44,'Friday bench note',20,font='Georgia',bold=True,color=accent)
txt(20,200,200,162,'Everyone blamed my purple Game Boy. Then Kit switched seats and the bad button followed HIM. We wrote up the test so the next club can settle it in one recess.',16)
rule(20,397,600,accent)
menu([('Link cable log',log),('Score slips',meet)],412)
credit(466,'Pencil scores only. No erasing a loss just because the bell rang.')
s.switch_page(log);child_header('P2RC   /   BENCH BOOK   /   SHEET 04','Link cable log')
chapter(125,'TEST A   /   Keep your seats','Two Game Boys. Two copies of Tetris. One cable. We marked one plug with red tape so we could tell which end was which.')
chapter(227,'TEST B   /   Swap one thing','Jo took Kit’s seat but kept her handheld. The missed turns stayed with Kit’s machine. The cable was off the suspect list.')
chapter(330,'VERDICT   /   The lunch crumb','A cracker crumb was sitting on the left side of Kit’s D-pad. Brushed it away, played three clean rounds. Repairs charged: one cracker.')
menu([('Club home',home),('Score slips',meet)],446)
s.switch_page(meet);child_header('P2RC   /   SHOEBOX ARCHIVE   /   DECEMBER','Friday score slips')
txt(24,128,588,112,'TETRIS  /  LINK MATCHES\nDEC 03    JO   2 - 1   KIT\nDEC 10    KIT  2 - 0   JO\nDEC 17    JO   1 - 1   KIT   (bell!)',19,font='Courier New',fill='#333142',color='#fff2ca',bold=True)
chapter(270,'HOUSE RULE NO. 3','A game interrupted by the bell goes on the slip in pencil. We finish it next Friday. Neither player gets to “remember” a win.')
txt(22,372,598,50,'In the shoebox: red marker, spare batteries, one disputed score slip.',17,font='Georgia',italic=True)
menu([('Club home',home),('Link cable log',log)],446)
deliver(slug)
root.destroy()
