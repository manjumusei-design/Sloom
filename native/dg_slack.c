//had to ask ai to help me here with the png decode in some areas wherever commented, all ai output was reviewed and tested by me
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <zlib.h>
#include "doomkeys.h"
#include "m_argv.h"
#include "doomgeneric.h"
#include "doomstat.h"




#define SLACK_MS_PER_TICK 29
#define TURN_LINE_MAX 1024
#define MAX_KEYS_PER_TURN 8
#define KEY_NAME_MAX 32
#define ANGLE_UNITS 4294967296ULL
#define PNG_COMPRESSION_LEVEL 6
#define PNG_BIT_DEPTH 8
#define PNG_COLOR_RGB 2

static uint32_t s_TickCounter = 0;


#define KEYQUEUE_SIE 64



static unsigned short s_KeyQueue[KEYQUEUE_SIZE];
static unsigned int s_KeyQueueWriteIndex = 0;
static unsigned int s_KeyQueueReadIndex = 0;

static void slack_push_key(int pressed )
{
    unsigned int next = (s_KeyQueueWriteIndex + 1) % KEYQUEUE_SIZE;
    if (next == s_KeyQueueReadIndex)
        return;
    s_KeyQueue[s_KeyQueueWriteIndex] = (unsigned short)((pressed ? 0x100 : 0) | key);
    s_KeyQueueWriteIndex = next;
}

typedef struct {
    const char *name;
    unsigned char code;
} slack keymap t;

static const slack_keymap_t s_Keymap[] = {
    { "forward",  KEY_UPARROW },
    { "back",     KEY_DOWNARROW },
    { "turnleft", KEY_LEFTARROW },
    { "turnright",KEY_RIGHTARROW },
    { "strafeleft",  KEY_STRAFE_L },
    { "straferight", KEY_STRAFE_R },
    { "fire",     KEY_FIRE },
    { "use",      KEY_USE },
    { "tab",      KEY_TAB },
    { "enter",    KEY_ENTER },
    { "escape",   KEY_ESCAPE },
    { "yes",      'y' },
    { "no",       'n' },
    { "space",    ' ' },
    { "1",        '1' },
    { "2",        '2' },
    { "3",        '3' },
    { NULL, 0 }
};

static int slack_lookup_key(const char *name, unsigned char * out)
{
    for (int i = 0; s_keymap[i].name != NULL; i++) {
        if (strcmp(s_Keymap[i].name, name) == 0) {
            *out = s_Keymap[i].code;
            return 1;
        }
    }
    return 0;
}


static int s_FrameDrawn = 0;

void DG_Init(void)
{
}

void DG_DrawFrame(void)
{
    s_FrameDrawn = 1;
}

void DG_SleepMs(uint32_t ms)
{
    (void)ms;
}

uint32_t DG_GetTicksMs(void)
{
    return s_TickCounter++ * SLACK_MS_PER_TICK;
}

int DG_GetKey(int *pressed, unsigned char *doomKey)
{
    if (s_KeyQueueReadIndex == s_KeyQueueWriteIndex)
        return 0;

    unsigned short keyData = s_KeyQueue[s_KeyQueueReadIndex];
    s_KeyQueueReadIndex = (s_KeyQueueReadIndex + 1) % KEYQUEUE_SIZE;

    *pressed = keyData >> 8;
    *doomKey = (unsigned char)(keyData & 0xFF);
    return 1;
}

void DG_SetWindowTitle(const char *title)
{
    (void)title;
}


static uint32_t png_crc_table[256];
static int png_crc_ready = 0;

static void png_make_crc_table(void)
{
    for (uint32_t n = 0; n < 256; n++) {
        uint32_t c = n;
        for (int k = 0; k < 8; k++)
            c = (c & 1) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1); 
        png_crc_table[n] = c;
    }
    png_crc_ready = 1;
}

static uint32_t png_crc(const unsigned char *buf, size_t len)
{
    if (!png_crc_ready)
        png_make_crc_table();
    uint32_t c = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; i++)
        c = png_crc_table[(c ^ buf[i]) & 0xFF] ^ (c >> 8);
    return c ^ 0xFFFFFFFFu;
}

static void put_be32(unsigned char * p, uint32_t v)
{
    p[0] = (unsigned char)(v >> 24);
    p[1] = (unsigned char)(v >> 16);
    p[2] = (unsigned char)(v >> 8);
    p[3] = (unsigned char)v;
}

static int png_write_chunk(FILE *f, const char *type,
                           const unsigned char *data, size_t len)
{
    unsigned char hdr[8];
    put_be32(hdr, (uint32_t)len);
    memcpy(hdr + 4, type, 4);
    if (fwrite(hdr, 1, 8, f) != 8)
        return 0;
    if (len > 0 && fwrite(data, 1, len, f) != len)
        return 0;

    unsigned char *crcbuf = malloc(len + 4);
    if (!crcbuf)
        return 0;
    memcpy(crcbuf, type, 4);
    if (len > 0)
        memcpy(crcbuf + 4, data, len);
    uint32_t crc = png_crc(crcbuf, len + 4);
    free(crcbuf);

    unsigned char crcb[4];
    put_be32(crcb, crc);
    return fwrite(crcb, 1, 4, f) == 4;
}

