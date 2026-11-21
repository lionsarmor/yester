/* 40-column live BBS client for the Lionsarmor 65C02 Wi-Fi UART. */
#include <cbm.h>
#include <conio.h>
#include <string.h>
#include <time.h>
#include "ascii.h"
#include "site.h"

#define UART ((volatile unsigned char*)0x9fe0)
#define HOME MEMBER "/bbs/?page=home&columns=40"
#define MAXROWS 90
static char html[8200], url[220], links[9][220], rows[MAXROWS][41];
static unsigned char nrows, first, col;

static void send_byte(unsigned char c) {
    while (!(UART[5]&32)) {}
    UART[0]=c;
}
static void transmit(const char *s) {
    while (*s) send_byte(*s++);
}
static void put(const char *s) {
    unsigned char ch;
    while ((ch=*s++)!=0) cbm_k_bsout(ch>='a' && ch<='z' ? ch-32 : ch);
    cbm_k_bsout(13);
}
static unsigned char download(void) {
    unsigned size=0;
    char c;
    clock_t began=clock();
    clrscr();put("YESTERSITES / X16 WIFI");put("FETCHING PUBLIC BBS...");
    transmit("AT&G\""); transmit(url); transmit("\"\r");
    while ((clock_t)(clock()-began)<30*CLOCKS_PER_SEC) {
        if (!(UART[5]&1)) continue;
        c=UART[0];
        if (size+1>=sizeof(html)) break;
        html[size++]=c;
        html[size]=0;
        if ((size>=7 && !memcmp(html+size-7,"</html>",7)) ||
            (size>=12 && !memcmp(html+size-12,"NO CARRIER\r\n",12))) break;
    }
    return strstr(html,"</pre>")!=0;
}
static char entity(char **source) {
    char *p=*source;
    unsigned char i;
    static const char *const entities[]={"&amp;", "&lt;", "&gt;", "&quot;", "&#39;", "&#x27;"};
    static const char chars[]="&<>\"''";
    for (i=0;i<6;i++) {
        if (!strncmp(p,entities[i],strlen(entities[i]))) {
            *source+=strlen(entities[i]);return chars[i];
        }
    }
    (*source)++;
    return *p;
}
static void parse(void) {
    char *p,*end,*target,*quote,*label;
    unsigned char key;
    unsigned n;
    char ch;
    memset(rows,0,sizeof(rows));memset(links,0,sizeof(links));nrows=1;col=first=0;
    p=strstr(html,"<pre>");
    if (!p) return;
    p+=5;
    end=strstr(p,"</pre>");
    while(p<end && nrows<MAXROWS) {
        if (*p=='<') {p=strchr(p,'>');if (!p) break;++p;continue;}
        ch=entity(&p);
        if (ch==13) continue;
        if (ch==10) {if (nrows+1>=MAXROWS) break;++nrows;col=0;continue;}
        if (col>=40) {if (nrows+1>=MAXROWS) break;++nrows;col=0;}
        rows[nrows-1][col++]=(unsigned char)ch<128?ch:'?';
    }
    p=end;
    while ((p=strstr(p,"<li>"))!=0) {
        target=strstr(p,"href=\"");if(!target) break;
        target+=6;quote=strchr(target,'"');if(!quote) break;
        label=strchr(quote,'>');if(!label) break;++label;
        key=*label;
        if(key>='1' && key<='9' && !strncmp(target,MEMBER "/bbs/",strlen(MEMBER "/bbs/"))) {
            n=0;
            while(target<quote && n<sizeof(url)-1) links[key-'1'][n++]=entity(&target);
            if(target<quote) links[key-'1'][0]=0;
        }
        p=label;
    }
}
static void draw(void) {
    unsigned char row;
    clrscr();textcolor(COLOR_CYAN);put("YESTERSITES  /  X16 WIFI");
    textcolor(COLOR_WHITE);
    for (row=first;row<nrows && row<first+23;row++) {gotoxy(0,1+row-first);put(rows[row]);}
    gotoxy(0,28);textcolor(COLOR_YELLOW);put("1-9 LINK  0/H HOME  N/P SCROLL");
}
int main(void) {
    unsigned char key;
    __asm__("lda #3");__asm__("clc");__asm__("jsr $ff5f");
    bgcolor(COLOR_BLUE);cbm_k_bsout(142);
    UART[1]=0;UART[3]=128;UART[0]=8;UART[1]=0;UART[3]=3;UART[2]=7;UART[4]=3;
    strcpy(url,HOME);
    for (;;) {
        if(download()){parse();draw();}
        else {memset(links,0,sizeof(links));put("FETCH FAILED. H RETRIES HOME.");}
        for (;;) {
            key=cgetc()&127;
            if (key>='a' && key<='z') key-=32;
            if(key=='H'||key=='0'){strcpy(url,HOME);break;}
            if(key>='1' && key<='9' && links[key-'1'][0]){strcpy(url,links[key-'1']);break;}
            if(key=='N' && first+23<nrows){first+=23;draw();}
            if(key=='P' && first>=23){first-=23;draw();}
        }
    }
    return 0;
}
