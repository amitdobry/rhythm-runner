import type { Weather } from '../config';

/**
 * Every colour and the one font, in one place, so a child can change how the
 * game looks without reading any drawing code.
 */

export const SKY_TOP: Record<Weather, string> = {
  clear: '#5aa9e6',
  rain: '#5b6470',
  wind: '#8fa3b8',
};

export const SKY_BOTTOM: Record<Weather, string> = {
  clear: '#cfe8ff',
  rain: '#9aa3ad',
  wind: '#d3ddE8',
};

export const SKYLINE = '#7c8aa0';

export const SKYLINE_WINDOW = '#9fb0c6';

export const PAVEMENT = '#b9bec7';

export const PAVEMENT_EDGE = '#9aa0aa';

export const LAMP_POST = '#5d6470';

export const LAMP_LIGHT = '#ffe9a8';

export const ROAD_FLAT = '#4a4f59';

export const ROAD_UPHILL = '#565b66';

export const ROAD_DOWNHILL = '#414650';

export const ROAD_WATER = '#2f7fb8';

export const WATER_RIPPLE = '#7fc4ea';

export const ROAD_EDGE = '#2b2f36';

export const LANE_DASH = '#e8e2cf';

export const EARTH = '#3a3026';

export const RAIN_STREAK = '#dbe7f2';

export const WIND_STREAK = '#ffffff';

export const RUNNER_STUMBLE = '#e8503a';

export const FOOTPRINT = '#cfd6e0';

export const FOOTPRINT_DUE = '#1d2230'; // the foot that is due, dark against the target

export const RING = '#ffffff';

export const FLASH_PERFECT = '#3ddc84';

export const FLASH_GOOD = '#ffd23f';

export const FLASH_BAD = '#e8503a';

export const HUD_PANEL = 'rgba(15, 18, 26, 0.62)';

export const HUD_TEXT = '#f2f4f8';

export const HUD_MUTED = '#aab4c4';

export const BAR_TRACK = 'rgba(255, 255, 255, 0.22)';

export const BAR_SPEED = '#4ea8ff';

export const BAR_ENERGY = '#3ddc84';

export const BAR_ENERGY_LOW = '#e8503a';

export const BANNER_TEXT = '#ffffff';

export const BANNER_SHADOW = 'rgba(15, 18, 26, 0.55)';

export const STREAK_COLOUR = 'rgba(255, 255, 255, 0.75)';

export const VIGNETTE_COLOUR = 'rgba(232, 80, 58, 0.5)';

export const FONT = 'Heebo, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// The runner as a person: skin, shorts, shoes and the shadow under them.
export const RUNNER_SKIN = '#f6d3b0';
export const RUNNER_SHORTS = '#2f3a52';
export const RUNNER_SHOE = '#1d2230';
export const RUNNER_FACE = '#1d2230';
export const RUNNER_SHADOW = 'rgba(15, 18, 26, 0.22)';
export const FOOT_READY = '#ffd23f'; // the shoe that must land next
export const SWEAT = '#9fd8ff';
