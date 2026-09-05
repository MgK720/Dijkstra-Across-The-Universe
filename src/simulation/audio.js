export class ObservatoryAudio {
  enabled = false;
  async toggle() {
    if (!this.context) this.context = new AudioContext();
    this.enabled = !this.enabled;
    if (this.enabled) {
      await this.context.resume();
      this.tone(130, 0.5, 0.025);
    } else await this.context.suspend();
    return this.enabled;
  }
  tone(frequency = 220, duration = 0.1, volume = 0.016) {
    if (!this.enabled || !this.context) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(frequency, c.currentTime);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(volume, c.currentTime + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + duration);
  }
  success() {
    this.tone(261.63, 0.7, 0.035);
    setTimeout(() => this.tone(329.63, 0.7, 0.025), 120);
    setTimeout(() => this.tone(392, 1, 0.025), 250);
  }
  dispose() {
    this.enabled = false;
    void this.context?.close();
  }
}
