/* C64 terminal fixture. Poll the emulated 6551; control bytes are handled locally. */
#include <cbm.h>
#include <conio.h>
#include <stdint.h>
#define ACIA ((volatile uint8_t*)0xde00)

int main(void) {
    uint8_t ch;
    bordercolor(COLOR_BLACK);
    bgcolor(COLOR_BLACK);
    textcolor(COLOR_GREEN);
    clrscr();
    cbm_k_bsout(142);
    ACIA[1] = 0;
    ACIA[3] = 0x1c;
    ACIA[2] = 0x0b;
    while (!(ACIA[1] & 16)) {}
    ACIA[0] = 63; /* Tell the gateway this terminal is ready. */
    while (1) {
        if (ACIA[1] & 8) {
            ch = ACIA[0];
            if (ch == 12) cbm_k_bsout(147);
            else if (ch == 13 || (ch >= 32 && ch <= 95)) cbm_k_bsout(ch);
        }
        if (kbhit()) {
            ch = cgetc();
            if (ch >= 193 && ch <= 218) ch -= 128;
            while (!(ACIA[1] & 16)) {}
            ACIA[0] = ch;
        }
    }
    return 0;
}
