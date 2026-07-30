"use strict";
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BitayaMastVisualSpec = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const VERSION = 2;
  const ASPECT_RATIO = "16:9";
  const CAMERA = Object.freeze({
    perspective: "first_person_seated",
    angle: "frontal",
    dealerAlignment: "center",
    playerBodyVisible: false,
  });
  const LAYOUT = Object.freeze({
    hudMaxWidthRatio: 0.24,
    dealerCentralWidthRatio: Object.freeze([0.32, 0.42]),
    playerHandHeightRatio: Object.freeze([0.30, 0.40]),
    timerPlacement: "bottom_left_on_table",
    handPlacement: "bottom_center_fan",
    dealerPlacement: "center_behind_table",
  });
  const PALETTE = Object.freeze({
    black: "#08090a",
    darkBrown: "#15120f",
    rustBrown: "#2a1b11",
    rust: "#6d3a1c",
    amber: "#d08a3c",
    health: "#a43b2d",
    shield: "#466b82",
    paper: "#c8b89a",
    dirtyNeutral: "#6f685a",
  });
  const CARD_PRESENTATION = Object.freeze({
    physicalObject: true,
    embeddedRulesText: false,
    desktopInteraction: "hover_tooltip",
    mobileInteraction: "tap_select_then_tap_play",
    hoverLiftPx: Object.freeze([8, 18]),
    transitionMs: Object.freeze([100, 180]),
  });
  const TOOLTIP_FIELDS = Object.freeze([
    "name",
    "cost",
    "type_or_rarity",
    "effect",
    "short_lore",
    "upgrade_state",
    "availability_warning",
  ]);
  const FORBIDDEN = Object.freeze([
    "top_down_camera",
    "isometric_camera",
    "small_off_center_dealer",
    "empty_scene_without_dealer",
    "full_rules_text_on_card_face",
    "generic_roguelike_card_frame",
    "clean_saas_ui",
    "bright_fantasy_palette",
    "cartoon_proportions",
    "mixed_uncontrolled_art_styles",
    "generated_interface_text_in_final_assets",
  ]);
  const ACCEPTANCE = Object.freeze([
    "dealer_is_primary_focal_point",
    "camera_reads_as_player_seated_at_table",
    "cards_read_as_complete_physical_objects",
    "hud_and_timer_read_as_part_of_world",
    "center_is_lit_and_edges_are_dark",
    "desktop_1920x1080_is_readable",
    "mobile_390x844_is_readable",
    "no_horizontal_scroll",
    "composition_matches_reference_not_only_palette",
  ]);
  return Object.freeze({
    VERSION,
    ASPECT_RATIO,
    CAMERA,
    LAYOUT,
    PALETTE,
    CARD_PRESENTATION,
    TOOLTIP_FIELDS,
    FORBIDDEN,
    ACCEPTANCE,
  });
});
