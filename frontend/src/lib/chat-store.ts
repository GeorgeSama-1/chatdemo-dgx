import type { ChatMessage, ChatSession, ChatSettings } from "./types";

const STORAGE_KEY = "chatdemo-dgx.sessions";

export const DEFAULT_SYSTEM_PROMPT =
  "你是一名专业、稳重、简洁的企业 AI 助手。优先给出清晰结论、关键依据和可执行建议。";

export const POWER_INSPECTION_SYSTEM_PROMPT =
  "你是一名专业、严谨、稳重的电力巡检图像分析助手，专注于识别绝缘子及其可见缺陷。你必须基于图像真实可见内容进行判断，优先输出清晰结论、关键依据和可执行建议；对于证据不足、图像质量差或无法确认的情况，应明确说明不确定性，避免臆测和误报。";

export type SystemPromptPreset = {
  id: string;
  label: string;
  prompt: string;
};

export const SYSTEM_PROMPT_PRESETS: SystemPromptPreset[] = [
  {
    id: "general-assistant",
    label: "通用企业助手",
    prompt: DEFAULT_SYSTEM_PROMPT,
  },
  {
    id: "power-inspection",
    label: "电力巡检图像分析助手",
    prompt: POWER_INSPECTION_SYSTEM_PROMPT,
  },
];

const GENERAL_SUGGESTIONS = [
  "总结今天的项目进展并生成周报草稿",
  "帮我梳理这份方案的风险和推进建议",
  "把这段技术说明改写成适合管理层阅读的版本",
  "根据会议纪要整理后续行动项",
];

const POWER_INSPECTION_SUGGESTIONS = [
  "分析这张绝缘子图片，判断是否存在可见缺陷",
  "根据巡检图片生成结论、依据和处置建议",
  "对比这两张设备图片，说明异常差异",
  "把这段巡检记录整理成简明汇报",
];

export function getMatchingSystemPromptPreset(systemPrompt: string): string {
  const matchedPreset = SYSTEM_PROMPT_PRESETS.find(
    (preset) => preset.prompt === systemPrompt
  );

  return matchedPreset?.id ?? "custom";
}

export function createSession(): ChatSession {
  const now = Date.now();

  return {
    id: `session-${now}-${Math.random().toString(16).slice(2, 8)}`,
    title: "新建会话",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function getDefaultSettings(): ChatSettings {
  return {
    temperature: 0.3,
    max_tokens: 1024,
    system_prompt: DEFAULT_SYSTEM_PROMPT,
  };
}

export function getSuggestionsForSystemPrompt(systemPrompt: string): string[] {
  const presetId = getMatchingSystemPromptPreset(systemPrompt);

  if (presetId === "power-inspection") {
    return POWER_INSPECTION_SUGGESTIONS;
  }

  return GENERAL_SUGGESTIONS;
}

export function getInitialSuggestions(): string[] {
  return getSuggestionsForSystemPrompt(DEFAULT_SYSTEM_PROMPT);
}

export function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const sessions = JSON.parse(raw) as ChatSession[];
    if (!Array.isArray(sessions)) {
      return [];
    }

    // Migrate legacy shared history into window-scoped storage so multiple
    // tabs can chat independently without overwriting each other's streams.
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return sessions;
  } catch {
    return [];
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function buildSessionTitle(content: string): string {
  const trimmed = content.replace(/\s+/g, " ").trim();

  if (!trimmed) {
    return "新建会话";
  }

  return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed;
}

export function toApiMessages(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role !== "system")
    .map(({ role, content, attachments }) => ({
      role,
      content: content.trim(),
      attachments: attachments?.map((attachment) => attachment.uploadId) ?? [],
    }))
    .filter(
      (message) => message.content.length > 0 || message.attachments.length > 0
    );
}