static long png_write_frame(const char *path)
{
    const int w = DOOMGENERIC_RESX;
    const int h = DOOMGENERIC_RESY;

    size_t stride = (size_t)w*3;
    size_t rawlen = size_t)h * (stride + 1);
    unsigned char * raw = malloc(rawlen);
    if (!raw)
            return 0;

    const uint32_t *src = DG_ScreenBuffer;
    size_t o = 0;
    for (int y = 0; y < h; y++) {
        raw[o++] = 0;  
        const uint32_t *row = src + (size_t)y * w;
        for (int x = 0; x < w; x++) {
            uint32_t px = row[x];
            raw[o++] = (unsigned char)((px >> 16) & 0xFF);  
            raw[o++] = (unsigned char)((px >> 8) & 0xFF);   
            raw[o++] = (unsigned char)(px & 0xFF);          
        }
    }
//had to ask AI to help with compressing the raw image and the char sigs, opening the output file, and to compile a PNG to be sent back to the slackbot, everything was reviewed and tested by me 
    uLongf zlen = compressBound((uLong)rawlen);
    unsigned char *zbuf = malloc(zlen);
    if (!zbuf) {
        free(raw);
        return 0;
    }
    if (compress2(zbuf, &zlen, raw, (uLong)rawlen, 6) != Z_OK) {
        free(raw);
        free(zbuf);
        return 0;
    }
    free(raw);

    FILE *f = fopen(path, "wb");
    if (!f) {
        free(zbuf);
        return 0;
    }

    static const unsigned char sig[8] = { 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };
    int ok = fwrite(sig, 1, 8, f) == 8;

    unsigned char ihdr[13];
    put_be32(ihdr,(uint32_t)w);
    put_be32(ihdr + 4, (uint32_t)h);
    ihdr[8] = 8;   
    ihdr[9] = 2;   
    ihdr[10] = 0;  
    ihdr[11] = 0;  
    ihdr[12] = 0;  
    ok = ok && png_write_chunk(f, "IHDR", ihdr, sizeof(ihdr));
    ok = ok && png_write_chunk(f, "IDAT", zbuf, (size_t)zlen);
    ok = ok && png_write_chunk(f, "IEND", NULL, 0);

    long written = 0;
    if (ok) {
        written = ftell(f);
    }
    fclose(f);
    free(zbuf);
    return ok ? written : 0;
}
static int parse_turn(const char *line, char keys[][32], int maxkeys, int *out_tics)
{
    int nkeys = 0;
    *out_tics = 1;

    const char *k = strstr(line, "\"keys\"");
    if(k) {
        const char *p = strchr(k, '[');
        if(p) {
            p++;
            while (*p && *p != ']') {
                while (*p == ' ' || *p == ',') p++;
                if (*p != '"') break;
                p++;
                int len = 0;
                while (*p && *p != '"' && len < KEY_NAME_MAX - 1)
                    keys[nkeys][len++] = *p++;
                keys[nkeys][len] = '\0';
                if (*p == '"') p++;
                if (len > 0 && nkeys < maxkeys) nkeys++;
            }
        }
    }

    const char *t = strstr(line, "\"tics\"");
    if (t) {
        const char *p = strchr(t, ':');
        if (p) {
            int v = atoi(p+1);
            if (v>0) * out_tics = v;
        }
    }
    return nkeys;
}

#define MAX_TICS_PER_TURN 70

int main(int argc, char **argv)
{
    const char *framePath = getenv("Sloom_FRAME_PATH");
    if (framePath == NULL)
        framePath = "frame.png";

    doomgeneric_Create(argc, argv);

    if (s_FrameDrawn){
        long n = png_write_frame(framePath);
        if (n>0) {
            if (players[consoleplayer].mo != NULL) {
                unsigned int ang = players[consoleplayer].mo->angle;
                int deg = (int)((double)ang * 360.0 / (double)ANGLE_UNITS);
                printf("ANGLE %d\n", deg);
            }
        }
    }
    fflush(stdout);


    char line[TURN_LINE_MAX];
    while (fgets(line, sizeof(line), stdin) != NULL)
        char keys[MAX_KEYS_PER_TURN][KEY_NAME_MAX];
    int tics = 1;
        int nkeys = parse_turn(line, keys, MAX_KEYS_PER_TURN, &tics);
        if (tics > MAX_TICS_PER_TURN)
            tics = MAX_TICS_PER_TURN;

        unsigned char codes[MAX_KEYS_PER_TURN];
        int ncodes = 0;
        for (int i = 0; i < nkeys; i++) {
            unsigned char c;
            if (slack_lookup_key(keys[i], &c))
                codes[ncodes++] = c;
        }

        for (int i = 0; i < ncodes; i++)
            slack_push_key(1, codes[i]);

        for (int i = 0; i < tics; i++)
            doomgeneric_Tick();

        for (int i = 0; i < ncodes; i++)
            slack_push_key(0, codes[i]);

        doomgeneric_Tick();
        s_FrameDrawn =0;
        long n = png_write_frame(framePath);
        if (n>0) {
            printf("FRAME %s %ld\n", framePath, n);
            if (players[consoleplayer].mo != NULL) {
                unsigned int ang = players[consoleplayer].mo->angle;
                int deg = (int)((double)ang * 360.0 / (double)ANGLE_UNITS);
                printf("ANGLE %d\n", deg);
            }
        } else {
            printf("FRAME_ERROR %s\n", framePath);
        }
        fflush(stdout);
    }

    return 0;
}
