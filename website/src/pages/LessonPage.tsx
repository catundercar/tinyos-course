import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPhaseContent, getLesson } from "../data";
import type { ContentBlock, ContentSection } from "../data/types";
import { useLocale } from "../i18n";

export default function LessonPage() {
  const { phaseId, lessonId } = useParams<{ phaseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const { t, locale } = useLocale();

  const pId = Number(phaseId);
  const lId = Number(lessonId);
  const phase = getPhaseContent(pId, locale);
  const lesson = getLesson(pId, lId, locale);

  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
  const [expandedPseudo, setExpandedPseudo] = useState<Set<string>>(new Set());

  // Scroll to top on lesson change
  useEffect(() => {
    window.scrollTo(0, 0);
    setExpandedSections(new Set());
    setExpandedHints(new Set());
    setExpandedPseudo(new Set());
  }, [phaseId, lessonId]);

  if (!phase || !lesson) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <Link to="/" style={styles.backLink}>{t("lesson.back")}</Link>
          <div style={{ marginTop: 48, textAlign: "center", color: "#71717A" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>404</div>
            <div style={{ fontSize: 15 }}>{t("lesson.notFound")}</div>
          </div>
        </div>
      </div>
    );
  }

  const color = phase.color;
  const accent = phase.accent;
  const totalLessons = phase.lessons.length;
  const hasPrev = lId > 1;
  const hasNext = lId < totalLessons;

  const toggleSection = (i: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleHint = (id: string) => {
    setExpandedHints((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePseudo = (id: string) => {
    setExpandedPseudo((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={styles.page}>
      {/* Background grid */}
      <div style={styles.grid} />

      <div style={styles.container}>
        {/* Back nav */}
        <Link to="/" style={styles.backLink}>{t("lesson.back")}</Link>

        {/* Header */}
        <header style={{ marginTop: 24, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{
              padding: "4px 10px",
              background: `${color}18`,
              border: `1px solid ${color}44`,
              borderRadius: 4,
              fontSize: 11,
              letterSpacing: "0.08em",
              color,
              textTransform: "uppercase" as const,
            }}>
              Phase {pId} · Lesson {lId}
            </span>
            <span style={{
              padding: "4px 10px",
              background: "rgba(228,228,231,0.06)",
              border: "1px solid rgba(228,228,231,0.1)",
              borderRadius: 4,
              fontSize: 11,
              color: "#A1A1AA",
            }}>
              {lesson.type} · {lesson.duration}
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(22px, 5vw, 28px)",
            fontWeight: 700,
            lineHeight: 1.3,
            margin: "0 0 6px",
            color: "#E4E4E7",
          }}>
            {lesson.title}
          </h1>
          <p style={{ fontSize: 14, color: "#52525B", fontStyle: "italic", margin: 0 }}>
            {lesson.subtitle}
          </p>

          {/* Lesson navigation */}
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            {hasPrev && (
              <button onClick={() => navigate(`/phase/${pId}/lesson/${lId - 1}`)} style={navBtnStyle(color)}>
                {t("lesson.prev")}
              </button>
            )}
            {hasNext && (
              <button onClick={() => navigate(`/phase/${pId}/lesson/${lId + 1}`)} style={navBtnStyle(color)}>
                {t("lesson.next")}
              </button>
            )}
          </div>
        </header>

        {/* Learning Objectives */}
        <section style={{ marginBottom: 36 }}>
          <SectionTitle>{t("lesson.objectives")}</SectionTitle>
          <div style={styles.card}>
            {lesson.objectives.map((obj, i) => (
              <div key={i} style={{
                display: "flex",
                gap: 12,
                padding: "10px 0",
                borderBottom: i < lesson.objectives.length - 1 ? "1px solid rgba(228,228,231,0.06)" : "none",
                fontSize: 13,
                color: "#A1A1AA",
                lineHeight: 1.7,
              }}>
                <span style={{
                  color: accent,
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                  width: 20,
                  textAlign: "right" as const,
                }}>
                  {i + 1}.
                </span>
                <span>{obj}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Content Sections */}
        {lesson.sections.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionTitle>{t("lesson.content")}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lesson.sections.map((sec, i) => {
                const isOpen = expandedSections.has(i);
                return (
                  <div key={i} style={{
                    ...styles.card,
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                    borderColor: isOpen ? `${color}44` : "rgba(228,228,231,0.08)",
                  }}>
                    <div
                      onClick={() => toggleSection(i)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: isOpen ? color : "#52525B",
                          flexShrink: 0,
                          transition: "background 0.2s",
                        }} />
                        <span style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isOpen ? "#E4E4E7" : "#A1A1AA",
                          transition: "color 0.2s",
                        }}>
                          {sec.title}
                        </span>
                      </div>
                      <span style={{
                        color: "#52525B",
                        fontSize: 12,
                        transform: isOpen ? "rotate(90deg)" : "rotate(0)",
                        transition: "transform 0.2s",
                        flexShrink: 0,
                      }}>→</span>
                    </div>
                    {isOpen && (
                      <div style={{
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: "1px solid rgba(228,228,231,0.06)",
                        animation: "fadeIn 0.3s ease",
                      }}>
                        <RenderBlocks blocks={sec.blocks} color={color} accent={accent} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Code Exercises */}
        {lesson.exercises.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionTitle>{t("lesson.exercises")}</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {lesson.exercises.map((ex) => (
                <div key={ex.id} style={{
                  ...styles.card,
                  background: `linear-gradient(135deg, ${color}08, ${accent}04)`,
                  borderColor: `${color}22`,
                }}>
                  {/* Exercise header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <code style={{
                      fontSize: 12,
                      color: accent,
                      background: `${color}18`,
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontWeight: 600,
                    }}>
                      Step {ex.id}
                    </code>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#E4E4E7" }}>
                      {ex.title}
                    </span>
                  </div>

                  {/* Description */}
                  <pre style={{
                    fontSize: 13,
                    color: "#A1A1AA",
                    lineHeight: 1.8,
                    margin: "0 0 12px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontFamily: "inherit",
                  }}>
                    {ex.description}
                  </pre>

                  {/* Lab file */}
                  {ex.labFile && (
                    <div style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "4px 10px",
                      background: "rgba(228,228,231,0.06)",
                      borderRadius: 4,
                      fontSize: 12,
                      color: "#71717A",
                      marginBottom: 12,
                    }}>
                      <span style={{ opacity: 0.6 }}>📁</span>
                      <code style={{ color: "#A1A1AA" }}>{ex.labFile}</code>
                    </div>
                  )}

                  {/* Pseudocode */}
                  {ex.pseudocode && (
                    <div style={{ marginTop: 4, marginBottom: 8 }}>
                      <button
                        onClick={() => togglePseudo(ex.id)}
                        style={toggleBtnStyle}
                      >
                        <span style={{
                          transform: expandedPseudo.has(ex.id) ? "rotate(90deg)" : "rotate(0)",
                          transition: "transform 0.2s",
                          display: "inline-block",
                        }}>→</span>
                        {expandedPseudo.has(ex.id) ? t("lesson.hidePseudo") : t("lesson.showPseudo")}
                      </button>
                      {expandedPseudo.has(ex.id) && (
                        <pre style={{
                          ...codeBlockStyle,
                          marginTop: 8,
                          animation: "fadeIn 0.2s ease",
                        }}>
                          {ex.pseudocode}
                        </pre>
                      )}
                    </div>
                  )}

                  {/* Hints */}
                  {ex.hints.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <button
                        onClick={() => toggleHint(ex.id)}
                        style={toggleBtnStyle}
                      >
                        <span style={{
                          transform: expandedHints.has(ex.id) ? "rotate(90deg)" : "rotate(0)",
                          transition: "transform 0.2s",
                          display: "inline-block",
                        }}>→</span>
                        {expandedHints.has(ex.id) ? t("lesson.hideHints") : t("lesson.showHints")}
                      </button>
                      {expandedHints.has(ex.id) && (
                        <div style={{
                          marginTop: 8,
                          padding: "10px 14px",
                          background: "rgba(228,228,231,0.04)",
                          borderRadius: 6,
                          animation: "fadeIn 0.2s ease",
                        }}>
                          {ex.hints.map((hint, j) => (
                            <div key={j} style={{
                              fontSize: 12,
                              color: "#71717A",
                              padding: "4px 0",
                              display: "flex",
                              gap: 8,
                            }}>
                              <span style={{ color: "#52525B", flexShrink: 0 }}>💡</span>
                              <span>{hint}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Acceptance Criteria */}
        {lesson.acceptanceCriteria.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionTitle>{t("lesson.criteria")}</SectionTitle>
            <div style={styles.card}>
              {lesson.acceptanceCriteria.map((ac, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: i < lesson.acceptanceCriteria.length - 1 ? "1px solid rgba(228,228,231,0.06)" : "none",
                }}>
                  <span style={{
                    display: "inline-block",
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    border: `1px solid ${color}44`,
                    flexShrink: 0,
                    marginTop: 2,
                  }} />
                  <span style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.6 }}>{ac}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* References */}
        {lesson.references.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <SectionTitle>{t("lesson.references")}</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))", gap: 12 }}>
              {lesson.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...styles.card,
                    textDecoration: "none",
                    display: "block",
                    transition: "border-color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${color}44`;
                    e.currentTarget.style.background = `${color}08`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(228,228,231,0.08)";
                    e.currentTarget.style.background = "rgba(228,228,231,0.03)";
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: accent,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}>
                    {ref.title}
                    <span style={{ fontSize: 11, opacity: 0.6 }}>↗</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#71717A", lineHeight: 1.6 }}>
                    {ref.description}
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Bottom navigation */}
        <nav style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          paddingTop: 24,
          borderTop: "1px solid rgba(228,228,231,0.08)",
          marginBottom: 80,
        }}>
          <div>
            {hasPrev ? (
              <Link to={`/phase/${pId}/lesson/${lId - 1}`} style={navLinkStyle()}>
                ← {phase.lessons[lId - 2]?.title}
              </Link>
            ) : (
              <Link to="/" style={navLinkStyle()}>{t("lesson.back")}</Link>
            )}
          </div>
          <div>
            {hasNext ? (
              <Link to={`/phase/${pId}/lesson/${lId + 1}`} style={navLinkStyle()}>
                {phase.lessons[lId]?.title} →
              </Link>
            ) : (
              <Link to="/" style={navLinkStyle()}>{t("lesson.complete", { phaseId: pId })}</Link>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}

// ─── Rich Content Block Renderer ────────────────────────────

function RenderBlocks({ blocks, color, accent }: { blocks: ContentBlock[]; color: string; accent: string }) {
  return (
    <>
      {blocks.map((block, i) => (
        <RenderBlock key={i} block={block} color={color} accent={accent} />
      ))}
    </>
  );
}

function RenderBlock({ block, color, accent }: { block: ContentBlock; color: string; accent: string }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p style={{
          fontSize: 13,
          color: "#A1A1AA",
          lineHeight: 1.85,
          margin: "0 0 16px",
        }}>
          {block.text}
        </p>
      );

    case "heading": {
      const sizes = { 2: 18, 3: 15, 4: 13 };
      return (
        <div style={{
          fontSize: sizes[block.level],
          fontWeight: 600,
          color: block.level === 2 ? "#E4E4E7" : block.level === 3 ? "#D4D4D8" : "#A1A1AA",
          margin: block.level === 2 ? "28px 0 12px" : "20px 0 8px",
          paddingBottom: block.level === 2 ? 8 : 0,
          borderBottom: block.level === 2 ? "1px solid rgba(228,228,231,0.08)" : "none",
        }}>
          {block.text}
        </div>
      );
    }

    case "code":
      return (
        <pre style={{
          ...codeBlockStyle,
          margin: "0 0 16px",
        }}>
          {block.code}
        </pre>
      );

    case "diagram":
      return (
        <pre style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: "#71717A",
          background: "rgba(228,228,231,0.04)",
          border: "1px solid rgba(228,228,231,0.08)",
          borderRadius: 8,
          padding: "16px 20px",
          margin: "0 0 16px",
          overflowX: "auto",
          fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
          whiteSpace: "pre",
        }}>
          {block.content}
        </pre>
      );

    case "table":
      return (
        <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            fontFamily: "inherit",
          }}>
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th key={i} style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(228,228,231,0.15)",
                    color: "#E4E4E7",
                    fontWeight: 600,
                    fontSize: 11,
                    letterSpacing: "0.05em",
                    whiteSpace: "nowrap",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{
                      padding: "8px 12px",
                      borderBottom: "1px solid rgba(228,228,231,0.06)",
                      color: "#A1A1AA",
                      lineHeight: 1.6,
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "callout": {
      const variantStyles: Record<string, { bg: string; border: string; icon: string }> = {
        info: { bg: "rgba(37,99,235,0.08)", border: "rgba(37,99,235,0.3)", icon: "ℹ" },
        warning: { bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.3)", icon: "⚠" },
        tip: { bg: "rgba(5,150,105,0.08)", border: "rgba(5,150,105,0.3)", icon: "💡" },
        quote: { bg: `${color}08`, border: `${color}44`, icon: "›" },
      };
      const v = variantStyles[block.variant] || variantStyles.info;
      return (
        <div style={{
          padding: "14px 18px",
          background: v.bg,
          borderLeft: `3px solid ${v.border}`,
          borderRadius: "0 6px 6px 0",
          margin: "0 0 16px",
          fontSize: 13,
          lineHeight: 1.8,
          color: "#A1A1AA",
        }}>
          {block.text}
        </div>
      );
    }

    case "list":
      return (
        <div style={{ margin: "0 0 16px", paddingLeft: 4 }}>
          {block.items.map((item, i) => (
            <div key={i} style={{
              display: "flex",
              gap: 10,
              padding: "4px 0",
              fontSize: 13,
              color: "#A1A1AA",
              lineHeight: 1.7,
            }}>
              <span style={{ color: "#52525B", flexShrink: 0, width: 16, textAlign: "right" as const }}>
                {block.ordered ? `${i + 1}.` : "·"}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

// ─── Sub Components ─────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      color: "#71717A",
      letterSpacing: "0.12em",
      textTransform: "uppercase" as const,
      marginBottom: 12,
      fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

// ─── Style Constants ────────────────────────────────────────

const codeBlockStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: "#D4D4D8",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(228,228,231,0.08)",
  borderRadius: 8,
  padding: "14px 18px",
  overflowX: "auto",
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  whiteSpace: "pre",
};

const toggleBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  fontSize: 12,
  color: "#52525B",
  padding: "4px 0",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

function navBtnStyle(color: string): React.CSSProperties {
  return {
    padding: "6px 14px",
    background: `${color}12`,
    border: `1px solid ${color}33`,
    borderRadius: 4,
    color: "#A1A1AA",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function navLinkStyle(): React.CSSProperties {
  return {
    color: "#71717A",
    textDecoration: "none",
    fontSize: 13,
    padding: "8px 0",
    transition: "color 0.2s",
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    background: "#0A0A0B",
    color: "#E4E4E7",
    minHeight: "100vh",
    position: "relative",
  },
  grid: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    backgroundImage: `
      linear-gradient(rgba(228,228,231,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(228,228,231,0.03) 1px, transparent 1px)
    `,
    backgroundSize: "40px 40px",
    pointerEvents: "none" as const,
  },
  container: {
    position: "relative",
    zIndex: 10,
    maxWidth: 760,
    margin: "0 auto",
    padding: "32px 20px 0",
  },
  backLink: {
    color: "#52525B",
    textDecoration: "none",
    fontSize: 13,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    transition: "color 0.2s",
  },
  card: {
    padding: "16px 20px",
    background: "rgba(228,228,231,0.03)",
    border: "1px solid rgba(228,228,231,0.08)",
    borderRadius: 8,
  },
};
