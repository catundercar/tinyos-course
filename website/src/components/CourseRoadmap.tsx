import { useState } from "react";
import { Link } from "react-router-dom";
import { hasLessons } from "../data";
import { getPhases, getPrinciples, getArchitecture } from "../data/phases";
import { useLocale } from "../i18n";
import type { Locale } from "../i18n";
import LanguageSwitcher from "./LanguageSwitcher";

export default function CourseRoadmap() {
  const [activePhase, setActivePhase] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>("roadmap");
  const { t, locale } = useLocale();

  const PHASES = getPhases(locale as Locale);
  const ARCHITECTURE = getArchitecture();
  const principles = getPrinciples(locale as Locale);

  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      background: "#0A0A0B",
      color: "#E4E4E7",
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(228,228,231,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(228,228,231,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10,
        padding: "48px 32px 24px",
        borderBottom: "1px solid rgba(228,228,231,0.08)",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: "inline-block",
                padding: "4px 12px",
                background: "rgba(232,69,60,0.15)",
                border: "1px solid rgba(232,69,60,0.3)",
                borderRadius: 4,
                fontSize: 11,
                letterSpacing: "0.1em",
                color: "#E8453C",
                marginBottom: 16,
                textTransform: "uppercase",
              }}>
                {t("header.badge")}
              </div>
              <h1 style={{
                fontSize: 36,
                fontWeight: 700,
                lineHeight: 1.2,
                margin: "0 0 8px",
                background: "linear-gradient(135deg, #E4E4E7 0%, #A1A1AA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}>
                {t("header.title")}
              </h1>
              <p style={{
                fontSize: 15,
                color: "#71717A",
                margin: 0,
                maxWidth: 600,
                lineHeight: 1.6,
              }}>
                {t("header.subtitle1")}<br/>
                {t("header.subtitle2")}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <a
                href="https://github.com/catundercar/building-effective-agents"
                target="_blank"
                rel="noopener noreferrer"
                title="GitHub"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  border: "1px solid rgba(228,228,231,0.12)",
                  background: "rgba(228,228,231,0.05)",
                  color: "#71717A",
                  textDecoration: "none",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "#E4E4E7";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(228,228,231,0.25)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(228,228,231,0.1)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = "#71717A";
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(228,228,231,0.12)";
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(228,228,231,0.05)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <LanguageSwitcher />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 2, marginTop: 32 }}>
            {[
              { key: "roadmap", label: t("tab.roadmap") },
              { key: "arch", label: t("tab.architecture") },
              { key: "principles", label: t("tab.principles") },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 20px",
                  background: activeTab === tab.key ? "rgba(228,228,231,0.1)" : "transparent",
                  border: "1px solid",
                  borderColor: activeTab === tab.key ? "rgba(228,228,231,0.15)" : "transparent",
                  borderRadius: 4,
                  color: activeTab === tab.key ? "#E4E4E7" : "#52525B",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "32px 32px 80px" }}>

        {activeTab === "roadmap" && (
          <div>
            {/* Timeline */}
            {PHASES.map((phase, i) => {
              const isOpen = activePhase === phase.id;
              return (
                <div key={phase.id} style={{ position: "relative", marginBottom: 2 }}>
                  {/* Connector line */}
                  {i < PHASES.length - 1 && (
                    <div style={{
                      position: "absolute",
                      left: 19,
                      top: 44,
                      bottom: -2,
                      width: 1,
                      background: `linear-gradient(to bottom, ${phase.color}44, ${PHASES[i+1].color}44)`,
                    }} />
                  )}

                  {/* Phase header */}
                  <button
                    onClick={() => setActivePhase(isOpen ? null : phase.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 16,
                      width: "100%",
                      padding: "16px 0",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    {/* Icon dot */}
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      background: `${phase.color}18`,
                      border: `1px solid ${phase.color}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      flexShrink: 0,
                      transition: "all 0.3s",
                      boxShadow: isOpen ? `0 0 20px ${phase.color}33` : "none",
                    }}>
                      {phase.icon}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: phase.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          {phase.week}
                        </span>
                        <span style={{ fontSize: 11, color: "#52525B" }}>
                          {phase.duration}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: "#E4E4E7",
                        margin: "4px 0 2px",
                        transition: "color 0.2s",
                      }}>
                        {phase.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#52525B", fontStyle: "italic" }}>
                        {phase.subtitle}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    <div style={{
                      color: "#52525B",
                      fontSize: 14,
                      transform: isOpen ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 0.2s",
                      marginTop: 8,
                    }}>
                      →
                    </div>
                  </button>

                  {/* Expanded content */}
                  {isOpen && (
                    <div style={{
                      marginLeft: 56,
                      marginBottom: 24,
                      animation: "fadeIn 0.3s ease",
                    }}>
                      {/* Goal */}
                      <div style={{
                        padding: "16px 20px",
                        background: `${phase.color}08`,
                        borderLeft: `2px solid ${phase.color}66`,
                        borderRadius: "0 8px 8px 0",
                        marginBottom: 24,
                        fontSize: 13,
                        lineHeight: 1.7,
                        color: "#A1A1AA",
                      }}>
                        {phase.goal}
                      </div>

                      {/* Three columns */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 16, marginBottom: 20 }}>
                        {/* Concepts */}
                        <div style={{
                          padding: 16,
                          background: "rgba(228,228,231,0.03)",
                          border: "1px solid rgba(228,228,231,0.06)",
                          borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                            {t("phase.concepts")}
                          </div>
                          {phase.concepts.map((c, j) => (
                            <div key={j} style={{
                              fontSize: 12,
                              color: "#A1A1AA",
                              padding: "6px 0",
                              borderBottom: j < phase.concepts.length - 1 ? "1px solid rgba(228,228,231,0.04)" : "none",
                              display: "flex",
                              gap: 8,
                            }}>
                              <span style={{ color: phase.color, opacity: 0.6 }}>›</span>
                              {c}
                            </div>
                          ))}
                        </div>

                        {/* Readings */}
                        <div style={{
                          padding: 16,
                          background: "rgba(228,228,231,0.03)",
                          border: "1px solid rgba(228,228,231,0.06)",
                          borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>
                            {t("phase.references")}
                          </div>
                          {phase.readings.map((r, j) => (
                            <div key={j} style={{
                              fontSize: 12,
                              color: "#A1A1AA",
                              padding: "6px 0",
                              borderBottom: j < phase.readings.length - 1 ? "1px solid rgba(228,228,231,0.04)" : "none",
                              display: "flex",
                              gap: 8,
                            }}>
                              <span style={{ color: "#52525B" }}>📄</span>
                              {r}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Deliverable */}
                      <div style={{
                        padding: 20,
                        background: `linear-gradient(135deg, ${phase.color}0A, ${phase.accent}06)`,
                        border: `1px solid ${phase.color}22`,
                        borderRadius: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                          <div style={{
                            fontSize: 10,
                            color: phase.color,
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            fontWeight: 700,
                          }}>
                            {t("phase.deliverable")}
                          </div>
                          <code style={{
                            fontSize: 13,
                            color: phase.accent,
                            background: `${phase.color}15`,
                            padding: "2px 8px",
                            borderRadius: 4,
                          }}>
                            {phase.deliverable.name}
                          </code>
                        </div>
                        <p style={{ fontSize: 13, color: "#A1A1AA", lineHeight: 1.7, margin: "0 0 16px" }}>
                          {phase.deliverable.desc}
                        </p>
                        <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                          {t("phase.acceptance")}
                        </div>
                        {phase.deliverable.acceptance.map((a, j) => (
                          <div key={j} style={{
                            fontSize: 12,
                            color: "#A1A1AA",
                            padding: "5px 0",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                          }}>
                            <span style={{
                              display: "inline-block",
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              border: `1px solid ${phase.color}44`,
                              flexShrink: 0,
                              marginTop: 1,
                            }} />
                            {a}
                          </div>
                        ))}
                      </div>

                      {/* 進入課程按鈕 */}
                      {hasLessons(phase.id) && (
                        <Link
                          to={`/phase/${phase.id}/lesson/1`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            marginTop: 16,
                            padding: "10px 20px",
                            background: `${phase.color}18`,
                            border: `1px solid ${phase.color}44`,
                            borderRadius: 6,
                            color: phase.accent,
                            fontSize: 13,
                            textDecoration: "none",
                            fontFamily: "inherit",
                            cursor: "pointer",
                            transition: "background 0.2s",
                          }}
                        >
                          {t("phase.enter")}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "arch" && (
          <div>
            <p style={{ fontSize: 13, color: "#71717A", marginBottom: 32, lineHeight: 1.7 }}>
              {t("arch.desc")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ARCHITECTURE.layers.map((layer, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "stretch",
                  gap: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: `1px solid ${layer.color}22`,
                }}>
                  {/* Layer label */}
                  <div style={{
                    width: 180,
                    padding: "16px 20px",
                    background: `${layer.color}12`,
                    borderRight: `1px solid ${layer.color}22`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: layer.color }}>
                      {layer.name}
                    </div>
                    <div style={{ fontSize: 10, color: "#52525B", marginTop: 2 }}>
                      Phase {ARCHITECTURE.layers.length - 1 - i}
                    </div>
                  </div>
                  {/* Modules */}
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: 12,
                    background: "rgba(228,228,231,0.02)",
                    alignItems: "center",
                  }}>
                    {layer.modules.map((mod, j) => (
                      <div key={j} style={{
                        padding: "6px 12px",
                        background: `${layer.color}0A`,
                        border: `1px solid ${layer.color}18`,
                        borderRadius: 4,
                        fontSize: 11,
                        color: "#A1A1AA",
                      }}>
                        {mod}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Data flow */}
            <div style={{
              marginTop: 32,
              padding: 24,
              background: "rgba(228,228,231,0.03)",
              border: "1px solid rgba(228,228,231,0.06)",
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, color: "#71717A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                {t("arch.dataflow")}
              </div>
              <div style={{ fontFamily: "inherit", fontSize: 12, color: "#71717A", lineHeight: 2.2 }}>
                <span style={{ color: "#E8453C" }}>User Input</span>
                {" → "}
                <span style={{ color: "#E8453C" }}>CLI Parser</span>
                {" → "}
                <span style={{ color: "#7C3AED" }}>Agent Loop</span>
                {" → "}
                <span style={{ color: "#7C3AED" }}>Planner</span>
                {" → "}
                <span style={{ color: "#059669" }}>Workflow Select</span>
                {" → "}
                <span style={{ color: "#2563EB" }}>LLM Call</span>
                {" → "}
                <span style={{ color: "#D97706" }}>Tool Execute</span>
                {" → "}
                <span style={{ color: "#7C3AED" }}>Observe Result</span>
                {" → "}
                <span style={{ color: "#7C3AED" }}>Loop / Complete</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "principles" && (
          <div>
            <p style={{ fontSize: 13, color: "#71717A", marginBottom: 32, lineHeight: 1.7 }}>
              {t("principles.desc")}
            </p>
            {principles.map((p, i) => (
              <div key={i} style={{
                display: "flex",
                gap: 20,
                padding: "24px 0",
                borderBottom: i < 4 ? "1px solid rgba(228,228,231,0.06)" : "none",
              }}>
                <div style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: `${p.color}33`,
                  lineHeight: 1,
                  flexShrink: 0,
                  width: 48,
                }}>
                  {p.num}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#E4E4E7", marginBottom: 8 }}>
                    {p.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#71717A", lineHeight: 1.7 }}>
                    {p.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10,
        padding: "24px 32px",
        borderTop: "1px solid rgba(228,228,231,0.06)",
        marginTop: 48,
      }}>
        <div style={{
          maxWidth: 960, margin: "0 auto",
          display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 12, color: "#52525B" }}>Generated by</span>
          <a
            href="https://github.com/catundercar/course-builder-plugin"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "#71717A",
              textDecoration: "none",
              padding: "4px 10px",
              border: "1px solid rgba(228,228,231,0.08)",
              borderRadius: 6,
              background: "rgba(228,228,231,0.03)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#E4E4E7";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(228,228,231,0.2)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.color = "#71717A";
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(228,228,231,0.08)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            course-builder-plugin
          </a>
        </div>
      </footer>
    </div>
  );
}
