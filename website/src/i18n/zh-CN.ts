export const zhCN: Record<string, string> = {
  "header.badge": "Engineering Practicum · 12 Weeks · Rust + RISC-V",
  "header.title": "从零构建 TinyOS",
  "header.subtitle1": "用 Rust 在 QEMU RISC-V 上实现一个可启动、可分时、可分页、可持久化文件、可 shell 交互的小型 Unix-like 内核。",
  "header.subtitle2": "每个 Phase 都有可运行的交付物，最终产出一个 star-ready 的开源 OS。",

  "tab.roadmap": "课程路线",
  "tab.architecture": "系统架构",
  "tab.principles": "设计原则",

  "phase.concepts": "核心知识点",
  "phase.references": "参考资料",
  "phase.deliverable": "✦ 交付物",
  "phase.acceptance": "验收标准",
  "phase.enter": "进入课程 →",

  "arch.desc": "整体架构采用自底向上的分层设计：每一层对应一个 Phase 的交付物，上层依赖下层，下层不感知上层。任何一层的 bug 都应该可以在它自己的 phase 内被定位和修复。",
  "arch.dataflow": "一次 sys_read 的完整数据流",

  "principles.desc": "源自 xv6 / rCore / OSTEP 的教学经验，贯穿整个课程。如果某一步觉得走不下去了，回来对照这几条原则通常能找到症结。",

  "lesson.back": "← 返回课程路线",
  "lesson.prev": "← 上一课",
  "lesson.next": "下一课 →",
  "lesson.complete": "完成 Phase {phaseId} →",
  "lesson.objectives": "学习目标",
  "lesson.content": "课程内容",
  "lesson.exercises": "实战练习",
  "lesson.criteria": "验收标准",
  "lesson.references": "参考资料",
  "lesson.showPseudo": "查看伪代码",
  "lesson.hidePseudo": "隐藏伪代码",
  "lesson.showHints": "显示提示",
  "lesson.hideHints": "隐藏提示",
  "lesson.notFound": "课程内容尚未开放",

  "lang.zhCN": "简中",
  "lang.zhTW": "繁中",
  "lang.en": "EN",
};
