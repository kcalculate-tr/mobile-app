export const MACRO_COLORS = {
  calories: { main: '#000000', track: '#E5E5E5' },
  carbs:    { main: '#F8C90E', track: '#FEF9E7' },
  protein:  { main: '#19A355', track: '#DCFCE7' },
  fat:      { main: '#C1282E', track: '#FEE2E2' },
  water:    { main: '#90E0EF', track: '#E0F7FA' },
};

export const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
