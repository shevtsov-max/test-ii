/**
 * Цвета схемы древа. Карточки рисуются с явными цветами (а не CSS-классами),
 * поэтому экспортированный SVG/PNG выглядит так же, как на экране.
 */
const LIGHT = {
  canvas: '#F1EEE8',
  dot: '#DCD7CD',
  surface: '#FFFFFF',
  surface2: '#F9F8F5',
  border: '#E3DED5',
  text: '#1D2330',
  text2: '#404857',
  muted: '#6B7280',
  line: '#A8A194',
  lineStrong: '#D24E26',
  primary: '#D24E26',
  primary2: '#F08556',
  primaryDark: '#B53B17',
  male: '#2F74C0',
  maleSoft: '#E5EEF9',
  female: '#CC4A78',
  femaleSoft: '#FAE7EE',
  unknown: '#7C8594',
  unknownSoft: '#EDEFF2',
  living: '#2E9D62',
  deceased: '#7C8594',
  shadow: 'rgba(40, 30, 20, 0.07)',
  star: '#E0A526',
  band: 'rgba(120, 100, 70, 0.045)',
}

const DARK = {
  canvas: '#11151A',
  dot: '#232A33',
  surface: '#1A1F26',
  surface2: '#20262E',
  border: '#2E3642',
  text: '#E8EBF0',
  text2: '#C5CBD5',
  muted: '#98A2B3',
  line: '#5B6576',
  lineStrong: '#F0693E',
  primary: '#E85C30',
  primary2: '#F58A5E',
  primaryDark: '#C24520',
  male: '#5C9DE6',
  maleSoft: '#1B2E45',
  female: '#E5709A',
  femaleSoft: '#3D2130',
  unknown: '#8E97A5',
  unknownSoft: '#272D36',
  living: '#4CC585',
  deceased: '#8E97A5',
  shadow: 'rgba(0, 0, 0, 0.35)',
  star: '#E8B53A',
  band: 'rgba(255, 255, 255, 0.025)',
}

export const chartPalette = (dark) => (dark ? DARK : LIGHT)

/** Цвета поколений: тёплые — предки, холодные — потомки. */
const GEN_COLORS = ['#9A3412', '#B45309', '#A16207', '#4D7C0F', '#15803D', '#0F766E', '#0E7490', '#1D4ED8', '#6D28D9']
export const generationColor = (row) => GEN_COLORS[Math.max(0, Math.min(GEN_COLORS.length - 1, row + 4))]

export function genderColors(P, g) {
  return g === 'M' ? [P.male, P.maleSoft] : g === 'F' ? [P.female, P.femaleSoft] : [P.unknown, P.unknownSoft]
}
