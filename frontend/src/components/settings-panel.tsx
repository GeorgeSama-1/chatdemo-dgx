import React from "react";
import type { ChatSettings } from "../lib/types";

type SettingsPanelProps = {
  isOpen: boolean;
  settings: ChatSettings;
  onToggle: () => void;
  onChange: (settings: ChatSettings) => void;
};

export function SettingsPanel({
  isOpen,
  settings,
  onToggle,
  onChange,
}: SettingsPanelProps) {
  return (
    <aside className={`settings-panel ${isOpen ? "open" : ""}`}>
      <button className="settings-toggle" type="button" onClick={onToggle}>
        {isOpen ? "收起参数" : "展开参数"}
      </button>
      <div className="settings-card">
        <div className="settings-header">
          <h2>生成参数</h2>
          <p>按企业 demo 的常见调试方式保留基础参数。</p>
        </div>

        <label className="field">
          <span>temperature</span>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            onChange={(event) =>
              onChange({
                ...settings,
                temperature: Number(event.target.value),
              })
            }
          />
        </label>

        <label className="field">
          <span>max_tokens</span>
          <input
            type="number"
            min="1"
            max="8192"
            step="1"
            value={settings.max_tokens}
            onChange={(event) =>
              onChange({
                ...settings,
                max_tokens: Number(event.target.value),
              })
            }
          />
        </label>

        <label className="field">
          <span>system prompt</span>
          <textarea
            rows={8}
            value={settings.system_prompt}
            onChange={(event) =>
              onChange({
                ...settings,
                system_prompt: event.target.value,
              })
            }
          />
        </label>
      </div>
    </aside>
  );
}
