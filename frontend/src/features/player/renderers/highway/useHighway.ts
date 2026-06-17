
import { onMounted, onUnmounted } from 'vue';
import { Highway } from './Highway.js';
import { usePlayerStore } from '@/features/player/store.js';

export function useHighway(): void {
  const player = usePlayerStore();
  let hw: Highway | null = null;

  function onSongReady(): void {
    player.setSongInfo(hw?.getSongInfo() ?? null);
  }

  onMounted(() => {
    const canvas = document.getElementById('highway') as HTMLCanvasElement | null;
    if (!canvas) {
      console.error('[useHighway] #highway canvas not found');
      return;
    }

    hw = new Highway();

    // Expose as window.highway so legacy plugin code continues to work.
    (window as unknown as { highway: Highway }).highway = hw;

    hw.init(canvas);
    player.setHighway(hw as unknown as typeof window.highway);

    const emitter = (window as unknown as { sloprock?: { on?: (e: string, h: (e: Event) => void) => void } }).sloprock;
    emitter?.on?.('song:ready', onSongReady);

    // Replay the song if the route watch in PlayerView already fired before
    // the highway was ready (it fires during setup(), before the DOM exists).
    if (player.trackIdRef) {
      player.playSong(player.trackIdRef, player.arrangement, player.trackIdRef);
    }
  });

  onUnmounted(() => {
    const emitter = (window as unknown as { sloprock?: { off?: (e: string, h: (e: Event) => void) => void } }).sloprock;
    (emitter as unknown as { off?: (e: string, h: () => void) => void })?.off?.('song:ready', onSongReady);
    player.cleanup();
    hw = null;
  });
}
