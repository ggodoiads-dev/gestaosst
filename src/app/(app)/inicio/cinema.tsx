"use client";

import { Greeting } from "@/components/domain/greeting";
import { greetingNow } from "@/lib/greeting";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronsDown } from "lucide-react";
import type { SceneHandle } from "./cinema-scene";
import { HUBS } from "./cinema-scene";
import { cn } from "@/lib/utils";

export type CinemaProps = {
  firstName: string;
  dateLabel: string;
  alerts: { key: string; title: string; severity: "CRITICO" | "ALTO" | "ATENCAO"; href: string }[];
  kpis: { label: string; value: string; unit?: string; note?: string }[];
  panelHref: string;
  /** O último dia fechado, hora a hora (checklists concluídos e NCs abertas). */
  story: { dayLabel: string; byHour: number[]; total: number; peakHour: number | null; ncsOpened: number } | null;
};

const DOT = { CRITICO: "#ff6b61", ALTO: "#ffc400", ATENCAO: "#5cc8ff" } as const;

/** Janela de cada capítulo (progresso do scroll de 0 a 1). */
const CHAPTERS: { from: number; to: number }[] = [
  { from: 0, to: 0.13 },
  { from: 0.17, to: 0.36 },
  { from: 0.4, to: 0.6 },
  { from: 0.64, to: 0.82 },
  { from: 0.87, to: 1.01 },
];
const FADE = 0.045;

function chapterOpacity(p: number, c: { from: number; to: number }, isFirst: boolean, isLast: boolean) {
  const fadeIn = isFirst ? 1 : Math.min(Math.max((p - c.from) / FADE, 0), 1);
  const fadeOut = isLast ? 1 : Math.min(Math.max((c.to - p) / FADE, 0), 1);
  return Math.min(fadeIn, fadeOut);
}

