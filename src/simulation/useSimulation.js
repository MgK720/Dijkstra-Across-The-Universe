'use client';
import { useEffect, useRef, useState } from 'react';
import { generateUniverse, freshSeed } from './universe.js';
import { Dijkstra } from './dijkstra.js';
import { Galaxy } from '../rendering/Galaxy.js';
import { ObservatoryAudio } from './audio.js';
export const stages = [
  'FORMING STELLAR REGIONS',
  'CREATING TRANSIT NETWORK',
  'GENERATING PLANETARY SYSTEMS',
  'SEARCHING FOR EARTH-LIKE WORLDS',
  'MISSION READY',
];
export function useSimulation() {
  'use no memo'; // Mutable external simulation is synchronized by explicit completed-step ticks.
  const host = useRef(null),
    galaxy = useRef(null),
    engine = useRef(null),
    audio = useRef(null),
    generationToken = useRef(0),
    generationLifecycle = useRef(null),
    commands = useRef({});
  const [universe, setUniverse] = useState(null),
    [tick, setTick] = useState(0),
    [running, setRunning] = useState(false),
    [network, setNetwork] = useState(true),
    [xray, setXray] = useState(false),
    [costField, setCostField] = useState(false),
    [selected, setSelected] = useState(null),
    [speed, setSpeed] = useState('1'),
    [mode, setMode] = useState('fastest'),
    [reveal, setReveal] = useState(0),
    [complete, setComplete] = useState(false),
    [seed, setSeed] = useState(''),
    [telemetry, setTelemetry] = useState({
      fps: 0,
      view: 'GALACTIC',
      drawCalls: 0,
    }),
    [generation, setGeneration] = useState(null),
    [error, setError] = useState(''),
    [sound, setSound] = useState(false),
    [travel, setTravel] = useState(null),
    [showUI, setShowUI] = useState(true);
  const bump = () => setTick((t) => t + 1);
  function reset(
    start = engine.current?.start,
    target = engine.current?.target,
    profile = mode,
  ) {
    if (!universe) return;
    galaxy.current.stopTravel();
    engine.current = new Dijkstra(universe, start, target, profile);
    setRunning(false);
    setReveal(0);
    setComplete(false);
    setTravel(null);
    bump();
  }
  function changeMode(value) {
    setMode(value);
    reset(engine.current.start, engine.current.target, value);
  }
  function step() {
    if (generation || !engine.current || engine.current.done) return;
    setRunning(false);
    engine.current.step();
    audio.current.tone(180 + (engine.current.current % 18) * 16);
    bump();
  }
  function play() {
    if (!generation && engine.current && !engine.current.done)
      setRunning((v) => !v);
  }
  function changeEndpoints(type, id) {
    if (!Number.isInteger(id) || !universe.nodes[id]) return;
    reset(
      type === 'start' ? id : engine.current.start,
      type === 'target' ? id : engine.current.target,
    );
    setSelected(null);
  }
  async function newUniverse(value) {
    const next = String(value ?? freshSeed())
      .trim()
      .slice(0, 64);
    if (!next || !galaxy.current) return;
    const token = ++generationToken.current;
    setRunning(false);
    setSelected(null);
    setTravel(null);
    galaxy.current.stopTravel();
    setGeneration({ seed: next, stage: 0 });
    audio.current.tone(90, 0.8, 0.03);
    for (let stage = 0; stage < stages.length; stage++) {
      if (
        token !== generationToken.current ||
        generationLifecycle.current?.signal.aborted
      )
        return;
      setGeneration({ seed: next, stage });
      await new Promise((resolve) => setTimeout(resolve, 210));
      if (
        token !== generationToken.current ||
        generationLifecycle.current?.signal.aborted
      )
        return;
      if (stage === 2) {
        try {
          const u = generateUniverse(next);
          engine.current = new Dijkstra(u, 0, u.target, mode);
          galaxy.current.load(u);
          setUniverse(u);
          setSeed(u.seed);
          setReveal(0);
          setComplete(false);
          bump();
        } catch (err) {
          setError(String(err));
          setGeneration(null);
          return;
        }
      }
    }
    if (token === generationToken.current) setGeneration(null);
  }
  useEffect(() => {
    const soundEngine = new ObservatoryAudio();
    audio.current = soundEngine;
    const controller = new AbortController();
    generationLifecycle.current = controller;
    let g;
    const initialization = requestAnimationFrame(() => {
      try {
        g = new Galaxy(host.current, setSelected, setTelemetry);
        galaxy.current = g;
        let lastTravel = 0;
        g.onTravel = (state) => {
          const now = performance.now();
          if (now - lastTravel > 90 || state.finished) {
            setTravel(state.finished ? null : state);
            lastTravel = now;
          }
        };
        const u = generateUniverse(freshSeed());
        setUniverse(u);
        setSeed(u.seed);
        engine.current = new Dijkstra(u);
        g.load(u);
        g.setState(engine.current, {
          network: true,
          xray: false,
          costField: false,
          selected: null,
          reveal: 0,
          complete: false,
        });
      } catch (err) {
        setError(
          'WebGL could not start. Enable hardware acceleration and reload. ' +
            String(err),
        );
      }
    });
    return () => {
      cancelAnimationFrame(initialization);
      controller.abort();
      g?.dispose();
      soundEngine.dispose();
    };
  }, []);
  useEffect(() => {
    if (universe)
      galaxy.current.setState(engine.current, {
        network,
        xray,
        costField,
        selected,
        reveal,
        complete,
      });
  }, [universe, tick, network, xray, costField, selected, reveal, complete]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => {
        const e = engine.current;
        e.run(speed === 'warp' ? 80 : Math.max(1, Number(speed)));
        audio.current.tone(
          180 + (e.current % 18) * 16,
          0.08,
          speed === 'warp' ? 0.008 : 0.014,
        );
        bump();
        if (e.done) setRunning(false);
      },
      speed === 'warp' ? 32 : 120 / Math.min(1, Number(speed)),
    );
    return () => clearInterval(timer);
  }, [running, speed]);
  useEffect(() => {
    if (!engine.current?.found || complete || generation) return;
    const timer = setTimeout(
      () => {
        if (reveal < engine.current.path().length - 1) setReveal((v) => v + 1);
        else {
          setComplete(true);
          audio.current.success();
        }
      },
      reveal === 0 ? 550 : 110,
    );
    return () => clearTimeout(timer);
  }, [tick, reveal, complete, generation]);
  async function toggleSound() {
    try {
      setSound(await audio.current.toggle());
    } catch {
      setError('Audio is unavailable in this browser.');
    }
  }
  function startTravel() {
    galaxy.current.startTravel();
    setTravel({ segment: 0, fraction: 0 });
  }
  function stopTravel() {
    galaxy.current.stopTravel();
    setTravel(null);
  }
  const readState = () => {
    const e = engine.current;
    return e
      ? {
          seed: universe.seed,
          starCount: universe.stars.length,
          nodeCount: universe.nodes.length,
          edgeCount: universe.edges.length,
          start: e.start,
          target: e.target,
          mode: e.mode,
          steps: e.steps,
          visited: e.visited,
          frontier: e.frontier,
          queueSize: e.heap.size,
          relaxations: e.relaxations,
          bestTargetCost: Number.isFinite(e.dist[e.target])
            ? e.dist[e.target]
            : null,
          done: e.done,
          complete,
          route: complete ? e.path() : [],
          running,
          generating: !!generation,
        }
      : null;
  };
  useEffect(() => {
    commands.current = {
      readState,
      step,
      play,
      reset,
      newUniverse,
      changeMode,
      changeEndpoints,
    };
  });
  useEffect(() => {
    const lifecycle = new AbortController(),
      context = document.modelContext;
    if (!context?.registerTool) return;
    const definitions = [
      {
        name: 'read_simulation',
        description: 'Read the current universe and real Dijkstra state.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => commands.current.readState(),
      },
      {
        name: 'step_dijkstra',
        description:
          'Pause playback and settle exactly one cheapest node, relaxing its outgoing edges.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: async () => {
          commands.current.step();
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          return commands.current.readState();
        },
      },
      {
        name: 'generate_universe',
        description:
          'Generate a new universe from a seed and reset the mission. Omit seed for a fresh random universe.',
        inputSchema: {
          type: 'object',
          properties: { seed: { type: 'string', minLength: 1, maxLength: 64 } },
          additionalProperties: false,
        },
        execute: async (input) => {
          if (
            input.seed !== undefined &&
            (typeof input.seed !== 'string' ||
              !input.seed.trim() ||
              input.seed.length > 64)
          )
            throw new Error('Seed must be 1–64 characters.');
          await commands.current.newUniverse(input.seed);
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
          return commands.current.readState();
        },
      },
    ];
    for (const tool of definitions)
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    const key = (e) => {
      if (
        ['INPUT', 'TEXTAREA'].includes(e.target.tagName) ||
        e.target.closest('[role=dialog]')
      )
        return;
      if (e.code === 'Space') {
        e.preventDefault();
        commands.current.play();
      }
      if (e.key.toLowerCase() === 'h') setShowUI((v) => !v);
      if (e.key.toLowerCase() === 'g') galaxy.current?.home();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  function zoom(factor) {
    const g = galaxy.current;
    if (!g) return;
    g.destination = null;
    g.camera.position
      .sub(g.controls.target)
      .multiplyScalar(factor)
      .add(g.controls.target);
  }
  return {
    zoom,
    host,
    galaxy,
    engine,
    universe,
    tick,
    running,
    network,
    setNetwork,
    xray,
    setXray,
    costField,
    setCostField,
    selected,
    setSelected,
    speed,
    setSpeed,
    mode,
    changeMode,
    reveal,
    complete,
    seed,
    telemetry,
    generation,
    error,
    setError,
    sound,
    toggleSound,
    travel,
    startTravel,
    stopTravel,
    showUI,
    setShowUI,
    reset,
    step,
    play,
    newUniverse,
    changeEndpoints,
    readState,
  };
}
