import React from "react";
import { render, screen } from "@testing-library/react";

import { ChatShell } from "./chat-shell";


describe("ChatShell", () => {
  it("renders the branded shell and primary controls", () => {
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
  });
});
