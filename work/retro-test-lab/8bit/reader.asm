; Spectrum ULA text reader for the site pages appended by build-readers.py.
; Screen cells are drawn using the 48K-compatible character ROM mapped by these emulator profiles.
org 32768
start:
 di
 ld sp,65500
 xor a
 out (254),a
 ld (current),a
redraw:
 ld hl,16384
 ld de,16385
 ld bc,6143
 ld (hl),0
 ldir
 ld hl,22528
 ld de,22529
 ld bc,767
 ld (hl),68
 ldir
 ld a,(current)
 add a,a
 ld e,a
 ld d,0
 ld hl,pages
 add hl,de
 ld e,(hl)
 inc hl
 ld d,(hl)
 ex de,hl
 ld (source),hl
 ld de,16384
 ld b,24
row:
 push bc
 ld b,32
column:
 push bc
 ld hl,(source)
 ld a,(hl)
 inc hl
 ld (source),hl
 sub 32
 ld l,a
 ld h,0
 add hl,hl
 add hl,hl
 add hl,hl
 ld bc,15616
 add hl,bc
 push de
 ld b,8
glyph:
 ld a,(hl)
 ld (de),a
 inc hl
 inc d
 djnz glyph
 pop de
 inc de
 pop bc
 djnz column
 ld a,e
 or a
 jr nz,cont
 ld a,d
 add a,7
 ld d,a
cont:
 pop bc
 djnz row
release:
 xor a
 in a,(254)
 and 31
 cp 31
 jr nz,release
key:
 ld bc,63486 ; keyboard 1..5
 in a,(c)
 ld e,0
 bit 0,a
 jr z,go
 inc e
 bit 1,a
 jr z,go
 inc e
 bit 2,a
 jr z,go
 inc e
 bit 3,a
 jr z,go
 inc e
 bit 4,a
 jr z,go
 ld bc,61438 ; keyboard 0,9,8,7,6
 in a,(c)
 inc e
 bit 4,a
 jr z,go
 inc e
 bit 3,a
 jr z,go
 inc e
 bit 2,a
 jr z,go
 inc e
 bit 1,a
 jr z,go
 ld bc,49150 ; H
 in a,(c)
 bit 4,a
 jr nz,more
 xor a
 jr set
more:
 ld bc,32766 ; N
 in a,(c)
 inc e
 bit 3,a
 jr z,go
 ld bc,57342 ; P
 in a,(c)
 inc e
 bit 0,a
 jr nz,key
go:
 ld d,0
 ld a,(current)
 ld l,a
 ld h,0
 add hl,hl ; row of 11 one-byte targets
 add hl,hl
 add hl,hl ; x8
 ld c,a
 ld b,0
 add hl,bc
 add hl,bc
 add hl,bc
 add hl,de
 ld de,targets
 add hl,de
 ld a,(hl)
set:
 ld (current),a
 jp redraw
current: db 0
source: dw 0
