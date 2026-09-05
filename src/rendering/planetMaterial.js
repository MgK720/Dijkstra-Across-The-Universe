import * as THREE from 'three';
// Small procedural world shader: all surface variation is derived from planet data.
export function planetMaterial(planet) {
  return new THREE.ShaderMaterial({
    uniforms: {
      earthlike: { value: planet.similarity > 0.8 ? 1 : 0 },
      gas: { value: planet.radius > 1.5 ? 1 : 0 },
      seed: { value: planet.phase },
    },
    vertexShader: `varying vec3 vNormal;varying vec3 vLocal;void main(){vNormal=normal;vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vNormal;varying vec3 vLocal;uniform float earthlike;uniform float gas;uniform float seed;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){vec3 n=normalize(vNormal);vec3 p=normalize(vLocal)*5.+seed;float land=noise(p)*.6+noise(p*2.)*.25+noise(p*4.)*.15;vec3 ocean=vec3(.04,.25,.44),green=vec3(.16,.42,.28),rock=vec3(.55,.35,.2);vec3 surface=mix(rock*(.5+land),mix(ocean,green,smoothstep(.49,.57,land)),earthlike);float bands=.5+.5*sin(n.y*35.+land*8.);surface=mix(surface,mix(vec3(.34,.22,.14),vec3(.77,.62,.4),bands),gas);float cloud=smoothstep(.62,.74,noise(p*1.5+3.));surface=mix(surface,vec3(.82,.86,.85),cloud*.65);float lit=max(0.,dot(n,normalize(vec3(-.7,.55,.8))));surface*=.12+.88*lit;float rim=pow(1.-max(0.,n.z),3.);surface+=earthlike*vec3(.05,.2,.32)*rim*.5;gl_FragColor=vec4(surface,1.);}`,
  });
}
