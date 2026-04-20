export type MessageRole = "system" | "user" | "assistant";

export type ChatAttachment = {
  id: string;
  uploadId: string;
  name: string;
  mimeType: string;
  size: number;
  previewUrl: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  attachments?: ChatAttachment[];
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

export type ChatSettings = {
  temperature: number;
  max_tokens: number;
  system_prompt: string;
};

export type HealthState = {
  status: "online" | "offline";
  model: string;
};

export type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "done" }
  | { type: "error"; error: string };
