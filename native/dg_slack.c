
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <zlib.h>
#include "doomkeys.h"
#include "m_argv.h"
#include "doomgeneric.h"


#define SLACK_MS_PER_TICK 29

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
