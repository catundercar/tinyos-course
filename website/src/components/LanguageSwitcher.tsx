import { useLocale, type Locale } from "../i18n";

const LOCALES: { key: Locale; labelKey: string }[] = [
  { key: "zh-CN", labelKey: "lang.zhCN" },
  { key: "zh-TW", labelKey: "lang.zhTW" },
  { key: "en", labelKey: "lang.en" },
];

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div style={{
      display: "inline-flex",
      gap: 2,
      padding: 2,
      background: "rgba(228,228,231,0.06)",
      border: "1px solid rgba(228,228,231,0.08)",
      borderRadius: 6,
    }}>
      {LOCALES.map(({ key, labelKey }) => {
        const isActive = locale === key;
        return (
          <button
            key={key}
            onClick={() => setLocale(key)}
            style={{
              padding: "4px 10px",
              background: isActive ? "rgba(228,228,231,0.12)" : "transparent",
              border: "1px solid",
              borderColor: isActive ? "rgba(228,228,231,0.15)" : "transparent",
              borderRadius: 4,
              color: isActive ? "#E4E4E7" : "#52525B",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
              transition: "all 0.2s",
              lineHeight: 1.4,
            }}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
