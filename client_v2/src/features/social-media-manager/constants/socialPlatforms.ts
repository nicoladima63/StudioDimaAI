/**
 * Social Media Platforms - Configurazione Centralizzata
 * Colori, abbreviazioni e configurazioni per tutte le piattaforme social
 */

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'tiktok';

export interface PlatformConfig {
  name: string;
  abbr: string;
  color: string;
  icon?: string;
}

/**
 * Configurazione completa per ogni piattaforma social
 */
export const SOCIAL_PLATFORMS: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    name: 'Instagram',
    abbr: 'IG',
    color: '#E1306C', // Rosa Instagram ufficiale
  },
  facebook: {
    name: 'Facebook',
    abbr: 'FB',
    color: '#1877F2', // Blu Facebook ufficiale
  },
  linkedin: {
    name: 'LinkedIn',
    abbr: 'LN',
    color: '#0A66C2', // Blu LinkedIn ufficiale
  },
  tiktok: {
    name: 'TikTok',
    abbr: 'TT',
    color: '#000000', // Nero TikTok
  },
};

/**
 * Ottieni il colore di una piattaforma
 * @param platform Nome della piattaforma
 * @returns Colore hex della piattaforma o grigio di default
 */
export const getPlatformColor = (platform: string): string => {
  return SOCIAL_PLATFORMS[platform as SocialPlatform]?.color || '#6c757d';
};

/**
 * Ottieni l'abbreviazione di una piattaforma
 * @param platform Nome della piattaforma
 * @returns Abbreviazione (es. IG, FB) o primi 2 caratteri maiuscoli
 */
export const getPlatformAbbr = (platform: string): string => {
  return (
    SOCIAL_PLATFORMS[platform as SocialPlatform]?.abbr ||
    platform.substring(0, 2).toUpperCase()
  );
};

/**
 * Ottieni il nome completo di una piattaforma
 * @param platform Nome della piattaforma
 * @returns Nome completo o stringa originale capitalizzata
 */
export const getPlatformName = (platform: string): string => {
  return (
    SOCIAL_PLATFORMS[platform as SocialPlatform]?.name ||
    platform.charAt(0).toUpperCase() + platform.slice(1)
  );
};

/**
 * Lista di tutte le piattaforme disponibili
 */
export const ALL_PLATFORMS: SocialPlatform[] = Object.keys(
  SOCIAL_PLATFORMS
) as SocialPlatform[];
