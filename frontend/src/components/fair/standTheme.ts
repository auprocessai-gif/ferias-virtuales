import { Stand } from "@/../../shared";

export type StandTheme = {
  key: string;
  hex: string;
  rgb: string;
  dark: string;
  bg: string;
  shadow: string;
  border: string;
  text: string;
};

export const DEFAULT_STAND_THEME_COLOR = "#00f2ff";

export const standThemes: StandTheme[] = [
  {
    key: "orange",
    hex: "#ff5100",
    rgb: "255, 81, 0",
    dark: "#32170f",
    bg: "bg-[#ff5100]",
    shadow: "shadow-[0_0_15px_#ff5100]",
    border: "border-[#ff5100]/20",
    text: "text-[#ff5100]",
  },
  {
    key: "cyan",
    hex: "#00d5ff",
    rgb: "0, 213, 255",
    dark: "#0b2630",
    bg: "bg-[#00d5ff]",
    shadow: "shadow-[0_0_15px_#00d5ff]",
    border: "border-[#00d5ff]/20",
    text: "text-[#00d5ff]",
  },
  {
    key: "emerald",
    hex: "#10b981",
    rgb: "16, 185, 129",
    dark: "#0f2c24",
    bg: "bg-[#10b981]",
    shadow: "shadow-[0_0_15px_#10b981]",
    border: "border-[#10b981]/20",
    text: "text-[#10b981]",
  },
  {
    key: "rose",
    hex: "#f43f5e",
    rgb: "244, 63, 94",
    dark: "#35151c",
    bg: "bg-[#f43f5e]",
    shadow: "shadow-[0_0_15px_#f43f5e]",
    border: "border-[#f43f5e]/20",
    text: "text-[#f43f5e]",
  },
  {
    key: "amber",
    hex: "#f59e0b",
    rgb: "245, 158, 11",
    dark: "#332512",
    bg: "bg-[#f59e0b]",
    shadow: "shadow-[0_0_15px_#f59e0b]",
    border: "border-[#f59e0b]/20",
    text: "text-[#f59e0b]",
  },
  {
    key: "violet",
    hex: "#8b5cf6",
    rgb: "139, 92, 246",
    dark: "#251b36",
    bg: "bg-[#8b5cf6]",
    shadow: "shadow-[0_0_15px_#8b5cf6]",
    border: "border-[#8b5cf6]/20",
    text: "text-[#8b5cf6]",
  },
];

export const isHexColor = (value?: string | null): value is string =>
  Boolean(value && /^#[0-9a-f]{6}$/i.test(value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

const hashText = (text: string) =>
  text.split("").reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);

export const getPaletteStandTheme = (index = 0): StandTheme =>
  standThemes[index % standThemes.length];

export const getStandTheme = (stand: Stand, index = 0): StandTheme => {
  const savedThemeColor = stand.theme_color;

  if (isHexColor(savedThemeColor) && savedThemeColor.toLowerCase() !== DEFAULT_STAND_THEME_COLOR) {
    const hex = savedThemeColor;

    return {
      key: "custom",
      hex,
      rgb: hexToRgb(hex),
      dark: "#17201e",
      bg: "",
      shadow: "",
      border: "",
      text: "",
    };
  }

  return standThemes[(index + hashText(stand.id || stand.title || "")) % standThemes.length];
};
