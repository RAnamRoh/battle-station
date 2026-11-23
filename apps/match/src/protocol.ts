/** Messages between the game and a match room. Shared by the client and the Worker. */

export interface PlayerInfo { slot: number; name: string; fighter: number; ready: boolean }

export type ClientMsg =
  | { t: 'hello'; name: string; hash: string; simple: boolean }
  | { t: 'pick'; fighter: number }
  | { t: 'ready'; ready: boolean }
  /** Connection-setup data for the other player (WebRTC offer, answer or candidate). */
  | { t: 'signal'; data: unknown };

export type ServerMsg =
  | { t: 'joined'; slot: number; code: string }
  | { t: 'room'; players: PlayerInfo[] }
  | { t: 'start'; seed: number; fighters: [number, number]; simple: [boolean, boolean] }
  | { t: 'signal'; data: unknown }
  | { t: 'error'; reason: 'full' | 'version' | 'bad' };

export const ROOM_CODE = /^[A-HJ-NP-Z2-9]{5}$/;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_NAME = 16;
