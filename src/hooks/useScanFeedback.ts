import { useCallback, useRef, useEffect } from 'react';

type FeedbackType = 'success' | 'error' | 'blocked' | 'warning';

interface UseScanFeedbackOptions {
  enabled?: boolean;
  vibrate?: boolean;
}

// Web Audio API sound generator - no external files needed
const createBeep = (
  frequency: number,
  duration: number,
  volume: number = 0.5,
  type: OscillatorType = 'sine'
): Promise<void> => {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gainNode.gain.value = volume;

      // Fade out to avoid clicks
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);

      oscillator.onended = () => {
        audioContext.close();
        resolve();
      };
    } catch (e) {
      console.warn('Audio not available:', e);
      resolve();
    }
  });
};

// Sound patterns for different feedback types
const SOUND_PATTERNS = {
  success: async () => {
    // Two ascending tones - "success" sound
    await createBeep(880, 0.1, 0.4, 'sine');
    await new Promise(r => setTimeout(r, 50));
    await createBeep(1320, 0.15, 0.4, 'sine');
  },
  error: async () => {
    // Low descending buzz - "error" sound
    await createBeep(330, 0.15, 0.5, 'square');
    await new Promise(r => setTimeout(r, 80));
    await createBeep(220, 0.25, 0.5, 'square');
  },
  blocked: async () => {
    // Three short low buzzes - "blocked/denied" sound
    for (let i = 0; i < 3; i++) {
      await createBeep(180, 0.1, 0.5, 'sawtooth');
      await new Promise(r => setTimeout(r, 100));
    }
  },
  warning: async () => {
    // Single medium tone - "attention" sound
    await createBeep(660, 0.2, 0.4, 'triangle');
  },
};

// Vibration patterns (in ms) for mobile devices
const VIBRATION_PATTERNS = {
  success: [100, 50, 100],
  error: [200, 100, 200],
  blocked: [100, 50, 100, 50, 100, 50, 100],
  warning: [150],
};

export const useScanFeedback = (options: UseScanFeedbackOptions = {}) => {
  const { enabled = true, vibrate = true } = options;
  const lastFeedbackRef = useRef<number>(0);

  // Debounce to prevent double-triggers
  const canTrigger = useCallback(() => {
    const now = Date.now();
    if (now - lastFeedbackRef.current < 500) return false;
    lastFeedbackRef.current = now;
    return true;
  }, []);

  const triggerFeedback = useCallback(
    async (type: FeedbackType) => {
      if (!enabled || !canTrigger()) return;

      // Trigger sound
      const soundPattern = SOUND_PATTERNS[type];
      if (soundPattern) {
        soundPattern().catch(() => {});
      }

      // Trigger vibration on mobile
      if (vibrate && navigator.vibrate) {
        try {
          navigator.vibrate(VIBRATION_PATTERNS[type]);
        } catch (e) {
          // Vibration not supported or blocked
        }
      }
    },
    [enabled, vibrate, canTrigger]
  );

  const playSuccess = useCallback(() => triggerFeedback('success'), [triggerFeedback]);
  const playError = useCallback(() => triggerFeedback('error'), [triggerFeedback]);
  const playBlocked = useCallback(() => triggerFeedback('blocked'), [triggerFeedback]);
  const playWarning = useCallback(() => triggerFeedback('warning'), [triggerFeedback]);

  return {
    triggerFeedback,
    playSuccess,
    playError,
    playBlocked,
    playWarning,
  };
};

export default useScanFeedback;
