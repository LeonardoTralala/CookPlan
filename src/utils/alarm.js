// Utility nada alarm sintetis iPhone & trigger event alarm
export function playAlarmRingtone() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Urutan melodi ikonik iPhone Opening / Marimba Ringtone
    const sequence = [
      { note: 1046.50, duration: 0.12 }, // C6
      { note: 880.00,  duration: 0.12 }, // A5
      { note: 698.46,  duration: 0.12 }, // F5
      { note: 523.25,  duration: 0.14 }, // C5
      { note: 698.46,  duration: 0.12 }, // F5
      { note: 880.00,  duration: 0.12 }, // A5
      { note: 1046.50, duration: 0.18 }, // C6
      { note: 880.00,  duration: 0.14 }, // A5
      { note: 1046.50, duration: 0.25 }, // C6
    ];

    let currentTime = ctx.currentTime;

    sequence.forEach(({ note, duration }) => {
      // Nada Utama (Marimba fundamental tone)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(note, currentTime);
      gain1.gain.setValueAtTime(0.25, currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, currentTime + duration);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      // Nada Harmonis Resonansi Kayu Marimba khas iPhone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(note * 2.76, currentTime);
      gain2.gain.setValueAtTime(0.06, currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.0001, currentTime + duration * 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc1.start(currentTime);
      osc1.stop(currentTime + duration);
      osc2.start(currentTime);
      osc2.stop(currentTime + duration);

      currentTime += duration + 0.04;
    });
  } catch {
    /* AudioContext opsional bila diblokir browser */
  }
}

export function triggerCookPlanAlarm() {
  window.dispatchEvent(new CustomEvent('trigger-cookplan-alarm'));
}
