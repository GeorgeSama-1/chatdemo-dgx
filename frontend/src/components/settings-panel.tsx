import React from "react";
import type { ChatSettings } from "../lib/types";
import {
  getMatchingSystemPromptPreset,
  SYSTEM_PROMPT_PRESETS,
} from "../lib/chat-store";

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
  const selectedPreset = getMatchingSystemPromptPreset(settings.system_prompt);

  return (
    <aside className={`settings-panel ${isOpen ? "open" : ""}`}>
      <button className="settings-toggle" type="button" onClick={onToggle}>
        {isOpen ? "收起参数" : "展开参数"}
      </button>
      <div className="settings-card">
        <div className="settings-header">
          <h2>生成参数</h2>
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
          <span>system prompt 模板</span>
          <select
            aria-label="system prompt 模板"
            value={selectedPreset}
            onChange={(event) => {
              const nextPreset = SYSTEM_PROMPT_PRESETS.find(
                (preset) => preset.id === event.target.value
              );

              if (!nextPreset) {
                return;
              }

              onChange({
                ...settings,
                system_prompt: nextPreset.prompt,
              });
            }}
          >
            {SYSTEM_PROMPT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
            <option value="custom">自定义</option>
          </select>
        </label>

        <label className="field">
          <span>system prompt</span>
          <textarea
            aria-label="system prompt"
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
