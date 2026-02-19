import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Img,
  staticFile,
} from "remotion";

// ─── Design tokens ───────────────────────────────────────
const INDIGO = "#6366f1";
const INDIGO_DARK = "#4f46e5";
const INDIGO_LIGHT = "#818cf8";
const PURPLE = "#8b5cf6";
const BLUE = "#3b82f6";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// ─── Scene layout (30 fps × 30 s = 900 frames) ──────────
//
//  HOOK        0-90      "What if your files could think?"
//  PROBLEM     75-180    "You juggle 5 tools…"
//  REVEAL      165-360   Logo + Life Dashboard screenshot
//  VIEWS       345-510   Reading Board screenshot
//  PRO         495-660   Company Dashboard screenshot
//  CUSTOM      645-790   OKR Tracker screenshot
//  CTA         775-900   "Describe it. The AI builds it."
//
// 15-frame overlaps give smooth cross-fades between every scene.

const S = {
  HOOK:    { start: 0,   dur: 90  },
  PROBLEM: { start: 75,  dur: 105 },
  REVEAL:  { start: 165, dur: 195 },
  VIEWS:   { start: 345, dur: 165 },
  PRO:     { start: 495, dur: 165 },
  CUSTOM:  { start: 645, dur: 145 },
  CTA:     { start: 775, dur: 125 },
};

// ─── Helpers ─────────────────────────────────────────────

const FADE_IN = 25;
const FADE_OUT = 25;

