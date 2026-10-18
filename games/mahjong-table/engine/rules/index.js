// Variant registry. To add Riichi: create rules/riichi.js with the same interface as hk.js,
// register it here, and set DEFAULT_VARIANT to 'riichi'.
import { hk } from './hk.js';

export const VARIANTS = { hk };
export const PLANNED = [{ id: 'riichi', name: 'Riichi (planned, will become the default)' }];
export const DEFAULT_VARIANT = 'hk';
