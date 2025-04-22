import videojs from 'video.js';

declare module 'video.js' {
  interface VideoJsPlayer {
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
    
    player_?: {
      ass?: {
        delay: number;
      };
    };
  }
  
  namespace videojs {
    interface VideoJsPlayerOptions {
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
  }
}

export {}; 