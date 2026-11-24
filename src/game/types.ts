// Shapes of the Neon City game content. They mirror the Zod schemas in
// src/content.config.ts (gameDistricts, scamFiles) and src/game/layouts/*.json.

export interface PortalOption {
  label: string;
  safe: boolean;
  redFlag?: string;
}

export interface ChoosePortalRound {
  prompt: string;
  options: PortalOption[];
}

export interface TrustOrReportRound {
  prompt: string;
  item: { kind: 'link' | 'message' | 'popup' | 'qr'; text: string };
  safe: boolean;
  redFlag?: string;
  /** Shown gently if the player reports a safe item by mistake. */
  whySafe?: string;
}

export type GateData =
  | { id: string; type: 'choose-portal'; rounds: ChoosePortalRound[] }
  | { id: string; type: 'trust-or-report'; rounds: TrustOrReportRound[] };

export interface GrownUpChallenge {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

export interface LevelData {
  id: string;
  title: string;
  goal: string;
  habit: string;
  rule: string;
  /** Id of a layout file in src/game/layouts/. */
  layout: string;
  concept?: string;
  grownUpChallenge: GrownUpChallenge;
  gates: GateData[];
}

export interface BossMessage {
  text: string;
  fake: boolean;
  redFlag?: string;
}

export interface BossData {
  name: string;
  intro: string;
  waves: { messages: BossMessage[] }[];
}

export interface DistrictData {
  id: string;
  title: string;
  habit: string;
  order: number;
  levels: LevelData[];
  boss: BossData;
  scamFileRewards: string[];
}

export interface ScamFileData {
  id: string;
  title: string;
  example: string;
  howToSpot: string;
  whatToDo: string;
  district: string;
  order: number;
}

export interface GamePayload {
  districts: DistrictData[];
  scamFiles: ScamFileData[];
}

export interface LayoutData {
  id: string;
  width: number;
  height: number;
  start: { x: number; y: number };
  exit: { x: number; y: number };
  platforms: { x: number; y: number; w: number; h: number }[];
  gates: { x: number }[];
}
