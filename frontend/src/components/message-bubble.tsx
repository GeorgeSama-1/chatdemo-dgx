import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatMessage } from "../lib/types";


const roleLabel: Record<ChatMessage["role"], string> = {
  system: "系统",
  user: "我",
  assistant: "AI",
};

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <article className={`message-bubble message-${message.role}`}>
      <div className="message-meta">
        <span className="message-role">{roleLabel[message.role]}</span>
        <time dateTime={new Date(message.createdAt).toISOString()}>
          {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      {message.attachments?.length ? (
        <div className="message-attachments">
          {message.attachments.map((attachment) => (
            <a
              key={attachment.id}
              className="message-attachment"
              href={attachment.previewUrl}
              target="_blank"
              rel="noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.previewUrl} alt={attachment.name} />
              <span>{attachment.name}</span>
            </a>
          ))}
        </div>
      ) : null}
      <div className="message-content markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code(props) {
              const { children, className } = props;
              const isInline = !className;

              if (isInline) {
                return <code className="inline-code">{children}</code>;
              }

              return (
                <pre className="code-block">
                  <code className={className}>{children}</code>
                </pre>
              );
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
