import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { completeWelcome } from "../lib/guest";

type Props = {
  onComplete: () => void;
};

const L1 = "Maria\u2019s Exhibition";
const L2 = "at Rockefeller Center";
const L3 = "May 14th, 2026";

/** Start typewriter this many ms after the photo begins fading in (photo CSS fade ≈ 3800ms). */
const IMAGE_FADE_MS = 3200;
const CHAR_MS = 56;
const LINE_GAP_MS = 440;

function TypeLine({ text, count, className }: { text: string; count: number; className?: string }) {
  const slice = text.slice(0, count);
  return (
    <p className={className}>
      {slice.split("").map((ch, i) => (
        <span key={`${text}-${i}`} className="welcome-char" aria-hidden>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </p>
  );
}

export function WelcomeScreen({ onComplete }: Props) {
  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoVisible, setPhotoVisible] = useState(reduceMotion);
  const [phase, setPhase] = useState<"image" | "l1" | "l2" | "l3" | "done">(reduceMotion ? "done" : "image");
  const [c1, setC1] = useState(reduceMotion ? L1.length : 0);
  const [c2, setC2] = useState(reduceMotion ? L2.length : 0);
  const [c3, setC3] = useState(reduceMotion ? L3.length : 0);
  const [formVisible, setFormVisible] = useState(reduceMotion);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = requestAnimationFrame(() => setPhotoVisible(true));
    return () => cancelAnimationFrame(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    if (!photoVisible) return;
    const id = window.setTimeout(() => setPhase("l1"), IMAGE_FADE_MS);
    return () => window.clearTimeout(id);
  }, [reduceMotion, photoVisible]);

  useEffect(() => {
    if (reduceMotion) return;
    if (phase !== "l1") return;
    if (c1 >= L1.length) {
      const id = window.setTimeout(() => setPhase("l2"), LINE_GAP_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setC1((n) => n + 1), CHAR_MS);
    return () => window.clearTimeout(id);
  }, [reduceMotion, phase, c1]);

  useEffect(() => {
    if (reduceMotion) return;
    if (phase !== "l2") return;
    if (c2 >= L2.length) {
      const id = window.setTimeout(() => setPhase("l3"), LINE_GAP_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setC2((n) => n + 1), CHAR_MS);
    return () => window.clearTimeout(id);
  }, [reduceMotion, phase, c2]);

  useEffect(() => {
    if (reduceMotion) return;
    if (phase !== "l3") return;
    if (c3 >= L3.length) {
      const id = window.setTimeout(() => {
        setPhase("done");
        setFormVisible(true);
      }, LINE_GAP_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setC3((n) => n + 1), CHAR_MS);
    return () => window.clearTimeout(id);
  }, [reduceMotion, phase, c3]);

  useEffect(() => {
    if (!formVisible) return;
    inputRef.current?.focus();
  }, [formVisible]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = completeWelcome(name);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onComplete();
  };

  return (
    <div className={`welcome${reduceMotion ? " welcome--reduced" : ""}`} role="dialog" aria-modal="true" aria-label="Welcome">
      {/* Replace `public/welcome-nyc.jpg` with your own licensed image if needed. */}
      <div className="welcome__base" aria-hidden />
      <img
        className={`welcome__photo${photoVisible ? " welcome__photo--in" : ""}`}
        src="/welcome-nyc.jpg"
        alt=""
        decoding="async"
        fetchPriority="high"
      />

      <div className="welcome__content">
        <div className="welcome__titles" aria-live="polite">
          <span className="sr-only">
            {formVisible ? `${L1}. ${L2}. ${L3}.` : "Event title is appearing."}
          </span>
          <TypeLine text={L1} count={c1} className="welcome__line welcome__line--1" />
          <TypeLine text={L2} count={c2} className="welcome__line welcome__line--2" />
          <TypeLine text={L3} count={c3} className="welcome__line welcome__line--3" />
        </div>

        <div className={`welcome__formShell${formVisible ? " welcome__formShell--in" : ""}`}>
          <h1 className="sr-only">Enter your name to continue</h1>
          <form className="welcome__dock" onSubmit={onSubmit}>
            <div className="welcome__fieldRow">
              <input
                ref={inputRef}
                id="welcome-name"
                className="welcome__input"
                name="name"
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                placeholder="Your name"
                aria-label="Your name"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                maxLength={40}
                required
                minLength={2}
                disabled={!formVisible}
              />
              <button
                type="submit"
                className="welcome__next"
                disabled={!formVisible || name.trim().length < 2}
                aria-label="Continue"
              >
                <svg
                  className="welcome__nextSvg"
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  aria-hidden
                  focusable="false"
                >
                  <path
                    d="M10.5 7.5 L15 12 L10.5 16.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            {error && (
              <p className="welcome__error" role="alert">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
