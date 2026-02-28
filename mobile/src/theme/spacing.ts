export const spacing = {
  screenHorizontal: 16,
  cardRadius: 10,
  cellVertical: 11,
  cellHorizontal: 16,
  separatorInset: 16,
  sectionHeaderTop: 28,
  sectionHeaderBottom: 8,
  buttonHeight: 50,
} as const;

export type Spacing = typeof spacing;
