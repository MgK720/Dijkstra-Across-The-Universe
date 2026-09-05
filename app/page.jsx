'use client';
import {
  Orbit,
  ArrowUpRight,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Plus,
  Minus,
  Maximize,
  RefreshCw,
  Layers,
  Activity,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { distance } from '../src/simulation/universe.js';
import { useSimulation, stages } from '../src/simulation/useSimulation.js';
import {
  SystemDetails,
  UtilityControls,
  RouteResult,
  fmt,
} from '../src/ui/Details.jsx';

export default function Home() {
  'use no memo'; // This view intentionally reads the imperative engine at committed-step ticks.
  const sim = useSimulation();
  const {
    host,
    galaxy,
    engine,
    universe,
    running,
    network,
    setNetwork,
    xray,
    setXray,
    costField,
    setCostField,
    setSelected,
    speed,
    setSpeed,
    mode,
    changeMode,
    complete,
    seed,
    telemetry,
    generation,
    showUI,
    reset,
    step,
    play,
    newUniverse,
  } = sim;
  const e = engine.current,
    target = universe?.nodes[e?.target],
    start = universe?.nodes[e?.start],
    bestPlanet = target?.planets.reduce((a, b) =>
      a.similarity > b.similarity ? a : b,
    ),
    custom = universe && (e.start !== 0 || e.target !== universe.target);
  const stateLabel = complete
    ? 'MISSION COMPLETE'
    : e?.found
      ? 'RECONSTRUCTING'
      : running
        ? 'SEARCH IN PROGRESS'
        : e?.steps
          ? 'SEARCH PAUSED'
          : 'MISSION READY';
  return (
    <main className={'observatory ' + (!showUI ? 'immersive' : '')}>
      <div
        className="space"
        ref={host}
        aria-label="Interactive 3D galaxy. Drag to orbit, scroll to zoom, click a network star to inspect."
      />
      <div className="vignette" />
      <header className="masthead ui">
        <div className="brand">
          <Orbit size={30} />
          <div>
            <h1>
              DIJKSTRA <span>ACROSS THE UNIVERSE</span>
            </h1>
            <p>INTERSTELLAR PATHFINDING OBSERVATORY</p>
          </div>
        </div>
        <div className="header-right">
          <span className="live-dot" /> ALL SYSTEMS NOMINAL{' '}
          <button
            className="outline"
            disabled={!!generation || !universe}
            onClick={() => newUniverse()}
          >
            <RefreshCw size={14} /> NEW UNIVERSE
          </button>
        </div>
      </header>
      <div className="top-center ui">
        <Tabs
          value={network ? 'network' : 'realistic'}
          onValueChange={(v) => setNetwork(v === 'network')}
        >
          <TabsList aria-label="Galaxy rendering">
            <TabsTrigger value="realistic">REALISTIC</TabsTrigger>
            <TabsTrigger value="network">NETWORK</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <aside className="mission panel ui">
        <div className="mission-content">
          <div className="eyebrow">
            <span className="live-dot" /> {stateLabel}
          </div>
          <h2>
            A new world.
            <br />
            <em>A way to get there.</em>
          </h2>
          <div className="itinerary">
            <div>
              <i className="source-dot" />
              <span>DEPARTURE</span>
              <button
                className="system-link"
                onClick={() => setSelected(e.start)}
                disabled={!universe}
              >
                {start?.name === 'Sol' ? 'Earth' : start?.name || 'Earth'}
                <ArrowUpRight size={15} />
              </button>
              <p>
                {start?.name === 'Sol'
                  ? 'SOL SYSTEM · ORIGIN'
                  : 'CUSTOM START SYSTEM'}
              </p>
            </div>
            <div>
              <i className="target-dot" />
              <span>{custom ? 'DESTINATION' : 'EARTH-LIKE DESTINATION'}</span>
              <button
                className="system-link"
                disabled={!universe}
                onClick={() => setSelected(e.target)}
              >
                {target?.name || 'Locating world'} {bestPlanet?.name}
                <ArrowUpRight size={15} />
              </button>
              <p>
                {custom ? 'SANDBOX MISSION' : 'NEAREST REACHABLE CANDIDATE'}
              </p>
            </div>
          </div>
          <div className="mission-numbers">
            <div>
              <span>TARGET DISTANCE</span>
              <strong>
                {target
                  ? Math.round(distance(start, target) * 10).toLocaleString(
                      'en-US',
                    )
                  : '—'}{' '}
                <small>ly</small>
              </strong>
            </div>
            <div>
              <span>EARTH SIMILARITY</span>
              <strong className="mint">
                {target ? (target.similarity * 100).toFixed(1) : '—'}
                <small>%</small>
              </strong>
            </div>
          </div>
          <p className="mission-note">
            Space gives us the destination.
            <br />
            Dijkstra finds the best way through.
          </p>
          <div className="section-label">ROUTE OPTIMIZATION</div>
          <Tabs value={mode} onValueChange={changeMode}>
            <TabsList className="cost-tabs" aria-label="Route optimization">
              <TabsTrigger value="fastest" title="Fastest route">
                Fastest
              </TabsTrigger>
              <TabsTrigger value="safest" title="Safest route">
                Safest
              </TabsTrigger>
              <TabsTrigger value="energy" title="Lowest energy">
                Energy
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mission-action">
          <button
            className="begin"
            disabled={e?.done || !universe || !!generation}
            onClick={play}
          >
            {running ? <Pause size={16} /> : <Play size={16} />}{' '}
            {e?.done
              ? 'ROUTE DISCOVERED'
              : running
                ? 'PAUSE SEARCH'
                : e?.steps
                  ? 'RESUME DIJKSTRA'
                  : 'BEGIN DIJKSTRA'}{' '}
            <ChevronRight size={16} />
          </button>
          <div className="mission-footer">
            <span className="live-dot" /> CONNECTED{' '}
            <span>{universe?.nodes.length || 0} SYSTEMS</span>
          </div>
        </div>
      </aside>
      <aside className={'core panel ui ' + (complete ? 'core-complete' : '')}>
        <div className="section-label">
          <Activity size={14} /> DIJKSTRA CORE{' '}
          <span className="mint">LIVE</span>
        </div>
        <div className="current">
          <span>CURRENT SYSTEM</span>
          <strong>
            {e?.current >= 0
              ? universe.nodes[e.current].name
              : 'Awaiting departure'}
          </strong>
          <small>
            {e?.steps ? 'SETTLED · OPTIMAL COST PROVEN' : 'READY TO EXPLORE'}
          </small>
        </div>
        <div className="core-grid">
          {[
            ['VISITED', e?.visited || 0],
            ['FRONTIER', e?.frontier || 0],
            ['RELAXATIONS', e?.relaxations || 0],
            ['CURRENT COST', e?.current >= 0 ? fmt(e.dist[e.current]) : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="exploration-bar">
          <i
            style={{
              width: `${universe ? (e.visited / universe.nodes.length) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="tiny spread">
          <span>NETWORK EXPLORED</span>
          <span>
            {universe
              ? ((e.visited / universe.nodes.length) * 100).toFixed(1)
              : '0.0'}
            %
          </span>
        </div>
        <div className="core-meta">
          <div>
            <span>CURRENT STEP</span>
            <b data-testid="step-count">{e?.steps || 0}</b>
          </div>
          <div>
            <span>
              QUEUE SIZE <small>(incl. stale)</small>
            </span>
            <b>{e?.heap.size || 0}</b>
          </div>
          <div>
            <span>BEST TARGET COST</span>
            <b>{e ? fmt(e.dist[e.target]) : '∞'}</b>
          </div>
          <div>
            <span>ALGORITHM CPU TIME</span>
            <b>{e ? e.elapsed.toFixed(2) : '0.00'} ms</b>
          </div>
        </div>
        <div className="queue-title">
          NEXT SYSTEMS <span>MIN-PRIORITY</span>
        </div>
        <div className="queue-head">
          <span>SYSTEM / PREDECESSOR</span>
          <span>COST</span>
        </div>
        {e?.next(4).map((n, i) => (
          <button
            className="queue-row"
            key={n.id}
            onClick={() => setSelected(n.id)}
          >
            <span>
              <small>0{i + 1}</small>
              {universe.nodes[n.id].name}
              <em>
                ←{' '}
                {n.predecessor < 0
                  ? 'ORIGIN'
                  : universe.nodes[n.predecessor].name}
              </em>
            </span>
            <span>{fmt(n.cost)}</span>
          </button>
        ))}
        {!e?.steps && (
          <p className="queue-empty">The next frontier begins at Earth.</p>
        )}
        {e?.events.some((ev) => ev.improved) && !complete && (
          <div className="relax-event">
            <span className="live-dot" /> FOUND BETTER PATH{' '}
            <b>{e.events.filter((ev) => ev.improved).length} updates</b>
          </div>
        )}
      </aside>
      {!complete && !e?.found && (
        <div className="scene-caption ui">
          <span>SECTOR MAP / {telemetry.view} VIEW</span>
          <h2>
            The universe is a graph.
            <br />
            <em>Every journey, a question.</em>
          </h2>
        </div>
      )}
      <div className="layer-controls panel ui">
        <div>
          <Layers size={14} />
          <span>PATHFINDING X-RAY</span>
          <Switch
            aria-label="Pathfinding X-ray"
            checked={xray}
            onCheckedChange={setXray}
          />
        </div>
        <div>
          <Activity size={14} />
          <span>COST FIELD</span>
          <Switch
            aria-label="Cost field"
            checked={costField}
            onCheckedChange={setCostField}
          />
        </div>
        <UtilityControls sim={sim} />
      </div>
      <div className="camera-controls ui">
        <button
          title="Zoom in"
          aria-label="Zoom in"
          disabled={!universe}
          onClick={() => sim.zoom(0.8)}
        >
          <Plus size={17} />
        </button>
        <button
          title="Zoom out"
          aria-label="Zoom out"
          disabled={!universe}
          onClick={() => sim.zoom(1.2)}
        >
          <Minus size={17} />
        </button>
        <button
          title="Galactic view · G"
          aria-label="Galactic view"
          disabled={!universe}
          onClick={() => galaxy.current.home()}
        >
          <Maximize size={17} />
        </button>
      </div>
      <div className="bottom-dock panel ui">
        <div className="playback">
          <button
            title="Settle one node and relax its neighbours"
            disabled={!e || e.done || running || !!generation}
            onClick={step}
          >
            <SkipForward size={18} /> <span>STEP</span>
          </button>
          <button disabled={!e || !!generation} onClick={() => reset()}>
            <RotateCcw size={16} /> <span>RESET ALGORITHM</span>
          </button>
        </div>
        <div className="speed">
          <span>SPEED</span>
          {['0.25', '0.5', '1', '2', '5', '20', 'warp'].map((v) => (
            <button
              aria-pressed={speed === v}
              className={speed === v ? 'active' : ''}
              onClick={() => setSpeed(v)}
              key={v}
            >
              {v === 'warp' ? 'WARP' : v + '×'}
            </button>
          ))}
        </div>
        <div className="legend">
          <span>
            <i className="unvisited" />
            UNVISITED
          </span>
          <span>
            <i className="frontier" />
            FRONTIER
          </span>
          <span>
            <i className="current-node" />
            CURRENT
          </span>
          <span>
            <i className="visited" />
            VISITED
          </span>
          <span>
            <i className="final" />
            FINAL PATH
          </span>
        </div>
      </div>
      <footer className="statusbar ui">
        <span>
          UNIVERSE SEED <b data-testid="seed">{seed}</b>
        </span>
        <span>
          {universe?.stars.length.toLocaleString('en-US') || '12,000'} STARS{' '}
          <i /> {universe?.edges.length.toLocaleString('en-US') || '—'} TRANSIT
          LANES <i /> SIMULATED COSMOS
        </span>
        <span>
          {telemetry.fps} FPS <i /> {telemetry.drawCalls} DRAWS{' '}
          <span className="live-dot" />
        </span>
      </footer>
      <div className="ui">
        <RouteResult sim={sim} />
      </div>
      <SystemDetails sim={sim} />
      {!showUI && (
        <button className="show-ui outline" onClick={() => sim.setShowUI(true)}>
          <Eye size={15} /> SHOW CONTROLS · H
        </button>
      )}
      <div className="camera-hint ui">
        DRAG TO ORBIT · SCROLL TO EXPLORE · CLICK A SYSTEM
      </div>
      {generation && (
        <output className="generation" aria-live="polite">
          <Orbit size={52} />
          <span>GENERATING UNIVERSE</span>
          <h2>SEED {generation.seed}</h2>
          <div>
            {stages.map((stage, i) => (
              <p
                key={stage}
                className={
                  i === generation.stage
                    ? 'active'
                    : i < generation.stage
                      ? 'finished'
                      : ''
                }
              >
                <span>
                  {i < generation.stage ? '✓' : String(i + 1).padStart(2, '0')}
                </span>
                {stage}
              </p>
            ))}
          </div>
          <div className="generation-bar">
            <i
              style={{
                width: ((generation.stage + 1) / stages.length) * 100 + '%',
              }}
            />
          </div>
        </output>
      )}
      {sim.error && (
        <div className="error panel" role="alert">
          <p>{sim.error}</p>
          <button className="outline" onClick={() => sim.setError('')}>
            DISMISS
          </button>
        </div>
      )}
    </main>
  );
}
