/** Synthesized interaction sounds (no audio files). Page only, never notifications. */
export type SoundType = 'pop' | 'check' | 'crumple';

let ctx: AudioContext | null = null;
const audio = () => (ctx ??= new AudioContext());

export const playSound = (type: SoundType) => {
  try {
    const ac = audio();
    const now = ac.currentTime;
    const gain = ac.createGain();
    gain.connect(ac.destination);

    if (type === 'pop') {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain);
      osc.start();
      osc.stop(now + 0.15);
    } else if (type === 'check') {
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g);
        g.connect(ac.destination);
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.06, now + i * 0.04 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.25);
        o.start(now + i * 0.04);
        o.stop(now + i * 0.04 + 0.35);
      });
    } else {
      const size = Math.floor(ac.sampleRate * 0.2);
      const buffer = ac.createBuffer(1, size, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
      const noise = ac.createBufferSource();
      noise.buffer = buffer;
      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000;
      noise.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      noise.start();
      noise.stop(now + 0.2);
    }
  } catch {
    // Audio can be blocked until the first user gesture; sounds are optional.
  }
};
