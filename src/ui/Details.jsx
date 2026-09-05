import { useState } from 'react';
import {
  Crosshair,
  Navigation,
  HelpCircle,
  Volume2,
  VolumeX,
  Eye,
  Globe,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { distance } from '../simulation/universe.js';
export const fmt = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString('en-US', { maximumFractionDigits: 1 })
    : '∞';
export function SystemDetails({ sim }) {
  const { universe, engine, selected, setSelected, galaxy, changeEndpoints } =
    sim;
  const n = universe?.nodes[selected],
    e = engine.current;
  return (
    <Sheet
      open={!!n}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    >
      <SheetContent className="system-sheet">
        {n && (
          <>
            <div className="section-label">
              SYSTEM PROFILE / {universe.regions[n.region].name}
            </div>
            <SheetTitle className="system-title">{n.name}</SheetTitle>
            <SheetDescription>
              {n.starType} · Procedural stellar system
            </SheetDescription>
            <div className="profile-stats">
              {[
                [
                  'DISTANCE FROM EARTH',
                  fmt(distance(universe.nodes[0], n) * 10) + ' ly',
                ],
                ['CONNECTED LANES', n.lanes.length],
                [
                  'HABITABILITY',
                  n.habitable ? 'Candidate world' : 'Low suitability',
                ],
                ['EARTH SIMILARITY', fmt(n.similarity * 100) + '%'],
                ['DIJKSTRA COST', fmt(e.dist[n.id])],
                [
                  'PREDECESSOR',
                  e.prev[n.id] < 0 ? '—' : universe.nodes[e.prev[n.id]].name,
                ],
                [
                  'DISCOVERED AT STEP',
                  e.discovered[n.id] < 0 ? '—' : e.discovered[n.id],
                ],
                [
                  'VISITED AT STEP',
                  e.settled[n.id] < 0 ? '—' : e.settled[n.id],
                ],
                [
                  'CURRENT STATUS',
                  n.id === e.current
                    ? 'CURRENT NODE'
                    : ['UNVISITED', 'FRONTIER', 'VISITED'][e.status[n.id]],
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
            <div className="inspector-actions">
              <button
                className="outline"
                onClick={() => {
                  galaxy.current.focus(n.id, true);
                  setSelected(null);
                }}
              >
                <Crosshair size={14} /> FOCUS SYSTEM
              </button>
              <button
                className="outline"
                onClick={() => {
                  galaxy.current.focus(n.id);
                  setSelected(null);
                }}
              >
                REGIONAL VIEW
              </button>
              <button
                className="outline"
                onClick={() => changeEndpoints('start', n.id)}
              >
                SET AS START
              </button>
              <button
                className="outline"
                onClick={() => changeEndpoints('target', n.id)}
              >
                SET AS TARGET
              </button>
            </div>
            <div className="section-label">
              PLANETARY SYSTEM · {n.planets.length} WORLDS
            </div>
            <div className="planet-list">
              <div className="planet-head">
                <span>WORLD</span>
                <span>TEMP.</span>
                <span>SIMILARITY</span>
              </div>
              {n.planets.map((p) => (
                <div key={p.name}>
                  <i
                    style={{
                      background: p.similarity > 0.8 ? '#8bdac6' : '#c1a080',
                      width: 10 + p.radius * 3,
                      height: 10 + p.radius * 3,
                    }}
                  />
                  <span>{n.id === 0 ? p.name : n.name + ' ' + p.name}</span>
                  <span>{Math.round(p.temperature)} K</span>
                  <span className={p.similarity > 0.8 ? 'mint' : ''}>
                    {(p.similarity * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <p className="fineprint">
              Simulated worlds and hypothetical transit lanes. Planet values are
              illustrative, not astronomical observations.
            </p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
export function UtilityControls({ sim }) {
  const [seedOpen, setSeedOpen] = useState(false),
    [help, setHelp] = useState(false),
    [input, setInput] = useState('');
  return (
    <>
      <div className="utilities">
        <button
          title="Reproduce universe from seed"
          onClick={() => {
            setInput(sim.seed);
            setSeedOpen(true);
          }}
        >
          <Globe size={15} />
          <span>SEED</span>
        </button>
        <button
          title={sim.sound ? 'Mute audio' : 'Enable audio'}
          aria-label={sim.sound ? 'Mute audio' : 'Enable audio'}
          onClick={sim.toggleSound}
        >
          {sim.sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button
          title="Hide panels · H"
          aria-label="Hide panels"
          onClick={() => sim.setShowUI(false)}
        >
          <Eye size={15} />
        </button>
        <button
          title="Controls and algorithm guide"
          aria-label="Controls and algorithm guide"
          onClick={() => setHelp(true)}
        >
          <HelpCircle size={15} />
        </button>
      </div>
      <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
        <DialogContent className="observatory-dialog">
          <DialogTitle>Return to a universe</DialogTitle>
          <DialogDescription>
            Identical seeds recreate the same stars, planets, network and
            default mission. A normal refresh always creates a new universe.
          </DialogDescription>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (input.trim()) {
                setSeedOpen(false);
                sim.newUniverse(input.trim());
              }
            }}
          >
            <label htmlFor="universe-seed">UNIVERSE SEED</label>
            <input
              id="universe-seed"
              maxLength={64}
              required
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
            />
            <button className="begin" type="submit">
              GENERATE FROM SEED
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="observatory-dialog guide">
          <DialogTitle>Find your way across the universe</DialogTitle>
          <DialogDescription>
            Every discovery comes from the actual algorithm. Nothing runs until
            you begin or step.
          </DialogDescription>
          <dl>
            <dt>Orbit / pan / zoom</dt>
            <dd>
              Drag to orbit. Right-drag or Shift-drag to pan. Scroll to zoom. On
              touch: one finger orbits, two fingers pan and zoom.
            </dd>
            <dt>Explore a system</dt>
            <dd>
              Click a network star, Earth, the destination, or a queue row.
              Focus reveals its planetary system. Set any network system as your
              start or target.
            </dd>
            <dt>One STEP</dt>
            <dd>
              Remove the cheapest valid queue entry, permanently settle that
              system, then relax every unsettled neighbour. A lower tentative
              cost replaces its predecessor.
            </dd>
            <dt>Why the route is optimal</dt>
            <dd>
              All weights are strictly positive. The target is final only when
              removed as the queue minimum, never when first discovered.
              Reconstruction follows predecessors back to the start.
            </dd>
            <dt>Cost profiles</dt>
            <dd>
              Fastest combines travel time, congestion and stability. Safest
              penalizes risk and instability per distance. Energy combines
              energy demand and gravitational interference. Costs use simulation
              units.
            </dd>
            <dt>Cost field</dt>
            <dd>
              A spatial halo at each discovered node encodes its current cost:
              cool mint is cheaper, amber more expensive. Unsettled values are
              tentative. It is not a physical wavefront.
            </dd>
            <dt>Reset vs new universe</dt>
            <dd>
              Reset preserves the seed, graph and endpoints. New Universe
              replaces the entire simulation. Restore the Earth mission below
              after sandbox exploration.
            </dd>
            <dt>Keyboard</dt>
            <dd>
              Space: pause / resume. G: galactic view. H: hide / show panels.
              Tab navigates controls; Enter activates them.
            </dd>
          </dl>
          <button
            className="outline"
            onClick={() => {
              sim.reset(0, sim.universe.target);
              sim.galaxy.current.home();
              setHelp(false);
            }}
          >
            RESTORE EARTH MISSION
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function RouteResult({ sim }) {
  const {
      engine,
      universe,
      complete,
      reveal,
      travel,
      startTravel,
      stopTravel,
    } = sim,
    e = engine.current;
  if (!e?.found) return null;
  const route = e.path(),
    length = route
      .slice(1)
      .reduce((s, id) => s + universe.edges[e.prevEdge[id]].length, 0);
  const travelled = travel
    ? route
        .slice(1, travel.segment + 1)
        .reduce((s, id) => s + universe.edges[e.prevEdge[id]].length, 0) +
      universe.edges[e.prevEdge[route[travel.segment + 1]]].length *
        travel.fraction
    : 0;
  return (
    <section
      data-testid={complete ? 'route-complete' : 'route-reconstructing'}
      className={'route-result panel ' + (complete ? 'revealed' : '')}
      aria-live="polite"
    >
      <div className="section-label">
        <span className="live-dot" />
        {complete ? 'OPTIMAL ROUTE CONFIRMED' : 'PATH RECONSTRUCTION'}
        <span>
          {complete
            ? sim.mode.toUpperCase()
            : `${reveal} / ${Math.max(0, route.length - 1)} LANES`}
        </span>
      </div>
      <h2>
        {complete ? 'A path through the impossible.' : 'Tracing the way home.'}
      </h2>
      {complete && (
        <>
          <div className="result-grid">
            {[
              ['SYSTEMS', route.length],
              ['NETWORK HOPS', route.length - 1],
              ['TOTAL COST', fmt(e.dist[e.target])],
              ['NETWORK DISTANCE', fmt(length * 10) + ' ly'],
              [
                'DIRECT DISTANCE',
                fmt(
                  distance(universe.nodes[e.start], universe.nodes[e.target]) *
                    10,
                ) + ' ly',
              ],
              ['EDGE RELAXATIONS', e.relaxations],
            ].map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <p>
            Dijkstra explored{' '}
            <b>{((e.visited / universe.nodes.length) * 100).toFixed(1)}%</b> of
            the reachable network ({e.visited} systems) before proving this
            route was optimal.
          </p>
          {travel ? (
            <div className="travel-stats">
              <span>
                SYSTEM {travel.segment + 1} / {route.length}
              </span>
              <strong>
                NEXT · {universe.nodes[route[travel.segment + 1]].name}
              </strong>
              <p>
                {fmt(travelled * 10)} ly travelled ·{' '}
                {
                  universe.regions[universe.nodes[route[travel.segment]].region]
                    .name
                }
              </p>
              <button className="outline" onClick={stopTravel}>
                END TRAVEL
              </button>
            </div>
          ) : (
            <button
              className="begin"
              disabled={route.length < 2}
              onClick={startTravel}
            >
              <Navigation size={15} /> TRAVEL ROUTE
            </button>
          )}
          <details>
            <summary>VIEW ROUTE MANIFEST</summary>
            <ol>
              {route.map((id, i) => (
                <li key={id}>
                  <button onClick={() => sim.setSelected(id)}>
                    <span>
                      {i + 1}. {universe.nodes[id].name}
                    </span>
                    <span>{fmt(e.dist[id])}</span>
                  </button>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}
