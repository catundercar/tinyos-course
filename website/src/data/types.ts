// ─── Rich Content Blocks ────────────────────────────────────

export type ContentBlock =
  | ParagraphBlock
  | HeadingBlock
  | CodeBlock
  | DiagramBlock
  | TableBlock
  | CalloutBlock
  | ListBlock;

export interface ParagraphBlock {
  type: "paragraph";
  text: string;
}

export interface HeadingBlock {
  type: "heading";
  level: 2 | 3 | 4;
  text: string;
}

export interface CodeBlock {
  type: "code";
  language?: string;
  code: string;
}

export interface DiagramBlock {
  type: "diagram";
  content: string;
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface CalloutBlock {
  type: "callout";
  variant: "info" | "warning" | "tip" | "quote";
  text: string;
}

export interface ListBlock {
  type: "list";
  ordered: boolean;
  items: string[];
}

// ─── Content Section ────────────────────────────────────────

export interface ContentSection {
  title: string;
  blocks: ContentBlock[];
}

// ─── Lesson Data ────────────────────────────────────────────

export interface LessonReference {
  title: string;
  description: string;
  url: string;
}

export interface CodeExercise {
  id: string;
  title: string;
  description: string;
  labFile?: string;
  hints: string[];
  pseudocode?: string;
}

export interface Lesson {
  phaseId: number;
  lessonId: number;
  title: string;
  subtitle: string;
  type: string;
  duration: string;
  objectives: string[];
  sections: ContentSection[];
  exercises: CodeExercise[];
  acceptanceCriteria: string[];
  references: LessonReference[];
}

export interface PhaseContent {
  phaseId: number;
  color: string;
  accent: string;
  lessons: Lesson[];
}