/** O dia de turno percorre das 5h às 23h conforme o scroll. */
function clockOf(p: number) {
  const minutes = Math.round((5 * 60 + p * 18 * 60) / 5) * 5;
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function Glass({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[22px] border border-white/20 bg-white/10 p-5 text-white shadow-[0_20px_60px_rgba(0,12,40,0.35)] backdrop-blur-md", className)}>{children}</div>;
}

function HourChart({ story }: { story: NonNullable<CinemaProps["story"]> }) {
  const max = Math.max(...story.byHour, 1);
  return (
    <div>
      <div className="flex h-[150px] items-end gap-[3px]">
        {story.byHour.map((v, h) => (
          <div key={h} className="flex h-full flex-1 flex-col items-center justify-end">
            <div
              className={cn("w-full rounded-t-[3px]", h === story.peakHour ? "bg-[#ffc400]" : "bg-white/55")}
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1.5)}%`, opacity: v > 0 ? 1 : 0.25 }}
              title={`${String(h).padStart(2, "0")}h: ${v}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] font-medium tracking-wide text-[#9db4dc]">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
    </div>
  );
}

function Chapters({ p, refs, only }: { p: CinemaProps; refs?: React.MutableRefObject<(HTMLDivElement | null)[]>; only?: number }) {
  const set = (i: number) => (el: HTMLDivElement | null) => {
    if (refs) refs.current[i] = el;
  };
  // Em 3D cada capítulo cobre a tela inteira e entra/sai com o scroll; na versão estática (`only`) é um bloco normal.
  const place = (i: number, layout: string) => cn(only === undefined ? "absolute inset-0" : "relative", "flex flex-col", layout, only !== undefined && only !== i && "hidden");
  const hidden = (i: number) => (only === undefined && i > 0 ? { opacity: 0 } : undefined);
  const alertsText = p.alerts.length === 0 ? "Tudo em ordem" : `${p.alerts.length} ${p.alerts.length === 1 ? "ponto pede" : "pontos pedem"} você`;
  const story = p.story;
  return (
    <>
      <div ref={set(0)} className={place(0, "justify-end px-6 pb-[14vh] sm:px-14")}>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">{p.dateLabel}</p>
        <h2 className="mt-3 text-[clamp(52px,9vw,128px)] font-medium leading-[0.95] tracking-[-0.045em] text-white">
          <Greeting initial={greetingNow()} />,
          <br />
          <span className="sigo-serif text-[1.06em]">{p.firstName}.</span>
        </h2>
        <p className="mt-6 flex items-center gap-2 text-[14px] text-[#b9c8e6]">
          <ChevronsDown className="size-4 animate-bounce" /> Role para viver um dia de turno
        </p>
      </div>

      <div ref={set(1)} style={hidden(1)} className={place(1, "justify-center gap-6 px-6 sm:px-14")}>
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">Agora</p>
          <h2 className="mt-2 max-w-[16ch] text-[clamp(40px,6.2vw,84px)] font-medium leading-[1] tracking-[-0.04em] text-white">{alertsText}</h2>
        </div>
        <div className="flex max-w-[560px] flex-col gap-3">
          {p.alerts.slice(0, 3).map((a) => (
            <Link key={a.key} href={a.href}>
              <Glass className="flex items-center gap-3 py-4 transition-transform hover:-translate-y-0.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: DOT[a.severity] }} />
                <span className="text-[16px] font-medium leading-snug">{a.title}</span>
                <ArrowRight className="ml-auto size-4 shrink-0 text-white/70" />
              </Glass>
            </Link>
          ))}
          {p.alerts.length === 0 && <Glass className="text-[15px] text-white/85">Nenhuma regra de aviso foi disparada agora.</Glass>}
        </div>
      </div>

      <div ref={set(2)} style={hidden(2)} className={place(2, "items-start justify-center gap-6 px-6 sm:items-end sm:px-14")}>
        <div className="sm:text-right">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">{story ? story.dayLabel : "Cada hora conta"}</p>
          <h2 className="mt-2 text-[clamp(40px,6.2vw,84px)] font-medium leading-[1] tracking-[-0.04em] text-white">
            Ontem, <span className="sigo-serif">hora a hora</span>
          </h2>
        </div>
        {story ? (
          <Glass className="w-full max-w-[560px]">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#b9c8e6]">Checklists concluídos</p>
                <p className="mt-1 text-[48px] font-semibold leading-none tracking-[-0.05em]">{story.total}</p>
              </div>
              <div className="text-right text-[13px] text-[#b9c8e6]">
                {story.peakHour !== null && <p>Pico às {String(story.peakHour).padStart(2, "0")}h</p>}
                <p>{story.ncsOpened} NC(s) aberta(s)</p>
              </div>
            </div>
            <HourChart story={story} />
          </Glass>
        ) : (
          <Glass className="max-w-[460px] text-[15px] text-white/85">Aqui aparece o dia anterior, hora a hora, assim que houver checklists concluídos.</Glass>
        )}
      </div>

      <div ref={set(3)} style={hidden(3)} className={place(3, "items-start justify-center gap-6 px-6 sm:px-14")}>
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">Como estamos</p>
          <h2 className="mt-2 text-[clamp(40px,6.2vw,84px)] font-medium leading-[1] tracking-[-0.04em] text-white">
            Os números <span className="sigo-serif">de hoje</span>
          </h2>
        </div>
        <div className="grid w-full max-w-[520px] grid-cols-2 gap-3">
          {p.kpis.slice(0, 4).map((k) => (
            <Glass key={k.label}>
              <p className="text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[#b9c8e6]">{k.label}</p>
              <p className="mt-2 text-[46px] font-semibold leading-none tracking-[-0.05em]">
                {k.value}
                {k.unit && <span className="ml-0.5 text-[20px] font-medium text-[#b9c8e6]">{k.unit}</span>}
              </p>
              {k.note && <p className="mt-2 text-[12.5px] text-[#b9c8e6]">{k.note}</p>}
            </Glass>
          ))}
        </div>
      </div>

      <div ref={set(4)} style={hidden(4)} className={place(4, "items-center justify-end gap-6 px-6 pb-[12vh] text-center")}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-[#010a1f] via-[#010a1f]/85 to-transparent" aria-hidden />
        <div className="relative flex flex-col items-center gap-6">
          <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-[#9db4dc]">Seu turno começa agora</p>
          <h2 className="max-w-[12ch] text-[clamp(52px,9vw,124px)] font-medium leading-[0.96] tracking-[-0.05em] text-white">
            Todo mundo <span className="sigo-serif text-[1.06em]">volta para casa.</span>
          </h2>
          <p className="max-w-[46ch] text-[clamp(15px,1.5vw,19px)] leading-relaxed text-[#c9d6ee]">É por isso que cada checklist, cada aviso e cada número existem. Vamos fazer o dia valer.</p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Link href={p.panelHref} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-[16px] font-semibold text-[#001840] shadow-[0_10px_40px_rgba(103,232,249,0.3)] transition-transform hover:scale-[1.04]">
              Começar o dia <ArrowRight className="size-4" />
            </Link>
            <Link href="/avisos" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-7 py-4 text-[16px] font-medium text-white backdrop-blur hover:bg-white/10">
              Ver o que pede atenção
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

type Plate = { src: string; from: number; to: number };
type SeqManifest = { count: number; width: number; height: number; base: string; ext: string; digits: number };

/** Onde olhar no quadro vertical do vídeo (0 = topo, 1 = base) conforme o progresso: em tela larga só cabe uma faixa horizontal do quadro, e a câmera "desce" por ele. */
const FOCUS: [number, number][] = [
  [0, 0.5],
  [0.28, 0.5],
  [0.42, 0.4],
  [0.62, 0.56],
  [0.8, 0.52],
  [1, 0.7],
];
function focusAt(p: number) {
  for (let i = 1; i < FOCUS.length; i++) {
    if (p <= FOCUS[i][0]) {
      const [p0, f0] = FOCUS[i - 1];
      const [p1, f1] = FOCUS[i];
      const t = (p - p0) / (p1 - p0);
      return f0 + (f1 - f0) * (t * t * (3 - 2 * t));
    }
  }
  return FOCUS[FOCUS.length - 1][1];
}

/** Cor do turno sobre a imagem: amanhecer quente, dia neutro, entardecer alaranjado, noite azul. */
const GRADE: { p: number; rgb: [number, number, number]; a: number }[] = [
  { p: 0, rgb: [255, 170, 100], a: 0.26 },
  { p: 0.25, rgb: [120, 180, 255], a: 0.1 },
  { p: 0.5, rgb: [255, 255, 255], a: 0 },
  { p: 0.75, rgb: [255, 120, 50], a: 0.24 },
  { p: 1, rgb: [10, 26, 92], a: 0.42 },
];
function gradeAt(p: number) {
  for (let i = 1; i < GRADE.length; i++) {
    if (p <= GRADE[i].p) {
      const a = GRADE[i - 1];
      const b = GRADE[i];
      const t = (p - a.p) / (b.p - a.p);
      const m = (x: number, y: number) => Math.round(x + (y - x) * t);
      return `rgba(${m(a.rgb[0], b.rgb[0])}, ${m(a.rgb[1], b.rgb[1])}, ${m(a.rgb[2], b.rgb[2])}, ${(a.a + (b.a - a.a) * t).toFixed(3)})`;
    }
  }
  return "rgba(10, 26, 92, 0.42)";
}

/** Início do visual novo, em tela cheia: o scroll percorre um dia de turno (relógio das 5h às 23h) por uma rede logística em 3D. Fotos opcionais (cenas.json) entram como cenário. Sem WebGL, com "reduzir movimento" ou em aparelho fraco, vira uma página estática com o mesmo conteúdo. */
export function Cinema(props: CinemaProps) {
  const [mode, setMode] = useState<"pending" | "3d" | "seq" | "static">("pending");
  const [seq, setSeq] = useState<SeqManifest | null>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const [plates, setPlates] = useState<Plate[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hubRefs = useRef<(HTMLDivElement | null)[]>([]);
  const plateRefs = useRef<(HTMLImageElement | null)[]>([]);
  const clockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.deviceMemory ?? 8) <= 2 || (navigator.hardwareConcurrency ?? 8) <= 2;
    let webgl = false;
    try {
      const probe = document.createElement("canvas");
      webgl = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      webgl = false;
    }
    // Se a operação tem a sequência de imagens (vídeo da própria operação), ela é o cenário; senão vale a cena 3D.
    void fetch("/inicio/seq/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((m: SeqManifest | null) => {
        const okSeq = !!m && Number.isFinite(m.count) && m.count > 1;
        if (okSeq) setSeq(m);
        setMode(reduce ? "static" : okSeq ? "seq" : weak || !webgl ? "static" : "3d");
      });

    // Cenas opcionais do cliente: /inicio/cenas.json = [{ "src": "/inicio/doca.jpg", "from": 0.2, "to": 0.4 }]
    void fetch("/inicio/cenas.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Plate[]) => setPlates(Array.isArray(list) ? list.filter((x) => typeof x.src === "string").slice(0, 8) : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "3d") return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    let alive = true;
    let handle: SceneHandle | null = null;
    let raf = 0;
    let visible = true;
    let current = 0;
    let cleanup = () => {};

    const progressNow = () => {
      const rect = wrap.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      return Math.min(Math.max(-rect.top / total, 0), 1);
    };

    void (async () => {
      const [THREE, scene] = await Promise.all([import("three"), import("./cinema-scene")]);
      if (!alive) return;
      try {
        handle = await scene.createCinemaScene(THREE, canvas);
      } catch {
        if (alive) setMode("static");
        return;
      }
      const fit = () => handle?.resize(canvas.clientWidth, canvas.clientHeight);
      fit();
      window.addEventListener("resize", fit);
      const io = new IntersectionObserver(([e]) => {
        visible = !!e?.isIntersecting;
      });
      io.observe(wrap);
      const t0 = performance.now();
      const loop = () => {
        if (!alive) return;
        if (visible && !document.hidden) {
          const target = progressNow();
          current += (target - current) * 0.085;
          handle?.frame(current, (performance.now() - t0) / 1000);
          if (clockRef.current) clockRef.current.textContent = clockOf(current);
          const spots = handle?.hubScreen() ?? [];
          hubRefs.current.forEach((el, i) => {
            if (!el) return;
            const sp = spots[i];
            if (!sp) {
              el.style.opacity = "0";
              return;
            }
            el.style.transform = `translate3d(${sp.x}px, ${sp.y}px, 0)`;
            el.style.opacity = String(Math.min(Math.max((110 - sp.depth) / 60, 0), 1) * 0.95 * Math.min(Math.max((0.9 - current) / 0.06, 0), 1));
          });
          CHAPTERS.forEach((c, i) => {
            const el = chapterRefs.current[i];
            if (!el) return;
            const o = chapterOpacity(current, c, i === 0, i === CHAPTERS.length - 1);
            el.style.opacity = String(o);
            el.style.transform = `translateY(${(1 - o) * 26}px)`;
            el.style.pointerEvents = o > 0.6 ? "auto" : "none";
          });
          plateRefs.current.forEach((img, i) => {
            const pl = plates[i];
            if (!img || !pl) return;
            const o = chapterOpacity(current, pl, false, false);
            img.style.opacity = String(o * 0.85);
            img.style.transform = `scale(${1.04 + (current - pl.from) * 0.25})`;
          });
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
      cleanup = () => {
        window.removeEventListener("resize", fit);
        io.disconnect();
      };
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cleanup();
      handle?.dispose();
    };
  }, [mode, plates]);

  useEffect(() => {
    if (mode !== "seq" || !seq) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let alive = true;
    let raf = 0;
    let visible = true;
    let current = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const imgs: (HTMLImageElement | null)[] = Array.from({ length: seq.count }, () => null);
    const url = (i: number) => `${seq.base}${String(i + 1).padStart(seq.digits, "0")}.${seq.ext}`;

    // carrega o primeiro quadro já e o resto em ordem, poucos de cada vez
    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          imgs[i] = im;
          resolve();
        };
        im.onerror = () => resolve();
        im.src = url(i);
      });
    void (async () => {
      await load(0);
      const order = Array.from({ length: seq.count - 1 }, (_, k) => k + 1);
      const workers = Array.from({ length: 4 }, async () => {
        while (alive && order.length) {
          const i = order.shift()!;
          await load(i);
        }
      });
      await Promise.all(workers);
    })();

    const nearest = (i: number) => {
      for (let d = 0; d < seq.count; d++) {
        const a = imgs[i - d];
        if (a) return a;
        const b = imgs[i + d];
        if (b) return b;
      }
      return null;
    };
    const fit = () => {
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
    };
    fit();
    window.addEventListener("resize", fit);
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
    });
    io.observe(wrap);

    const drawFrame = (im: HTMLImageElement, p: number, alpha: number) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const A = cw / ch;
      const zoom = 1 + 0.1 * p;
      let sw: number;
      let sh: number;
      if (A >= seq.width / seq.height) {
        sw = seq.width / zoom;
        sh = sw / A;
      } else {
        sh = seq.height / zoom;
        sw = sh * A;
      }
      const sx = (seq.width - sw) / 2;
      const sy = Math.min(Math.max(focusAt(p) * seq.height - sh / 2, 0), seq.height - sh);
      ctx.globalAlpha = alpha;
      ctx.drawImage(im, sx, sy, sw, sh, 0, 0, cw, ch);
    };

    const progressNow = () => {
      const rect = wrap.getBoundingClientRect();
      const total = Math.max(rect.height - window.innerHeight, 1);
      return Math.min(Math.max(-rect.top / total, 0), 1);
    };
    const loop = () => {
      if (!alive) return;
      if (visible && !document.hidden) {
        current += (progressNow() - current) * 0.12;
        const f = current * (seq.count - 1);
        const i0 = Math.floor(f);
        const a = f - i0;
        const base = nearest(i0);
        if (base) {
          drawFrame(base, current, 1);
          const nxt = i0 + 1 < seq.count ? imgs[i0 + 1] : null;
          if (nxt && a > 0.02) drawFrame(nxt, current, a);
          ctx.globalAlpha = 1;
        }
        if (clockRef.current) clockRef.current.textContent = clockOf(current);
        if (gradeRef.current) gradeRef.current.style.background = gradeAt(current);
        CHAPTERS.forEach((c, i) => {
          const el = chapterRefs.current[i];
          if (!el) return;
          const o = chapterOpacity(current, c, i === 0, i === CHAPTERS.length - 1);
          el.style.opacity = String(o);
          el.style.transform = `translateY(${(1 - o) * 26}px)`;
          el.style.pointerEvents = o > 0.6 ? "auto" : "none";
        });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
      io.disconnect();
    };
  }, [mode, seq]);

  if (mode === "static") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_600px_at_80%_-10%,#0b3a8f,transparent),linear-gradient(180deg,#001840,#02112e)]">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-16 px-6 py-24 sm:px-12">
          {[0, 1, 2, 3, 4].map((i) => (
            <section key={i} className="relative">
              <Chapters p={props} only={i} />
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative" style={{ height: "620vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-[#010a1f]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        {plates.map((pl, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={pl.src}
            ref={(el) => {
              plateRefs.current[i] = el;
            }}
            src={pl.src}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 mix-blend-screen"
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(1,8,26,0.7))]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(1,8,26,0.62),rgba(1,8,26,0.08)_55%,rgba(1,8,26,0.3))]" />
        <div className="pointer-events-none absolute left-6 top-24 z-10 sm:left-14" aria-hidden>
          <div ref={clockRef} className="sigo-mono text-[22px] font-semibold tracking-[0.06em] text-white/90">
            05:00
          </div>
          <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#9db4dc]">Um dia de turno</div>
        </div>
        {mode === "seq" && <div ref={gradeRef} className="pointer-events-none absolute inset-0 mix-blend-soft-light" aria-hidden />}
        {mode === "seq" && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,26,0.35),transparent_30%,transparent_55%,rgba(1,8,26,0.65))]" aria-hidden />}
        {(mode === "3d" ? HUBS : []).map((h, i) => (
          <div
            key={h.name}
            ref={(el) => {
              hubRefs.current[i] = el;
            }}
            className="pointer-events-none absolute left-0 top-0 opacity-0"
            aria-hidden
          >
            <div className="-translate-x-1/2 -translate-y-full">
              <div className="flex items-center gap-2 rounded-full border border-cyan-200/40 bg-[#021436]/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 backdrop-blur">
                <span className="size-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]" />
                {h.name}
              </div>
              <div className="mx-auto h-10 w-px bg-gradient-to-b from-cyan-300/70 to-transparent" />
            </div>
          </div>
        ))}
        <Chapters p={props} refs={chapterRefs} />
      </div>
    </div>
  );
}
