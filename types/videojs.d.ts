declare module 'video.js' {
  interface VideoJsPlayer {
    play(): Promise<void>;
    pause(): void;
    currentTime(seconds?: number): number;
    volume(level?: number): number;
    muted(muted?: boolean): boolean;
    requestFullscreen(): void;
    exitFullscreen(): void;
    isFullscreen(): boolean;
    duration(): number;
    dispose(): void;
    textTracks(): TextTrackList;
    audioTracks(): AudioTrackList;
    playbackRate(rate?: number): number;
    src(source: { src: string }): void;
    load(): void;
    on(event: string, callback: Function): void;
    removeRemoteTextTrack(track: TextTrack): void;
    addRemoteTextTrack(options: {
      kind: string;
      src: string;
      srclang: string;
      label: string;
      default?: boolean;
    }, manualCleanup: boolean): void;
    ass(options: {
      src: string;
      label?: string;
      delay?: number;
      enableSvg?: boolean;
      fontSize?: string;
      fontFamily?: string;
      fontWeight?: string;
      color?: string;
      backgroundColor?: string;
      textShadow?: string;
    }): void;
    player_: {
      ass: {
        delay: number;
      };
    };
    showTextTrack(index: number, show: boolean): void;
    error(): {
      code: number;
      message: string;
      type?: string;
      status?: number;
    } | null;
  }

  interface VideoJsPlayerOptions {
    controls?: boolean;
    autoplay?: boolean;
    loop?: boolean;
    muted?: boolean;
    poster?: string;
    sources?: { src: string }[];
    playbackRates?: number[];
    fluid?: boolean;
    fill?: boolean;
    language?: string;
    controlBar?: {
      children: string[];
    };
    html5?: {
      nativeTextTracks?: boolean;
      nativeAudioTracks?: boolean;
      nativeVideoTracks?: boolean;
    };
    userActions?: {
      hotkeys?: {
        volumeStep?: number;
        seekStep?: number;
        enableNumbers?: boolean;
        enableVolumeScroll?: boolean;
        customKeys?: {
          [key: string]: {
            key: (e: KeyboardEvent) => boolean;
            handler: (player: VideoJsPlayer, options: any, e: KeyboardEvent) => void;
          };
        };
      };
    };
  }

  export default function videojs(
    element: HTMLVideoElement,
    options?: VideoJsPlayerOptions
  ): VideoJsPlayer;
}

declare module 'videojs-ass' {
  export default function videojsAss(): void;
} 