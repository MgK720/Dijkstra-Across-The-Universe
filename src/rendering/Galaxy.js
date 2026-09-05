import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planetMaterial } from './planetMaterial.js';
const vec = (p) => new THREE.Vector3(p.x, p.y, p.z);
export class Galaxy {
  constructor(element, onSelect, onTelemetry) {
    this.element = element;
    this.onSelect = onSelect;
    this.onTelemetry = onTelemetry;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#03060d');
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 5000);
    this.camera.position.set(0, 365, 550);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    element.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 1400;
    this.controls.addEventListener('start', () => {
      this.destination = null;
    });
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 3;
    this.down = (e) => {
      this.pointerStart = [e.clientX, e.clientY];
    };
    this.click = (e) => {
      if (
        !this.universe ||
        !this.pointerStart ||
        Math.hypot(
          e.clientX - this.pointerStart[0],
          e.clientY - this.pointerStart[1],
        ) > 5
      )
        return;
      const box = element.getBoundingClientRect();
      this.raycaster.params.Points.threshold = Math.max(
        0.8,
        this.camera.position.distanceTo(this.controls.target) * 0.006,
      );
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - box.left) / box.width) * 2 - 1,
          (-(e.clientY - box.top) / box.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = this.raycaster.intersectObject(this.networkStars)[0];
      if (hit) this.onSelect(hit.index);
    };
    element.addEventListener('pointerdown', this.down);
    element.addEventListener('pointerup', this.click);
    this.resize = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(element);
    const epoch = performance.now();
    this.clock = { getElapsedTime: () => (performance.now() - epoch) / 1000 };
    this.frames = 0;
    this.lastSample = 0;
    this.fps = 60;
    this.frame = this.frame.bind(this);
    this.frame();
  }
  points(positions, colors, sizes, glow = 1) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { opacity: { value: 1 }, glow: { value: glow } },
      vertexShader:
        'attribute float size; varying vec3 vColor; void main(){vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(size*430./max(12.,-p.z),1.,65.);gl_Position=projectionMatrix*p;}',
      fragmentShader:
        'varying vec3 vColor;uniform float opacity;uniform float glow;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float a=exp(-d*d*7.)*.8+exp(-d*d*70.);gl_FragColor=vec4(vColor*glow,a*opacity);}',
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(geometry, material);
  }
  load(universe) {
    if (this.world) {
      this.scene.remove(this.world);
      this.disposeGroup(this.world);
    }
    this.markers?.forEach((m) => m.remove());
    this.universe = universe;
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.travel = null;
    this.system = null;
    this.ship = null;
    this.systemId = null;
    this.destination = null;
    this.wasComplete = false;
    this.oldLinks = null;
    this.previousStep = -1;
    this.routeGlow = null;
    this.routeKey = '';
    const positions = [],
      colors = [],
      sizes = [];
    for (const p of universe.stars) {
      positions.push(p.x, p.y, p.z);
      colors.push(
        0.48 + p.warmth * 0.5,
        0.57 + p.warmth * 0.23,
        1 - p.warmth * 0.36,
      );
      sizes.push(p.size * 2);
    }
    this.stars = this.points(positions, colors, sizes, 1.2);
    this.world.add(this.stars);
    const dustP = [],
      dustC = [],
      dustS = [];
    for (let i = 0; i < universe.stars.length; i += 7) {
      const p = universe.stars[i];
      dustP.push(p.x, p.y - 3, p.z);
      dustC.push(
        i < 1800 ? 0.14 : 0.055,
        i < 1800 ? 0.11 : 0.085,
        i < 1800 ? 0.085 : 0.16,
      );
      dustS.push(28 + p.size * 20);
    }
    this.dust = this.points(dustP, dustC, dustS);
    this.world.add(this.dust);
    this.networkStars = this.points(
      universe.nodes.flatMap((p) => [p.x, p.y, p.z]),
      universe.nodes.flatMap(() => [0.4, 0.64, 0.65]),
      universe.nodes.map((n) => (n.hub ? 7 : 4)),
      1.7,
    );
    this.world.add(this.networkStars);
    this.curves = universe.edges.map((e) => {
      const a = vec(universe.nodes[e.a]),
        b = vec(universe.nodes[e.b]),
        mid = a.clone().lerp(b, 0.5);
      mid.y += Math.min(20, e.length * 0.14) + e.bend * e.length * 0.06;
      return new THREE.QuadraticBezierCurve3(a, mid, b);
    });
    const lineP = [];
    this.segments = 12;
    for (const curve of this.curves)
      for (let j = 0; j < this.segments; j++) {
        const a = curve.getPoint(j / this.segments),
          b = curve.getPoint((j + 1) / this.segments);
        lineP.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(lineP, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(new Float32Array(lineP.length), 3),
    );
    this.lanes = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.world.add(this.lanes);
    this.pulses = this.points(
      new Float32Array(64 * 3),
      new Float32Array(64 * 3).fill(0.8),
      new Float32Array(64).fill(7),
    );
    this.pulses.geometry.setDrawRange(0, 0);
    this.world.add(this.pulses);
    this.costCloud = this.points(
      universe.nodes.flatMap((p) => [p.x, p.y, p.z]),
      new Float32Array(universe.nodes.length * 3),
      new Float32Array(universe.nodes.length).fill(48),
    );
    this.costCloud.visible = false;
    this.world.add(this.costCloud);
    this.markers = [];
    for (const type of ['start', 'target']) {
      const el = document.createElement('div');
      el.className = 'star-label ' + type;
      this.element.appendChild(el);
      this.markers.push(el);
    }
    this.home();
  }
  setState(engine, options) {
    this.engine = engine;
    this.options = options;
    this.dirty = true;
  }
  updateColors() {
    if (!this.engine) return;
    const e = this.engine,
      o = this.options,
      route = e.path(),
      pathEdges = new Set();
    for (
      let i = Math.max(1, route.length - (o.reveal || 0));
      i < route.length;
      i++
    )
      pathEdges.add(e.prevEdge[route[i]]);
    this.pathEdges = pathEdges;
    const nodeColors = this.networkStars.geometry.attributes.color,
      nodeSizes = this.networkStars.geometry.attributes.size,
      routeNodes = new Set();
    for (const id of pathEdges) {
      routeNodes.add(this.universe.edges[id].a);
      routeNodes.add(this.universe.edges[id].b);
    }
    const maxCost = Math.max(1, ...Array.from(e.dist).filter(Number.isFinite)),
      costColors = this.costCloud.geometry.attributes.color;
    for (const n of this.universe.nodes) {
      let c = [0.12, 0.24, 0.32],
        size = n.hub ? 8 : 4;
      if (e.status[n.id] === 1) {
        c = [0.18, 0.88, 0.78];
        size = 7;
      }
      if (e.status[n.id] === 2)
        c = o.complete ? [0.08, 0.19, 0.23] : [0.12, 0.46, 0.63];
      if (routeNodes.has(n.id)) {
        c = [1, 0.71, 0.29];
        size = 10;
      }
      if (n.id === e.current) {
        c = [1, 0.96, 0.78];
        size = 15;
      }
      if (n.id === e.start || n.id === e.target) {
        c = n.id === e.start ? [0.4, 1, 0.9] : [1, 0.64, 0.26];
        size = 17;
      }
      if (n.id === o.selected) size += 5;
      nodeColors.setXYZ(n.id, ...c);
      nodeSizes.setX(n.id, size);
      if (Number.isFinite(e.dist[n.id])) {
        const color = new THREE.Color().setHSL(
          0.51 - (e.dist[n.id] / maxCost) * 0.43,
          0.85,
          0.13,
        );
        costColors.setXYZ(n.id, color.r, color.g, color.b);
      } else costColors.setXYZ(n.id, 0, 0, 0);
    }
    nodeColors.needsUpdate = true;
    nodeSizes.needsUpdate = true;
    costColors.needsUpdate = true;
    const lc = this.lanes.geometry.attributes.color,
      active = new Set(e.events.map((x) => x.edge));
    for (const edge of this.universe.edges) {
      let c =
        edge.kind === 'corridor' ? [0.16, 0.24, 0.32] : [0.065, 0.14, 0.19];
      if (e.prevEdge[edge.a] === edge.id || e.prevEdge[edge.b] === edge.id)
        c = o.complete ? [0.025, 0.1, 0.14] : [0.08, 0.38, 0.43];
      if (active.has(edge.id)) c = [0.4, 0.85, 0.7];
      if (pathEdges.has(edge.id)) c = [1, 0.59, 0.17];
      if (
        o.xray &&
        !pathEdges.has(edge.id) &&
        !active.has(edge.id) &&
        e.status[edge.a] === 0 &&
        e.status[edge.b] === 0
      )
        c = [0.012, 0.025, 0.035];
      for (let j = 0; j < this.segments * 2; j++)
        lc.setXYZ(edge.id * this.segments * 2 + j, ...c);
    }
    lc.needsUpdate = true;
    this.costCloud.visible = o.costField;
    if (this.previousStep !== e.steps) {
      this.previousStep = e.steps;
      if (this.oldLinks) {
        this.world.remove(this.oldLinks);
        this.disposeGroup(this.oldLinks);
        this.oldLinks = null;
      }
      const old = e.events.filter((event) => event.old >= 0);
      if (old.length) {
        const positions = [];
        for (const event of old)
          for (let i = 0; i < this.segments; i++) {
            const a = this.curves[event.old].getPoint(i / this.segments),
              b = this.curves[event.old].getPoint((i + 1) / this.segments);
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(positions, 3),
        );
        this.oldLinks = new THREE.LineSegments(
          geometry,
          new THREE.LineBasicMaterial({
            color: 0x73a594,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        this.fadedAt = this.clock.getElapsedTime();
        this.world.add(this.oldLinks);
      }
    }
    this.costCloud.material.uniforms.opacity.value = o.complete ? 0.35 : 1;
    this.rebuildRoute(pathEdges);
    if (o.complete && !this.wasComplete) this.fitRoute(route);
    this.wasComplete = o.complete;
  }
  rebuildRoute(edges) {
    const key = [...edges].join(',');
    if (key === this.routeKey) return;
    this.routeKey = key;
    if (this.routeGlow) {
      this.world.remove(this.routeGlow);
      this.disposeGroup(this.routeGlow);
      this.routeGlow = null;
    }
    if (!edges.size) return;
    this.routeGlow = new THREE.Group();
    for (const [radius, opacity, color] of [
      [0.22, 0.95, 0xffdd9a],
      [0.85, 0.1, 0xffb956],
    ]) {
      const pieces = [...edges].map(
        (id) => new THREE.TubeGeometry(this.curves[id], 24, radius, 6, false),
      );
      const geometry = mergeGeometries(pieces);
      pieces.forEach((g) => g.dispose());
      this.routeGlow.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
    }
    this.world.add(this.routeGlow);
  }
  home() {
    this.hideSystem();
    this.destination = {
      target: new THREE.Vector3(),
      position: new THREE.Vector3(0, 365, 550),
    };
  }
  focus(id, system = false) {
    this.hideSystem();
    const p = vec(this.universe.nodes[id]);
    this.destination = {
      target: p,
      position: p
        .clone()
        .add(new THREE.Vector3(0, system ? 20 : 90, system ? 38 : 135)),
    };
    if (system) this.showSystem(id);
  }
  fitRoute(route) {
    if (!route.length) return;
    const box = new THREE.Box3().setFromPoints(
        route.map((id) => vec(this.universe.nodes[id])),
      ),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()).length();
    this.destination = {
      target: center,
      position: center
        .clone()
        .add(
          new THREE.Vector3(
            0,
            Math.max(120, size * 0.8),
            Math.max(180, size * 1.1),
          ),
        ),
    };
  }
  hideSystem() {
    if (this.system) {
      this.world.remove(this.system);
      this.disposeGroup(this.system);
      this.system = null;
    }
    this.systemId = null;
    for (const object of [
      this.stars,
      this.dust,
      this.networkStars,
      this.lanes,
      this.pulses,
      this.routeGlow,
    ])
      if (object) object.visible = true;
    if (this.costCloud) this.costCloud.visible = !!this.options?.costField;
  }
  showSystem(id) {
    for (const object of [
      this.stars,
      this.dust,
      this.networkStars,
      this.lanes,
      this.pulses,
      this.routeGlow,
      this.costCloud,
    ])
      if (object) object.visible = false;
    this.systemId = id;
    const n = this.universe.nodes[id];
    this.system = new THREE.Group();
    this.system.position.copy(vec(n));
    this.world.add(this.system);
    this.system.add(this.points([0, 0, 0], [1, 0.82, 0.48], [6]));
    this.planetMeshes = [];
    n.planets.forEach((p, i) => {
      const radius = 3 + i * 2,
        points = Array.from(
          { length: 97 },
          (_, k) =>
            new THREE.Vector3(
              Math.cos((k / 96) * Math.PI * 2) * radius,
              0,
              Math.sin((k / 96) * Math.PI * 2) * radius,
            ),
        );
      this.system.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(points),
          new THREE.LineBasicMaterial({
            color: 0x43656c,
            transparent: true,
            opacity: 0.4,
          }),
        ),
      );
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(0.25 + p.radius * 0.18, 32, 24),
        planetMaterial(p),
      );
      this.system.add(planet);
      this.planetMeshes.push({ mesh: planet, radius, phase: p.phase });
    });
  }
  startTravel() {
    const route = this.engine.path();
    if (route.length < 2) return;
    this.hideSystem();
    this.destination = null;
    this.travel = { route, started: this.clock.getElapsedTime(), segment: 0 };
  }
  stopTravel() {
    this.travel = null;
    if (this.ship) this.ship.visible = false;
    this.fitRoute(this.engine.path());
  }
  frame() {
    this.raf = requestAnimationFrame(() => this.frame());
    const time = this.clock.getElapsedTime();
    this.frames++;
    if (this.oldLinks)
      this.oldLinks.material.opacity = Math.max(
        0,
        0.5 * (1 - (time - this.fadedAt) / 0.7),
      );
    if (time - this.lastSample > 1) {
      this.fps = Math.round(this.frames / (time - this.lastSample));
      this.frames = 0;
      this.lastSample = time;
      this.onTelemetry?.({
        fps: this.fps,
        drawCalls: this.renderer.info.render.calls,
        view:
          this.systemId !== null
            ? 'STAR SYSTEM'
            : this.camera.position.distanceTo(this.controls.target) < 280
              ? 'REGIONAL'
              : 'GALACTIC',
      });
    }
    if (this.universe && this.engine) {
      if (this.dirty) {
        this.updateColors();
        this.dirty = false;
      }
      const o = this.options,
        e = this.engine;
      this.stars.material.uniforms.opacity.value +=
        ((o.xray ? 0.12 : 1) - this.stars.material.uniforms.opacity.value) *
        0.05;
      this.dust.material.uniforms.opacity.value +=
        ((o.xray ? 0.08 : 0.7) - this.dust.material.uniforms.opacity.value) *
        0.05;
      this.lanes.material.opacity +=
        ((o.network ? 0.42 : 0.07) - this.lanes.material.opacity) * 0.06;
      if (this.system) {
        this.stars.material.uniforms.opacity.value = 0.15;
        this.planetMeshes.forEach((p, i) =>
          p.mesh.position.set(
            Math.cos((time * 0.05) / (i + 1) + p.phase) * p.radius,
            0,
            Math.sin((time * 0.05) / (i + 1) + p.phase) * p.radius,
          ),
        );
      }
      const active = o.complete
          ? [...this.pathEdges]
          : e.events.map((x) => x.edge),
        pp = this.pulses.geometry.attributes.position,
        pc = this.pulses.geometry.attributes.color,
        count = Math.min(64, active.length);
      for (let i = 0; i < count; i++) {
        const edge = this.universe.edges[active[i]],
          fraction = (time * 0.45 + i * 0.13) % 1;
        const point = this.curves[active[i]].getPoint(
          e.prev[edge.b] === edge.a ? fraction : 1 - fraction,
        );
        pp.setXYZ(i, point.x, point.y, point.z);
        pc.setXYZ(i, ...(o.complete ? [1, 0.72, 0.32] : [0.4, 1, 0.86]));
      }
      pp.needsUpdate = true;
      pc.needsUpdate = true;
      this.pulses.geometry.setDrawRange(0, count);
      if (this.travel) {
        const t = this.travel,
          elapsed = (time - t.started) * 0.7,
          segment = Math.min(t.route.length - 2, Math.floor(elapsed)),
          a = t.route[segment],
          b = t.route[segment + 1],
          edgeId = e.prevEdge[b],
          edge = this.universe.edges[edgeId],
          f = Math.min(1, elapsed - segment),
          point = this.curves[edgeId].getPoint(edge.a === a ? f : 1 - f);
        if (!this.ship) {
          this.ship = this.points([0, 0, 0], [1, 0.95, 0.6], [22]);
          this.world.add(this.ship);
        }
        this.ship.visible = true;
        this.ship.position.copy(point);
        this.controls.target.lerp(point, 0.045);
        this.camera.position.lerp(
          point.clone().add(new THREE.Vector3(0, 22, 40)),
          0.035,
        );
        t.segment = segment;
        t.fraction = f;
        this.onTravel?.({
          segment,
          fraction: f,
          finished: elapsed >= t.route.length - 1,
        });
        if (elapsed >= t.route.length - 1) {
          this.travel = null;
          this.ship.visible = false;
          this.fitRoute(t.route);
        }
      }
      this.markers.forEach((label, i) => {
        const id = i ? e.target : e.start,
          p = vec(this.universe.nodes[id]).project(this.camera);
        label.style.display = p.z > 1 ? 'none' : 'block';
        label.style.left = (p.x * 0.5 + 0.5) * this.element.clientWidth + 'px';
        label.style.top = (-p.y * 0.5 + 0.5) * this.element.clientHeight + 'px';
        label.innerHTML = `<i></i><span>${i ? 'DESTINATION' : id === 0 ? 'HOME · EARTH' : 'DEPARTURE'}</span><strong>${this.universe.nodes[id].name}${i ? ' · ' + this.universe.nodes[id].planets.reduce((a, b) => (a.similarity > b.similarity ? a : b)).name : ''}</strong>`;
      });
    }
    if (this.destination) {
      this.controls.target.lerp(this.destination.target, 0.045);
      this.camera.position.lerp(this.destination.position, 0.045);
      if (this.camera.position.distanceTo(this.destination.position) < 0.1)
        this.destination = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  disposeGroup(group) {
    group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          m.dispose(),
        );
    });
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.resize.disconnect();
    this.controls.dispose();
    this.element.removeEventListener('pointerdown', this.down);
    this.element.removeEventListener('pointerup', this.click);
    if (this.world) this.disposeGroup(this.world);
    this.markers?.forEach((m) => m.remove());
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
