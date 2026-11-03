"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronsDown } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { CinemaProps } from "../inicio/cinema";
import type { LogoSceneHandle } from "./logo-scene";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const DOT = { CRITICO: "#ff6b61", ALTO: "#ffc400", ATENCAO: "#5cc8ff" } as const;

function Glass({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-[22px] border border-white/20 bg-white/10 p-5 text-white shadow-[0_20px_60px_rgba(0,12,40,0.35)] backdrop-blur-md", className)}>{children}</div>;
}

/** Os cinco capítulos de texto. Em 3D cada um cobre a tela e é conduzido pela linha do tempo; na versão estática (`flow`) vira bloco normal. */
function Chapters({ p, refs, flow }: { p: CinemaProps; refs?: React.MutableRefObject<(HTMLDivElement | null)[]>; flow?: boolean }) {
  const set = (i: number) => (el: HTMLDivElement | null) => {
    if (refs) refs.current[i] = el;
  };
  const place = (layout: string) => cn(flow ? "relative" : "absolute inset-0", "flex flex-col", layout);
  const hide = flow ? undefined : { opacity: 0, visibility: "hidden" as const };
  const alertsText = p.alerts.length === 0 ? "Tudo em ordem" : `${p.alerts.length} ${p.alerts.length === 1 ? "ponto pede" : "pontos pedem"} você`;
  const story = p.story;
  return (
    <>
      <div ref={set(0)} className={place("justify-end px-6 pb-[12vh] sm:px-14")}>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">{p.dateLabel}</p>
        <h2 className="mt-3 text-[clamp(52px,9vw,128px)] font-medium leading-[0.95] tracking-[-0.045em] text-white">
          Bom dia,
          <br />
          <span className="sigo-serif text-[1.06em]">{p.firstName}.</span>
        </h2>
        {!flow && (
          <p className="mt-6 flex items-center gap-2 text-[14px] text-[#b9c8e6]">
            <ChevronsDown className="size-4 animate-bounce" /> Role para começar
          </p>
        )}
      </div>

      <div ref={set(1)} style={hide} className={place("justify-center gap-6 px-6 sm:px-14")}>
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

      <div ref={set(2)} style={hide} className={place("items-start justify-end gap-4 px-6 pb-[9vh] sm:items-end sm:px-14")}>
        <div className="sm:text-right">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-[#9db4dc]">{story ? story.dayLabel : "Cada hora conta"}</p>
          <h2 className="mt-2 text-[clamp(40px,6.2vw,84px)] font-medium leading-[1] tracking-[-0.04em] text-white">
            Ontem, <span className="sigo-serif">hora a hora</span>
          </h2>
        </div>
        {story && (
          <p className="text-[15px] text-[#c9d6ee] sm:text-right">
            <span className="text-[34px] font-semibold tracking-[-0.04em] text-white">{story.total}</span> checklists concluídos
            {story.peakHour !== null && ` · pico às ${String(story.peakHour).padStart(2, "0")}h`} · {story.ncsOpened} NC(s) aberta(s)
          </p>
        )}
      </div>

      <div ref={set(3)} style={hide} className={place("items-start justify-center gap-6 px-6 sm:px-14")}>
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

      <div ref={set(4)} style={hide} className={place("items-center justify-end gap-6 px-6 pb-[12vh] text-center")}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%] bg-gradient-to-t from-[#010a1f] via-[#010a1f]/80 to-transparent" aria-hidden />
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

/**
 * Apresentação do SIGO: a logo em 3D conduzida pelo scroll. Uma linha do tempo do GSAP (ScrollTrigger com pin e scrub) controla câmera, peças, luz e textos: rolar para baixo
 * avança, para cima retrocede, e parar mantém o quadro. Sem WebGL ou com "reduzir movimento", vira uma página estática com o mesmo conteúdo.
 */
export function Presentation(props: CinemaProps) {
  const [mode, setMode] = useState<"pending" | "3d" | "static">("pending");
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let webgl = false;
    try {
      const probe = document.createElement("canvas");
      webgl = !!(probe.getContext("webgl2") || probe.getContext("webgl"));
    } catch {
      webgl = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(reduce || !webgl ? "static" : "3d");
  }, []);

  useEffect(() => {
    if (mode !== "3d") return;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    let alive = true;
    let raf = 0;
    let handle: LogoSceneHandle | null = null;
    let ctx: gsap.Context | null = null;
    let visible = true;
    const cleanups: (() => void)[] = [];

    void (async () => {
      const [THREE, sceneMod] = await Promise.all([import("three"), import("./logo-scene")]);
      if (!alive) return;
      try {
        handle = await sceneMod.createLogoScene(THREE, canvas, { logoUrl: "/sigo-logo.png", hours: props.story ? props.story.byHour : null });
      } catch {
        if (alive) setMode("static");
        return;
      }
      if (!alive) {
        handle.dispose();
        return;
      }
      const scene = handle;
      const s = scene.state;
      const fit = () => scene.resize(canvas.clientWidth, canvas.clientHeight);
      fit();
      window.addEventListener("resize", fit);
      cleanups.push(() => window.removeEventListener("resize", fit));
      const io = new IntersectionObserver(([e]) => {
        visible = !!e?.isIntersecting;
      });
      io.observe(stage);
      cleanups.push(() => io.disconnect());

      const ch = chapterRefs.current;
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "power2.inOut" },
          scrollTrigger: { trigger: stage, start: "top top", end: "+=500%", pin: true, scrub: 1.1, anticipatePin: 1, onUpdate: (self) => barRef.current && (barRef.current.style.transform = `scaleX(${self.progress})`) },
        });
        tl.to({}, { duration: 5 }, 0);

        // cena 1: as peças se reúnem na logo
        tl.to(s, { assemble: 1, camZ: 17, camY: 0.2, glow: 1.15, duration: 1, ease: "power1.inOut" }, 0);
        // cena 2: câmera se aproxima e contorna; o anel gira uma volta
        tl.to(s, { camX: -0.6, camY: 0.8, camZ: 16.5, lookX: 0, fov: 30, spin: -0.4, ring: 1, glow: 1.4, logoX: 3.1, logoScale: 0.78, duration: 1 }, 1);
        // cena 3: a logo sobe e as 24 horas do dia anterior crescem como barras
        tl.to(s, { camX: 0, camY: -0.4, camZ: 15.5, lookX: 0, lookY: -0.7, fov: 33, spin: 0, logoY: 2.1, logoX: 0, logoScale: 0.62, bars: 1, glow: 0.95, duration: 1 }, 2);
        // cena 4: vista explodida, camadas separadas em profundidade, câmera orbitando
        tl.to(s, { bars: 0, duration: 0.45 }, 3);
        tl.to(s, { explode: 1, camX: 1.2, camY: 1.1, camZ: 17.5, lookY: 0, logoY: 0, logoX: 3.4, logoScale: 0.75, spin: 0.9, glow: 1.25, fov: 32, duration: 1 }, 3);
        // cena 5: a logo se reúne de novo, a câmera se afasta e amanhece
        tl.to(s, { explode: 0, spin: 0, camX: 0, camY: 0.4, camZ: 21, lookX: 0, lookY: -0.6, fov: 36, logoX: 0, logoY: 5.4, logoScale: 0.85, warm: 1, glow: 1.6, duration: 1 }, 4);

        // textos: cada capítulo entra e sai conforme a linha do tempo
        const win = (el: HTMLDivElement | null, a: number, b: number, hold = false) => {
          if (!el) return;
          tl.fromTo(el, { autoAlpha: 0, y: 36 }, { autoAlpha: 1, y: 0, duration: 0.18, ease: "power2.out" }, a);
          if (!hold) tl.to(el, { autoAlpha: 0, y: -28, duration: 0.18, ease: "power2.in" }, b);
        };
        // abertura já visível no começo
        if (ch[0]) {
          gsap.set(ch[0], { autoAlpha: 1, y: 0 });
          tl.to(ch[0], { autoAlpha: 0, y: -30, duration: 0.2, ease: "power2.in" }, 0.8);
        }
        win(ch[1], 1.08, 1.8);
        win(ch[2], 2.08, 2.8);
        win(ch[3], 3.1, 3.8);
        win(ch[4], 4.3, 5, true);
      }, stage);

      setReady(true);
      // o pin só mede o espaço de rolagem certo depois que o layout assenta: recalcula algumas vezes logo após montar
      [60, 400, 1200, 2500].forEach((ms) => {
        const id = window.setTimeout(() => ScrollTrigger.refresh(), ms);
        cleanups.push(() => window.clearTimeout(id));
      });
      const t0 = performance.now();
      const loop = () => {
        if (!alive) return;
        if (visible && !document.hidden) scene.frame((performance.now() - t0) / 1000);
        raf = requestAnimationFrame(loop);
      };
      loop();
    })();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      cleanups.forEach((c) => c());
      ctx?.revert();
      handle?.dispose();
    };
    // a história do dia só muda com a página; não recria a cena por causa dela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (mode === "static") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(1200px_600px_at_80%_-10%,#0b3a8f,transparent),linear-gradient(180deg,#001840,#02112e)]">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-24 px-6 py-28 sm:px-12">
          <Chapters p={props} flow />
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative bg-[#010a1f]">
      <div ref={stageRef} className="relative h-screen w-full overflow-hidden bg-[#010a1f]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(1,8,26,0.75))]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(1,8,26,0.55),rgba(1,8,26,0.05)_55%,rgba(1,8,26,0.25))]" aria-hidden />
        <Chapters p={props} refs={chapterRefs} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-white/10" aria-hidden>
          <div ref={barRef} className="h-full origin-left bg-gradient-to-r from-[#0068d8] to-[#00d8f0]" style={{ transform: "scaleX(0)" }} />
        </div>
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-[#010a1f] text-[13px] font-medium uppercase tracking-[0.2em] text-[#9db4dc]">Preparando a apresentação…</div>
        )}
      </div>
    </div>
  );
}
