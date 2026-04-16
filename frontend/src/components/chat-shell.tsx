"use client";

import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildSessionTitle,
  createSession,
  getDefaultSettings,
  getInitialSuggestions,
  loadSessions,
  saveSessions,
  toApiMessages,
} from "../lib/chat-store";
import { splitNdjsonBuffer } from "../lib/streaming";
import type {
  ChatMessage,
  ChatSession,
  ChatSettings,
  HealthState,
  StreamEvent,
} from "../lib/types";
import { MessageBubble } from "./message-bubble";
import { SettingsPanel } from "./settings-panel";


const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME ?? "BW Labs";
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? "博微 智能助手";
const BRAND_ACCENT = process.env.NEXT_PUBLIC_BRAND_ACCENT ?? "#0f4c81";
const FALLBACK_MODEL = process.env.NEXT_PUBLIC_MODEL_LABEL ?? "gpt-oss-chat";

function createMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now(),
  };
}

function upsertSession(
  sessions: ChatSession[],
  sessionId: string,
  updater: (session: ChatSession) => ChatSession
): ChatSession[] {
  return sessions.map((session) =>
    session.id === sessionId ? updater(session) : session
  );
}

export function ChatShell() {
  const suggestions = useMemo(() => getInitialSuggestions(), []);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [draft, setDraft] = useState("");
  const [settings, setSettings] = useState<ChatSettings>(getDefaultSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({
    status: "online",
    model: FALLBACK_MODEL,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const storedSessions = loadSessions();
    if (storedSessions.length > 0) {
      setSessions(storedSessions);
      setActiveSessionId(storedSessions[0].id);
      return;
    }

    const firstSession = createSession();
    setSessions([firstSession]);
    setActiveSessionId(firstSession.id);
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Backend health check failed.");
        }

        const payload = (await response.json()) as {
          model?: string;
        };
        if (!cancelled) {
          setHealth({
            status: "online",
            model: payload.model || FALLBACK_MODEL,
          });
        }
      } catch {
        if (!cancelled) {
          setHealth({ status: "offline", model: FALLBACK_MODEL });
        }
      }
    }

    void checkHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  function handleNewSession() {
    const nextSession = createSession();
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setDraft("");
    setError(null);
  }

  function handleClearSession() {
    if (!activeSession) {
      return;
    }

    setSessions((current) =>
      upsertSession(current, activeSession.id, (session) => ({
        ...session,
        title: "新建会话",
        updatedAt: Date.now(),
        messages: [],
      }))
    );
    setError(null);
  }

  function updateStreamMessage(sessionId: string, messageId: string, delta: string) {
    setSessions((current) =>
      upsertSession(current, sessionId, (session) => ({
        ...session,
        updatedAt: Date.now(),
        messages: session.messages.map((message) =>
          message.id === messageId
            ? { ...message, content: `${message.content}${delta}` }
            : message
        ),
      }))
    );
  }

  function applyStreamEvent(
    sessionId: string,
    assistantMessageId: string,
    event: StreamEvent
  ) {
    if (event.type === "delta") {
      updateStreamMessage(sessionId, assistantMessageId, event.delta);
      return;
    }

    if (event.type === "error") {
      setError(event.error);
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) {
      return;
    }

    const session = activeSession ?? createSession();
    const sessionExists = sessions.some((item) => item.id === session.id);
    const userMessage = createMessage("user", content.trim());
    const assistantMessage = createMessage("assistant", "");
    const nextSession: ChatSession = {
      ...session,
      title:
        session.title === "新建会话"
          ? buildSessionTitle(content)
          : session.title,
      updatedAt: Date.now(),
      messages: [...session.messages, userMessage, assistantMessage],
    };

    setError(null);
    setDraft("");
    setIsStreaming(true);

    if (sessionExists) {
      setSessions((current) =>
        upsertSession(current, session.id, () => nextSession).sort(
          (left, right) => right.updatedAt - left.updatedAt
        )
      );
    } else {
      setSessions((current) =>
        [nextSession, ...current].sort((left, right) => right.updatedAt - left.updatedAt)
      );
      setActiveSessionId(session.id);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: toApiMessages(nextSession.messages),
          temperature: settings.temperature,
          max_tokens: settings.max_tokens,
          system_prompt: settings.system_prompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { detail?: string }
          | null;
        throw new Error(payload?.detail || "聊天请求失败，请稍后再试。");
      }

      if (!response.body) {
        throw new Error("服务未返回可读取的流式响应。");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parsed = splitNdjsonBuffer(buffer);
        buffer = parsed.remainder;
        parsed.events.forEach((event) =>
          applyStreamEvent(nextSession.id, assistantMessage.id, event)
        );
      }

      if (buffer.trim()) {
        splitNdjsonBuffer(`${buffer}\n`).events.forEach((event) =>
          applyStreamEvent(nextSession.id, assistantMessage.id, event)
        );
      }
    } catch (caughtError) {
      if ((caughtError as Error).name === "AbortError") {
        setError("已停止生成。");
      } else {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "聊天请求失败，请稍后再试。"
        );
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function formatSessionTime(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="chat-shell" style={{ ["--brand-accent" as string]: BRAND_ACCENT }}>
      <header className="topbar">
        <div className="brand-block">
          <div className="logo-mark" aria-hidden="true">
            {BRAND_NAME.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="brand-name">{BRAND_NAME}</div>
            <h1>{PRODUCT_NAME}</h1>
          </div>
        </div>
        <div className="status-strip">
          <div className="status-card">
            <span className="status-label">当前模型</span>
            <strong>{health.model}</strong>
          </div>
          <div className="status-card">
            <span className="status-label">服务状态</span>
            <strong
              className={health.status === "online" ? "status-online" : "status-offline"}
            >
              {health.status === "online" ? "服务在线" : "服务离线"}
            </strong>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>会话历史</h2>
            <button type="button" className="primary-button" onClick={handleNewSession}>
              新建会话
            </button>
          </div>
          <div className="session-list">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`session-item ${
                  session.id === activeSession?.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveSessionId(session.id);
                  setError(null);
                }}
              >
                <strong>{session.title}</strong>
                <span>{formatSessionTime(session.updatedAt)}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="chat-main">
          <section className="chat-surface">
            <div className="surface-header">
              <div>
                <p className="eyebrow">企业内部 AI 助手</p>
                <h2>{PRODUCT_NAME}</h2>
                <p className="surface-copy">
                  欢迎使用企业化对话 demo。你可以直接提问，或从推荐问题开始体验。
                </p>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setIsSettingsOpen((current) => !current)}
              >
                {isSettingsOpen ? "隐藏参数" : "显示参数"}
              </button>
            </div>

            {error ? <div className="error-banner">{error}</div> : null}

            {activeSession?.messages.length ? (
              <div className="message-list">
                {activeSession.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
            ) : (
              <div className="welcome-panel">
                <div className="welcome-card">
                  <p className="eyebrow">欢迎语</p>
                  <h3>我可以帮助你处理企业知识问答、文档整理和方案分析。</h3>
                  <p>
                    这个版本已经预留品牌化区域、模型状态、参数面板和流式输出能力，
                    适合用作公司内部 AI 产品 demo。
                  </p>
                </div>

                <div className="suggestions">
                  <div className="suggestions-head">推荐问题</div>
                  <div className="suggestion-grid">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="suggestion-card"
                        onClick={() => void sendMessage(suggestion)}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="composer">
              <textarea
                rows={4}
                value={draft}
                placeholder="输入你的问题，支持多轮对话与代码问答..."
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(draft);
                  }
                }}
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void sendMessage(draft)}
                  disabled={isStreaming}
                >
                  发送
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleStop}
                  disabled={!isStreaming}
                >
                  停止生成
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleClearSession}
                  disabled={isStreaming || !activeSession}
                >
                  清空当前会话
                </button>
              </div>
            </div>
          </section>

          <SettingsPanel
            isOpen={isSettingsOpen}
            settings={settings}
            onToggle={() => setIsSettingsOpen((current) => !current)}
            onChange={setSettings}
          />
        </main>
      </div>
    </div>
  );
}
