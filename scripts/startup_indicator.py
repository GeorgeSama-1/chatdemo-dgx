#!/usr/bin/env python3

from __future__ import annotations

import sys
from pathlib import Path
import tkinter as tk


POLL_MS = 250


class StartupIndicator:
    def __init__(self, status_path: Path, title: str) -> None:
        self.status_path = status_path
        self.root = tk.Tk()
        self.root.title(title)
        self.root.resizable(False, False)
        self.root.attributes("-topmost", True)
        self.root.configure(bg="#f6f8fb")
        self.root.protocol("WM_DELETE_WINDOW", self._close)

        container = tk.Frame(self.root, bg="#f6f8fb", padx=20, pady=18)
        container.pack()

        header = tk.Frame(container, bg="#f6f8fb")
        header.pack(fill="x")

        self.icon = tk.Label(
            header,
            bitmap="info",
            bg="#f6f8fb",
            fg="#0f4c81",
        )
        self.icon.pack(side="left", padx=(0, 12))

        titles = tk.Frame(header, bg="#f6f8fb")
        titles.pack(side="left", fill="x")

        tk.Label(
            titles,
            text=title,
            font=("Sans", 14, "bold"),
            bg="#f6f8fb",
            fg="#1b2733",
            anchor="w",
        ).pack(fill="x")

        self.subtitle = tk.Label(
            titles,
            text="正在准备启动...",
            font=("Sans", 11),
            bg="#f6f8fb",
            fg="#586673",
            anchor="w",
        )
        self.subtitle.pack(fill="x", pady=(4, 0))

        self.detail = tk.Label(
            container,
            text="请稍候，前后端正在启动。",
            justify="left",
            font=("Sans", 10),
            bg="#f6f8fb",
            fg="#586673",
            wraplength=360,
            anchor="w",
        )
        self.detail.pack(fill="x", pady=(16, 0))

        self.close_button = tk.Button(
            container,
            text="关闭",
            command=self._close,
            padx=14,
            pady=4,
        )

        self._ticks = 0
        self._error_mode = False
        self._center_window()
        self._poll()

    def _center_window(self) -> None:
        self.root.update_idletasks()
        width = self.root.winfo_width()
        height = self.root.winfo_height()
        x = (self.root.winfo_screenwidth() - width) // 2
        y = (self.root.winfo_screenheight() - height) // 2
        self.root.geometry(f"{width}x{height}+{x}+{y}")

    def _read_status(self) -> str:
        try:
            return self.status_path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return ""

    def _close(self) -> None:
        self.root.destroy()

    def _set_running(self, message: str) -> None:
        dots = "." * ((self._ticks % 3) + 1)
        self.icon.configure(bitmap="info", fg="#0f4c81")
        self.subtitle.configure(text=f"{message}{dots}", fg="#223240")
        self.detail.configure(text="请稍候，前后端正在启动。", fg="#586673")
        if self.close_button.winfo_ismapped():
            self.close_button.pack_forget()

    def _set_error(self, message: str) -> None:
        self._error_mode = True
        self.icon.configure(bitmap="warning", fg="#b34747")
        self.subtitle.configure(text="启动失败", fg="#8b2f2f")
        self.detail.configure(text=message, fg="#8b2f2f")
        if not self.close_button.winfo_ismapped():
            self.close_button.pack(pady=(16, 0))
        self._center_window()

    def _poll(self) -> None:
        status = self._read_status()
        self._ticks += 1

        if status == "DONE":
            self._close()
            return

        if status.startswith("ERROR:"):
            self._set_error(status.removeprefix("ERROR:").strip())
            self.root.after(POLL_MS, self._poll)
            return

        self._set_running(status or "正在准备启动")
        self.root.after(POLL_MS, self._poll)

    def run(self) -> None:
        self.root.mainloop()


def main() -> int:
    if len(sys.argv) != 3:
      return 1

    status_path = Path(sys.argv[1])
    title = sys.argv[2]
    indicator = StartupIndicator(status_path, title)
    indicator.run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
