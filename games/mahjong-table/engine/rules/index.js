// Variant registry. To add a variant: create rules/<id>.js with the same interface as hk.js / riichi.js,
// register it here. DEFAULT_VARIANT is the one new players start with.
import { hk } from './hk.js';
import { riichi } from './riichi.js';

export const VARIANTS = { riichi, hk };
export const PLANNED = [];
export const DEFAULT_VARIANT = 'riichi';
