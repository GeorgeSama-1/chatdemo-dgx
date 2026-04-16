import {
  createSession,
  getInitialSuggestions,
  toApiMessages,
} from "./chat-store";

describe("chat-store", () => {
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
      },
    ]);
  });
});
