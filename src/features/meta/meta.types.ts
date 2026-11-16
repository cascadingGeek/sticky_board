/** App bookkeeping kept in chrome.storage.local: schema version and one time prompts. */

export interface Meta {
  schemaVersion: number;
  onboardedAt?: string;
  lastCarryOverPromptDate?: string;
  themeDefaultCheckedAt?: string; // when the one time theme check ran
}

export const SCHEMA_VERSION = 1;
