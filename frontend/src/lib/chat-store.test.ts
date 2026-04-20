import {
  createSession,
  getInitialSuggestions,
  getSuggestionsForSystemPrompt,
  POWER_INSPECTION_SYSTEM_PROMPT,
  loadSessions,
  saveSessions,
  toApiMessages,
} from "./chat-store";

describe("chat-store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("creates a new empty session with assistant welcome metadata", () => {
    const session = createSession();

    expect(session.id).toBeTruthy();
    expect(session.title).toBe("新建会话");
    expect(session.messages).toEqual([]);
    expect(session.createdAt).toBeGreaterThan(0);
  });

  it("returns enterprise-ready default suggestions", () => {
    expect(getInitialSuggestions()).toEqual([
      "总结今天的项目进展并生成周报草稿",
      "帮我梳理这份方案的风险和推进建议",
      "把这段技术说明改写成适合管理层阅读的版本",
      "根据会议纪要整理后续行动项",
    ]);
  });

  it("returns power inspection suggestions for the inspection preset", () => {
    expect(getSuggestionsForSystemPrompt(POWER_INSPECTION_SYSTEM_PROMPT)).toEqual([
      "分析这张绝缘子图片，判断是否存在可见缺陷",
      "根据巡检图片生成结论、依据和处置建议",
      "对比这两张设备图片，说明异常差异",
      "把这段巡检记录整理成简明汇报",
    ]);
  });

  it("filters empty messages before sending API payload", () => {
    const messages = [
      {
        id: "1",
        role: "user" as const,
        content: "你好",
        createdAt: 1,
      },
      {
        id: "2",
        role: "assistant" as const,
        content: "",
        createdAt: 2,
      },
    ];

    expect(toApiMessages(messages)).toEqual([
      {
        role: "user",
        content: "你好",
        attachments: [],
      },
    ]);
  });

  it("stores sessions in sessionStorage so browser windows do not overwrite each other", () => {
    const sessions = [createSession()];

    saveSessions(sessions);

    expect(loadSessions()).toEqual(sessions);
    expect(window.sessionStorage.getItem("chatdemo-dgx.sessions")).toBeTruthy();
    expect(window.localStorage.getItem("chatdemo-dgx.sessions")).toBeNull();
  });
});
