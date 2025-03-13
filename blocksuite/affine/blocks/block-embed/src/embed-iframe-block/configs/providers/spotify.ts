import { EmbedIframeConfigExtension } from '../../extension/embed-iframe-config';
import {
  type EmbedIframeUrlValidationOptions,
  validateEmbedIframeUrl,
} from '../../utils';

const SPOTIFY_DEFAULT_WIDTH = '100%';
const SPOTIFY_DEFAULT_HEIGHT = '152px';

// https://developer.spotify.com/documentation/embeds/reference/oembed
const spotifyEndpoint = 'https://open.spotify.com/oembed';

const spotifyUrlValidationOptions: EmbedIframeUrlValidationOptions = {
  protocols: ['https:'],
  hostnames: ['open.spotify.com', 'spotify.link'],
};

const spotifyConfig = {
  name: 'spotify',
  match: (url: string) =>
    validateEmbedIframeUrl(url, spotifyUrlValidationOptions),
  buildOEmbedUrl: (url: string) => {
    const match = validateEmbedIframeUrl(url, spotifyUrlValidationOptions);
    if (!match) {
      return undefined;
    }
    const encodedUrl = encodeURIComponent(url);
    const oEmbedUrl = `${spotifyEndpoint}?url=${encodedUrl}`;
    return oEmbedUrl;
  },
  useOEmbedUrlDirectly: false,
  options: {
    defaultWidth: SPOTIFY_DEFAULT_WIDTH,
    defaultHeight: SPOTIFY_DEFAULT_HEIGHT,
    allow:
      'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
    style: 'border-radius: 8px;',
    allowFullscreen: true,
  },
};

export const SpotifyEmbedConfig = EmbedIframeConfigExtension(spotifyConfig);
