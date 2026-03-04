"""
Social Content Generation Service per StudioDimaAI.
Genera contenuti per social media usando LLM (Anthropic Claude).
"""

import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime

logger = logging.getLogger(__name__)

# Pilastri contenuto per studio dentistico
CONTENT_PILLARS = {
    'educational': {
        'description': 'Prevenzione, igiene orale, consigli pratici per i pazienti',
        'tone': 'informativo e accessibile',
        'examples': 'come lavare i denti, prevenzione carie, igiene con apparecchio',
    },
    'authority': {
        'description': 'Tecnologie, casi clinici, competenze specialistiche dello studio',
        'tone': 'professionale e autorevole',
        'examples': 'scanner intraorale, implantologia guidata, casi prima/dopo',
    },
    'trust': {
        'description': 'Team, recensioni, dietro le quinte, rapporto umano',
        'tone': 'caldo e personale',
        'examples': 'presentazione team, giornata tipo, recensioni pazienti',
    },
    'promo': {
        'description': 'Open day, disponibilita slot, offerte prevenzione',
        'tone': 'invitante senza essere aggressivo',
        'examples': 'giornata prevenzione, slot disponibili, prima visita gratuita',
    },
}

# Limiti caratteri per piattaforma
PLATFORM_LIMITS = {
    'instagram': {'max_chars': 2200, 'hashtag_limit': 30, 'style': 'paragrafi brevi, emoji leggere, hashtag in fondo'},
    'facebook': {'max_chars': 5000, 'hashtag_limit': 5, 'style': 'tono narrativo, meno hashtag, piu discorsivo'},
    'linkedin': {'max_chars': 3000, 'hashtag_limit': 5, 'style': 'tono professionale, dati e statistiche, no emoji'},
}


class SocialContentGenerationService:
    """Service per generazione contenuti social con LLM."""

    def __init__(self, db_manager=None):
        self.db_manager = db_manager
        self._client = None

    def _get_client(self):
        """Lazy init del client Anthropic."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.Anthropic()
            except ImportError:
                raise RuntimeError("Il pacchetto 'anthropic' non e' installato. Esegui: pip install anthropic")
            except Exception as e:
                raise RuntimeError(f"Errore inizializzazione client Anthropic: {e}. Verifica ANTHROPIC_API_KEY nel .env")
        return self._client

    def generate_post(
        self,
        platform: str,
        content_pillar: str,
        objective: str,
        topic: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Genera un post completo per social media.

        Args:
            platform: Piattaforma target (instagram, facebook, linkedin)
            content_pillar: Pilastro contenuto (educational, authority, trust, promo)
            objective: Obiettivo del post (es. 'aumentare engagement', 'informare')
            topic: Topic specifico (opzionale, se None il LLM lo sceglie)
            user_id: ID utente che richiede la generazione

        Returns:
            Dict con title, content, hashtags, cta, content_pillar
        """
        start_time = time.time()

        # Validazione
        if content_pillar not in CONTENT_PILLARS:
            raise ValueError(f"Pilastro '{content_pillar}' non valido. Validi: {list(CONTENT_PILLARS.keys())}")

        platform_config = PLATFORM_LIMITS.get(platform, PLATFORM_LIMITS['instagram'])
        pillar_config = CONTENT_PILLARS[content_pillar]

        # Costruisci prompt
        prompt = self._build_prompt(platform, platform_config, pillar_config, objective, topic)

        # Chiama LLM
        try:
            client = self._get_client()
            response = client.messages.create(
                model='claude-sonnet-4-20250514',
                max_tokens=1024,
                messages=[{'role': 'user', 'content': prompt}],
                system="Sei un social media manager esperto per uno studio dentistico italiano. "
                       "Rispondi SOLO con il JSON richiesto, senza markdown o testo aggiuntivo.",
            )

            raw_text = response.content[0].text.strip()
            tokens_used = (response.usage.input_tokens or 0) + (response.usage.output_tokens or 0)

        except Exception as e:
            logger.error(f"Errore chiamata LLM: {e}")
            raise RuntimeError(f"Errore generazione contenuto: {e}")

        # Parse risposta JSON
        result = self._parse_response(raw_text, content_pillar)

        generation_time = int((time.time() - start_time) * 1000)

        # Salva in history
        if self.db_manager:
            self._save_history(
                prompt=prompt,
                generated_content=raw_text,
                content_type=content_pillar,
                ai_model='claude-sonnet-4-20250514',
                tokens_used=tokens_used,
                generation_time_ms=generation_time,
                user_id=user_id,
            )

        logger.info(f"Post generato per {platform}/{content_pillar} in {generation_time}ms ({tokens_used} tokens)")
        return result

    def _build_prompt(
        self,
        platform: str,
        platform_config: Dict,
        pillar_config: Dict,
        objective: str,
        topic: Optional[str],
    ) -> str:
        """Costruisce il prompt per l'LLM."""
        topic_instruction = f"Topic specifico: {topic}" if topic else "Scegli tu un topic rilevante e attuale."

        return f"""Genera un post per {platform} per lo Studio Dentistico Di Martino.

PILASTRO CONTENUTO: {pillar_config['description']}
TONO: {pillar_config['tone']}
OBIETTIVO: {objective}
{topic_instruction}

REGOLE PIATTAFORMA ({platform}):
- Massimo {platform_config['max_chars']} caratteri per il contenuto
- Massimo {platform_config['hashtag_limit']} hashtag
- Stile: {platform_config['style']}

REGOLE GENERALI:
- Il post deve essere in italiano
- Non usare termini troppo tecnici, il target sono pazienti
- Includi una call-to-action naturale
- Gli hashtag devono essere in italiano e pertinenti al settore dentale

Rispondi con questo formato JSON esatto:
{{
  "title": "titolo breve del post (max 80 caratteri)",
  "content": "testo completo del post",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"],
  "cta": "call to action del post"
}}"""

    def _parse_response(self, raw_text: str, content_pillar: str) -> Dict[str, Any]:
        """Parse della risposta LLM in struttura dati."""
        import json

        # Rimuovi eventuali wrapper markdown
        text = raw_text.strip()
        if text.startswith('```'):
            text = text.split('\n', 1)[1] if '\n' in text else text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()

        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            logger.error(f"Errore parsing JSON risposta LLM: {e}\nRaw: {raw_text[:500]}")
            raise RuntimeError(f"L'LLM ha restituito una risposta non valida. Riprova.")

        # Normalizza hashtag (rimuovi # iniziale se presente)
        hashtags = data.get('hashtags', [])
        hashtags = [tag.lstrip('#') for tag in hashtags]

        return {
            'title': data.get('title', ''),
            'content': data.get('content', ''),
            'hashtags': hashtags,
            'cta': data.get('cta', ''),
            'content_pillar': content_pillar,
        }

    def _save_history(self, **kwargs):
        """Salva la generazione nella tabella ai_generation_history."""
        try:
            with self.db_manager.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO ai_generation_history
                        (prompt, generated_content, content_type, ai_model,
                         tokens_used, generation_time_ms, user_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    kwargs.get('prompt', ''),
                    kwargs.get('generated_content', ''),
                    kwargs.get('content_type', ''),
                    kwargs.get('ai_model', ''),
                    kwargs.get('tokens_used', 0),
                    kwargs.get('generation_time_ms', 0),
                    kwargs.get('user_id'),
                ))
                cursor.close()
        except Exception as e:
            logger.warning(f"Errore salvataggio ai_generation_history: {e}")

    def get_pillars(self) -> Dict[str, Any]:
        """Restituisce la configurazione dei content pillars."""
        return CONTENT_PILLARS
