import type { PhaseContent } from "./types";

const LAB_FILE = "labs/phase_6_shell/COURSE.zh-CN.md";
const LAB_FILE_EN = "labs/phase_6_shell/COURSE.en.md";

export const phase6ZhCN: PhaseContent = {
  phaseId: 6, color: "#DB2777", accent: "#F472B6",
  lessons: [
    {
      phaseId: 6, lessonId: 1,
      title: "Phase 6 导读：Shell 与管道",
      subtitle: "Shell & Pipes",
      type: "Concept + Practice",
      duration: "3-4 hours",
      objectives: [
        "掌握 Shell 与管道 的核心机制",
        "理解本 phase 3 个实验之间的依赖",
        "能用 QEMU + gdb 调试本 phase 的关键数据结构",
        "完成所有 TODO 后 make qemu 看到交付物运行",
      ],
      sections: [
        {
          title: "本 Phase 的关键主题",
          blocks: [
            { type: "paragraph", text: "Phase 6 聚焦于 Shell 与管道。完整教材（含 ASCII 图、代码剖析、常见错误表、三层级参考资料）请打开 labs 目录下的 COURSE.zh-CN.md 阅读；这里只做路线摘要。" },
            { type: "list", ordered: true, items: [
              "fork 如何复制整个地址空间",
              "Pipe：环形缓冲 + Weak<> EOF",
              "Shell 解析管道与重定向"
            ]},
            { type: "callout", variant: "tip", text: "打开终端进入 labs/phase_6_shell/，先 make test 再 make qemu，再读 COURSE.zh-CN.md 对照代码——这是最高效的学习路径。" },
          ],
        },
      ],
      exercises: [
        {
          id: "main", title: "本 Phase 的 Lab 集合",
          description: "按顺序完成三个 Lab。每个 Lab 的 TODO 都有 HINT 与伪代码，对应的 COURSE.zh-CN.md 有完整讲解。",
          labFile: "labs/phase_6_shell/README.md",
          hints: [
            "建议按 Lab 1 → Lab 2 → Lab 3 的顺序完成，后一个依赖前一个的实现",
            "卡住时先看 COURSE.zh-CN.md 对应章节的\"常见错误\"表",
            "make test 跑 host-side 单元测试；make grade 看综合评分",
          ],
        },
      ],
      acceptanceCriteria: [
        "make test 全部通过",
        "make qemu 能看到 phase_6 交付物的预期行为",
        "scripts/grade.py 评分为满分",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.zh-CN.md", description: "[必读] 本 phase 的完整中文教材（课程大纲之外的所有细节都在这里）", url: "./labs/phase_6_shell/COURSE.zh-CN.md" },
        { title: "xv6-riscv book", description: "[深入阅读] 对应章节的 C 语言实现，可对照 Rust 版差异", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial", description: "[深入阅读] 同样用 Rust + RISC-V 的姊妹教程", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/" },
      ],
    },
  ],
};

export const phase6En: PhaseContent = {
  phaseId: 6, color: "#DB2777", accent: "#F472B6",
  lessons: [
    {
      phaseId: 6, lessonId: 1,
      title: "Phase 6 Overview: Shell & Pipes",
      subtitle: "Shell & Pipes",
      type: "Concept + Practice",
      duration: "3-4 hours",
      objectives: [
        "Master the core mechanics of Shell & Pipes",
        "Understand how the 3 labs in this phase depend on each other",
        "Debug this phase's key data structures with QEMU + gdb",
        "Complete all TODOs and watch the deliverable run via make qemu",
      ],
      sections: [
        {
          title: "Key topics in this Phase",
          blocks: [
            { type: "paragraph", text: "Phase 6 focuses on Shell & Pipes. Open labs/phase_6_shell/COURSE.en.md for the full textbook (ASCII diagrams, code walk-through, common-mistake tables, three-tier references). This page is only a roadmap summary." },
            { type: "list", ordered: true, items: [
              "How fork duplicates an entire address space",
              "Pipe: ring buffer + Weak<> for EOF",
              "Shell parsing pipes and redirection"
            ]},
            { type: "callout", variant: "tip", text: "Open a terminal in labs/phase_6_shell/, run make test then make qemu, then read COURSE.en.md side-by-side with the code — the highest-bandwidth way to learn." },
          ],
        },
      ],
      exercises: [
        {
          id: "main", title: "This Phase's Lab Set",
          description: "Complete the 3 Labs in order. Every TODO has HINTs + pseudocode; the full explanation lives in COURSE.en.md.",
          labFile: "labs/phase_6_shell/README.md",
          hints: [
            "Do Lab 1 → Lab 2 → Lab 3 in order — each builds on the previous",
            "When stuck, read the \"common mistakes\" table in the matching chapter of COURSE.en.md",
            "make test runs host-side unit tests; make grade gives the composite score",
          ],
        },
      ],
      acceptanceCriteria: [
        "make test passes entirely",
        "make qemu shows the expected phase_6 deliverable behavior",
        "scripts/grade.py reports a full score",
      ],
      references: [
        { title: "labs/phase_6_shell/COURSE.en.md", description: "[Required] The full English textbook for this phase (all the depth that doesn't fit the roadmap)", url: "./labs/phase_6_shell/COURSE.en.md" },
        { title: "xv6-riscv book", description: "[Deep dive] The equivalent C implementation — great for cross-checking the Rust version", url: "https://pdos.csail.mit.edu/6.828/2023/xv6/book-riscv-rev3.pdf" },
        { title: "rCore-Tutorial", description: "[Deep dive] Sister tutorial using Rust + RISC-V", url: "https://rcore-os.cn/rCore-Tutorial-Book-v3/" },
      ],
    },
  ],
};
