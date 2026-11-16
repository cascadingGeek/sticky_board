import { hashOf } from '@/utils/hash';

const PIN_COLORS = ['red', 'yellow', 'green', 'blue'] as const;
export type PinColor = (typeof PIN_COLORS)[number];

/** Stable pushpin colour from the note id, salted so it doesn't follow the tilt. */
export const pinFor = (id: string): PinColor => PIN_COLORS[hashOf(`${id}:pin`) % 4]!;
