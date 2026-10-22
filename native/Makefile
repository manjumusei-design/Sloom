//I have no idea how to make Makefiles so I had to ask AI to help me with this
CC ?= cc
DG_DIR ?= $(HOME)/doomgeneric/doomgeneric

CFLAGS += -O2 -Wall -Wno-unused-but-set-variable
CFLAGS += -DNORMALUNIX -DLINUX -D_DEFAULT_SOURCE
CFLAGS += -I$(DG_DIR)

LDLIBS += -lm -lz

OBJDIR := build
OUTPUT := sloom

ENGINE_SRC := \
	dummy am_map doomdef doomstat dstrings d_event d_items d_iwad d_loop \
	d_main d_mode d_net f_finale f_wipe g_game hu_lib hu_stuff info \
	i_cdmus i_endoom i_joystick i_scale i_sound i_system i_timer memio \
	m_argv m_bbox m_cheat m_config m_controls m_fixed m_menu m_misc \
	m_random p_ceilng p_doors p_enemy p_floor p_inter p_lights p_map \
	p_maputl p_mobj p_plats p_pspr p_saveg p_setup p_sight p_spec \
	p_switch p_telept p_tick p_user r_bsp r_data r_draw r_main r_plane \
	r_segs r_sky r_things sha1 sounds statdump st_lib st_stuff s_sound \
	tables v_video wi_stuff w_checksum w_file w_main w_wad z_zone \
	w_file_stdc i_input i_video doomgeneric mus2mid

OBJS := $(addprefix $(OBJDIR)/,$(ENGINE_SRC:=.o)) $(OBJDIR)/dg_slack.o

all: $(OUTPUT)

$(OBJDIR):
	mkdir -p $(OBJDIR)

$(OBJDIR)/%.o: $(DG_DIR)/%.c | $(OBJDIR)
	@echo "[cc] $<"
	@$(CC) $(CFLAGS) -c $< -o $@

$(OBJDIR)/dg_slack.o: dg_slack.c | $(OBJDIR)
	@echo "[cc] native/$<"
	@$(CC) $(CFLAGS) -c $< -o $@

$(OUTPUT): $(OBJS)
	@echo "[ld] $@"
	@$(CC) $(CFLAGS) $(OBJS) -o $@ $(LDLIBS)

clean:
	rm -rf $(OBJDIR) $(OUTPUT)

.PHONY: all clean