/** 0→1 over first FADE_IN frames, 1→0 over last FADE_OUT frames */
function useSceneOpacity() {
  const frame = useCurrentFrame();
  const { durationInFrames: dur } = useVideoConfig();
  const inn = interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [dur - FADE_OUT, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return Math.min(inn, out);
}

// ─── Dark text-only scene ────────────────────────────────

function DarkTextScene({
  lines,
  highlight,
}: {
  lines: string[];
  highlight?: string;
}) {
  const frame = useCurrentFrame();
  const opacity = useSceneOpacity();

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, ${INDIGO_DARK} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity,
      }}
    >
      {/* subtle floating orbs */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 500 + i * 200,
            height: 500 + i * 200,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${i === 0 ? INDIGO_LIGHT : PURPLE}18 0%, transparent 70%)`,
            left: i === 0 ? -100 : 1100,
            top: i === 0 ? -50 : 300,
            filter: "blur(80px)",
          }}
        />
      ))}

      {lines.map((line, i) => {
        const delay = i * 18;
        const lineOpacity = interpolate(frame - delay, [0, 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const lineY = interpolate(frame - delay, [0, 22], [18, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const isHighlight = highlight && line === highlight;

        return (
          <div
            key={i}
            style={{
              opacity: lineOpacity,
              transform: `translateY(${lineY}px)`,
              fontSize: isHighlight ? 52 : 36,
              fontWeight: isHighlight ? 800 : 500,
              color: isHighlight ? "#fff" : "rgba(255,255,255,0.55)",
              textAlign: "center",
              lineHeight: 1.4,
              maxWidth: 900,
              marginBottom: isHighlight ? 0 : 4,
            }}
          >
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

// ─── Screenshot scene with heading ───────────────────────

function ScreenshotScene({
  imageSrc,
  tag,
  headline,
  tagColor,
  bg,
}: {
  imageSrc: string;
  tag: string;
  headline: string;
  tagColor: string;
  bg: string;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const opacity = useSceneOpacity();

  // text slides up
  const textY = interpolate(frame, [0, 35], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const textAlpha = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // screenshot springs in gently, then slow-zooms
  const imgSpring = spring({ fps, frame: frame - 12, config: { damping: 22, mass: 1.6, stiffness: 70 } });
  const zoom = interpolate(frame, [25, dur], [1, 1.025], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity,
      }}
    >
      {/* tag pill */}
      <div
        style={{
          opacity: textAlpha,
          transform: `translateY(${textY}px)`,
          fontSize: 13,
          fontWeight: 700,
          color: tagColor,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {tag}
      </div>

      {/* headline */}
      <div
        style={{
          opacity: textAlpha,
          transform: `translateY(${textY}px)`,
          fontSize: 38,
          fontWeight: 700,
          color: "#111827",
          marginBottom: 36,
          textAlign: "center",
          maxWidth: 750,
          lineHeight: 1.25,
        }}
      >
        {headline}
      </div>

      {/* screenshot */}
      <div
        style={{
          transform: `scale(${Math.min(imgSpring, 1) * zoom})`,
          width: 1380,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 20px 70px rgba(0,0,0,0.10), 0 2px 12px rgba(0,0,0,0.05)",
          border: "1px solid #e5e7eb",
        }}
      >
        <Img
          src={staticFile(imageSrc)}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ─── Reveal scene (logo + first screenshot) ──────────────

function RevealScene() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: dur } = useVideoConfig();
  const opacity = useSceneOpacity();

  // Phase 1: logo + name (frames 0-70)
  const logoScale = spring({ fps, frame, config: { damping: 16, mass: 1.1 } });
  const nameAlpha = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const nameY = interpolate(frame, [15, 45], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagAlpha = interpolate(frame, [35, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 2: text moves up, screenshot fades in (frames 60+)
  const topShift = interpolate(frame, [60, 90], [0, -200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imgAlpha = interpolate(frame, [75, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imgSpring = spring({ fps, frame: frame - 80, config: { damping: 22, mass: 1.5, stiffness: 70 } });
  const zoom = interpolate(frame, [90, dur], [1, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, ${INDIGO_DARK} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity,
        overflow: "hidden",
      }}
    >
      {/* Orbs */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 350 + i * 120,
            height: 350 + i * 120,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${[INDIGO_LIGHT, PURPLE, BLUE][i]}20 0%, transparent 70%)`,
            left: [100, 900, 1400][i],
            top: [50, 500, 150][i],
            filter: "blur(60px)",
          }}
        />
      ))}

      {/* Logo + text group */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${topShift}px)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            transform: `scale(${Math.min(logoScale, 1)})`,
            width: 88,
            height: 88,
            borderRadius: 22,
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>P</div>
        </div>

        <div
          style={{
            opacity: nameAlpha,
            transform: `translateY(${nameY}px)`,
            fontSize: 62,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: -1.5,
          }}
        >
          Plainer
        </div>

        <div
          style={{
            opacity: tagAlpha,
            fontSize: 22,
            color: "rgba(255,255,255,0.55)",
            marginTop: 10,
            fontWeight: 500,
          }}
        >
          Your AI-Powered Drive
        </div>
      </div>

      {/* Screenshot slides up from below */}
      <div
        style={{
          opacity: imgAlpha,
          transform: `scale(${Math.min(imgSpring, 1) * zoom}) translateY(${interpolate(frame, [75, 105], [80, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          width: 1350,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          position: "absolute",
          bottom: frame < 75 ? -700 : undefined,
          top: frame >= 75 ? 440 : undefined,
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("images/life-dashboard.png")}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </div>
    </AbsoluteFill>
  );
}

// ─── CTA Scene ───────────────────────────────────────────

function CTAScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, FADE_IN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const features = [
    { label: "AI-powered files", color: BLUE },
    { label: "Custom views & apps", color: PURPLE },
    { label: "Smart AI agent", color: EMERALD },
    { label: "Multi-view system", color: AMBER },
  ];

  const logoScale = spring({ fps, frame: frame - 5, config: { damping: 18, mass: 1.2 } });
  const pulse = interpolate(frame % 90, [0, 45, 90], [1, 1.02, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, ${INDIGO_DARK} 60%, ${INDIGO} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        opacity: fadeIn,
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 400 + i * 80,
            height: 400 + i * 80,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${[INDIGO_LIGHT, PURPLE, BLUE][i]}20 0%, transparent 70%)`,
            left: [200, 800, 1200][i],
            top: [100, 400, 200][i],
            filter: "blur(60px)",
          }}
        />
      ))}

      <div
        style={{
          transform: `scale(${Math.min(logoScale, 1)})`,
          width: 76,
          height: 76,
          borderRadius: 20,
          background: "rgba(255,255,255,0.14)",
          border: "1px solid rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 26,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 800, color: "#fff" }}>P</div>
      </div>

      <div
        style={{
          opacity: interpolate(frame, [10, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `translateY(${interpolate(frame, [10, 35], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)`,
          fontSize: 48,
          fontWeight: 800,
          color: "#fff",
          letterSpacing: -1,
          marginBottom: 12,
        }}
      >
        Describe it. The AI builds it.
      </div>

      <div
        style={{
          opacity: interpolate(frame, [25, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          fontSize: 19,
          color: "rgba(255,255,255,0.5)",
          marginBottom: 44,
        }}
      >
        Your workspace, reimagined
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 50 }}>
        {features.map((f, i) => {
          const s = spring({ fps, frame: frame - (35 + i * 7), config: { damping: 18 } });
          return (
            <div
              key={f.label}
              style={{
                opacity: Math.min(s, 1),
                transform: `translateY(${(1 - Math.min(s, 1)) * 12}px)`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: 4, background: f.color }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{f.label}</span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          opacity: interpolate(frame, [65, 82], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          transform: `scale(${pulse})`,
          padding: "15px 44px",
          borderRadius: 13,
          background: "#fff",
          color: INDIGO_DARK,
          fontSize: 17,
          fontWeight: 700,
          boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
        }}
      >
        Get Started Free
      </div>

      <div
        style={{
          opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          marginTop: 18,
          fontSize: 13,
          color: "rgba(255,255,255,0.35)",
        }}
      >
        plainer.app
      </div>
    </AbsoluteFill>
  );
}

// ─── Main Composition ────────────────────────────────────

export const PlainerDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0f0e2a" }}>
      {/* 1. Hook — big question */}
      <Sequence from={S.HOOK.start} durationInFrames={S.HOOK.dur}>
        <DarkTextScene
          lines={["What if your files", "could think?"]}
          highlight="could think?"
        />
      </Sequence>

      {/* 2. Problem — name the pain */}
      <Sequence from={S.PROBLEM.start} durationInFrames={S.PROBLEM.dur}>
        <DarkTextScene
          lines={[
            "You juggle Drive, Sheets, Notion, and ChatGPT.",
            "What if one workspace did it all?",
          ]}
          highlight="What if one workspace did it all?"
        />
      </Sequence>

      {/* 3. Reveal — logo, name, then first screenshot */}
      <Sequence from={S.REVEAL.start} durationInFrames={S.REVEAL.dur}>
        <RevealScene />
      </Sequence>

      {/* 4. Multi-view — reading board */}
      <Sequence from={S.VIEWS.start} durationInFrames={S.VIEWS.dur}>
        <ScreenshotScene
          imageSrc="images/reading-board.png"
          tag="Multi-View System"
          headline="One file. Table, board, calendar, or custom app."
          tagColor={PURPLE}
          bg="linear-gradient(180deg, #faf5ff 0%, #ede9fe 100%)"
        />
      </Sequence>

      {/* 5. Professional — company dashboard */}
      <Sequence from={S.PRO.start} durationInFrames={S.PRO.dur}>
        <ScreenshotScene
          imageSrc="images/company-dashboard.png"
          tag="Built for Teams"
          headline="KPIs, pipelines, and roadmaps — all in one place."
          tagColor={BLUE}
          bg="linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)"
        />
      </Sequence>

      {/* 6. Custom apps — OKR tracker */}
      <Sequence from={S.CUSTOM.start} durationInFrames={S.CUSTOM.dur}>
        <ScreenshotScene
          imageSrc="images/okr-tracker.png"
          tag="AI-Built Views"
          headline="Describe any visualization. The AI creates it."
          tagColor={AMBER}
          bg="linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%)"
        />
      </Sequence>

      {/* 7. CTA */}
      <Sequence from={S.CTA.start} durationInFrames={S.CTA.dur}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};
