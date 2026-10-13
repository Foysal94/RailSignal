/**
 * TfL Client Module Seam
 * Sealed public entry point exposing the resilient TfL client and domain models.
 */

export { TflClient, type TflClientOptions, tflClient } from './client.js';
export { TflHttpError } from './resilience.js';
export type { ParsedDisruption } from './types.js';
