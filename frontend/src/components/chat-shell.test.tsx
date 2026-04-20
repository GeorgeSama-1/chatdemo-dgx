import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { ChatShell } from "./chat-shell";


describe("ChatShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the branded shell and primary controls", () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<ChatShell />);

    expect(screen.getByText("BW Labs")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "博微 智能助手" })
    ).toBeInTheDocument();
    expect(screen.getByText("服务在线")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建会话" })).toBeInTheDocument();
    expect(screen.getByText("推荐问题")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("输入你的问题，支持多轮对话与代码问答...")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("system prompt 模板")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "隐藏参数" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起参数" })).toBeInTheDocument();
  });

  it("updates the system prompt textarea when switching presets", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<ChatShell />);

    await user.selectOptions(
      screen.getByLabelText("system prompt 模板"),
      "power-inspection"
    );

    await waitFor(() => {
      expect(screen.getByLabelText("system prompt")).toHaveValue(
        "你是一名专业、严谨、稳重的电力巡检图像分析助手，专注于识别绝缘子及其可见缺陷。你必须基于图像真实可见内容进行判断，优先输出清晰结论、关键依据和可执行建议；对于证据不足、图像质量差或无法确认的情况，应明确说明不确定性，避免臆测和误报。"
      );
    });
  });

  it("switches suggestion cards when the system prompt preset changes", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<ChatShell />);

    expect(
      screen.getByRole("button", { name: "帮我梳理这份方案的风险和推进建议" })
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText("system prompt 模板"),
      "power-inspection"
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: "分析这张绝缘子图片，判断是否存在可见缺陷",
        })
      ).toBeInTheDocument();
    });
  });

  it("shows uploaded image previews before sending", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/health")) {
        return new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/uploads")) {
        return new Response(
          JSON.stringify({
            files: [
              {
                upload_id: "upl_preview",
                name: "chart.png",
                mime_type: "image/png",
                size: 12,
                preview_url: "/api/uploads/upl_preview/preview",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<ChatShell />);

    const fileInput = screen.getByLabelText("上传图片");
    const file = new File(["image-bytes"], "chart.png", { type: "image/png" });
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByText("chart.png")).toBeInTheDocument();
    });

    fetchMock.mockRestore();
  });

  it("sends attachment upload ids with the user message", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/health")) {
        return new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.endsWith("/api/uploads")) {
        return new Response(
          JSON.stringify({
            files: [
              {
                upload_id: "upl_send",
                name: "board.png",
                mime_type: "image/png",
                size: 12,
                preview_url: "/api/uploads/upl_send/preview",
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (url.endsWith("/api/chat")) {
        return new Response('{"type":"done"}\n', {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }

      throw new Error(`Unexpected fetch: ${url} ${init?.method ?? "GET"}`);
    });

    render(<ChatShell />);

    const fileInput = screen.getByLabelText("上传图片");
    const file = new File(["image-bytes"], "board.png", { type: "image/png" });
    await user.upload(fileInput, file);
    await user.type(
      screen.getByPlaceholderText("输入你的问题，支持多轮对话与代码问答..."),
      "请分析图片"
    );
    await user.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      const chatCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith("/api/chat")
      );
      expect(chatCall).toBeDefined();
      const requestBody = JSON.parse(String(chatCall?.[1]?.body));
      expect(requestBody.messages[0].attachments).toEqual(["upl_send"]);
    });

    fetchMock.mockRestore();
  });

  it("deletes the current session from the list and session storage", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ model: "Qwen3.5-VL" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    render(<ChatShell />);

    await user.click(screen.getByRole("button", { name: "新建会话" }));
    expect(screen.getAllByRole("button", { name: /新建会话/ }).length).toBeGreaterThan(1);

    await user.click(screen.getByRole("button", { name: "删除当前会话" }));

    await waitFor(() => {
      const stored = window.sessionStorage.getItem("chatdemo-dgx.sessions");
      const sessions = stored ? (JSON.parse(stored) as Array<{ id: string }>) : [];
      expect(sessions).toHaveLength(1);
    });
  });
});
