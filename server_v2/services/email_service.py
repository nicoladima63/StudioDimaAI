import base64
import logging
import re
from typing import Dict, Any, List, Optional
from email.utils import parseaddr
from html import unescape

from core.google_gmail_client import GoogleGmailClient
from core.paths import GOOGLE_CREDENTIALS_PATH, GMAIL_TOKEN_PATH, GMAIL_OAUTH_STATE_PATH
from core.exceptions import GmailCredentialsNotFoundError, GmailApiError
from repositories.email_repository import (
    EmailScopeRepository,
    EmailRuleRepository,
    EmailAiConfigRepository,
    EmailCacheRepository,
)

logger = logging.getLogger(__name__)


class EmailService:
    """Service for reading and classifying Gmail emails."""

    def __init__(self):
        self._scope_repo = EmailScopeRepository()
        self._rule_repo = EmailRuleRepository()
        self._ai_config_repo = EmailAiConfigRepository()
        self._cache_repo = EmailCacheRepository()

    def _get_gmail_client(self) -> GoogleGmailClient:
        return GoogleGmailClient(
            credentials_path=GOOGLE_CREDENTIALS_PATH,
            token_path=GMAIL_TOKEN_PATH,
            oauth_state_path=GMAIL_OAUTH_STATE_PATH,
        )

    def _get_gmail_service(self):
        client = self._get_gmail_client()
        return client.get_service()

    # =========================================================================
    # OAuth
    # =========================================================================

    def get_oauth_url(self, redirect_uri: str) -> str:
        client = self._get_gmail_client()
        return client.generate_web_auth_url(redirect_uri)

    def handle_oauth_callback(self, code: str, state: str, redirect_uri: str):
        client = self._get_gmail_client()
        client.handle_web_auth_callback(code, state, redirect_uri)

    def get_oauth_status(self) -> Dict[str, Any]:
        return {
            'authenticated': GMAIL_TOKEN_PATH.exists(),
            'token_path': str(GMAIL_TOKEN_PATH),
        }

    # =========================================================================
    # Email Reading
    # =========================================================================

    def get_emails(self, max_results: int = 20, page_token: Optional[str] = None,
                   query: Optional[str] = None) -> Dict[str, Any]:
        """Fetch emails from Gmail with pagination."""
        try:
            service = self._get_gmail_service()
            params = {
                'userId': 'me',
                'maxResults': max_results,
            }
            if page_token:
                params['pageToken'] = page_token
            if query:
                params['q'] = query

            results = service.users().messages().list(**params).execute()
            messages = results.get('messages', [])
            next_page_token = results.get('nextPageToken')

            emails = []
            if messages:
                # Batch fetch message details
                for msg in messages:
                    email_data = self._get_message_summary(service, msg['id'])
                    if email_data:
                        emails.append(email_data)

            return {
                'emails': emails,
                'next_page_token': next_page_token,
                'result_size_estimate': results.get('resultSizeEstimate', 0),
            }
        except GmailCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to get emails: {e}")
            raise GmailApiError(f"Failed to get emails: {str(e)}")

    def get_email_detail(self, message_id: str) -> Dict[str, Any]:
        """Get full detail of a single email."""
        try:
            service = self._get_gmail_service()
            msg = service.users().messages().get(
                userId='me', id=message_id, format='full'
            ).execute()
            return self._parse_message_full(msg)
        except GmailCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to get email detail {message_id}: {e}")
            raise GmailApiError(f"Failed to get email detail: {str(e)}")

    def get_labels(self) -> List[Dict[str, Any]]:
        """Get Gmail labels."""
        try:
            service = self._get_gmail_service()
            results = service.users().labels().list(userId='me').execute()
            labels = results.get('labels', [])
            return [{'id': l['id'], 'name': l['name'], 'type': l.get('type', '')} for l in labels]
        except GmailCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to get labels: {e}")
            raise GmailApiError(f"Failed to get labels: {str(e)}")

    def _get_message_summary(self, service, message_id: str) -> Optional[Dict[str, Any]]:
        """Get a lightweight summary of a message."""
        try:
            msg = service.users().messages().get(
                userId='me', id=message_id, format='metadata',
                metadataHeaders=['From', 'To', 'Subject', 'Date']
            ).execute()
            return self._parse_message_metadata(msg)
        except Exception as e:
            logger.error(f"Failed to get message summary {message_id}: {e}")
            return None

    def _parse_message_metadata(self, msg: Dict) -> Dict[str, Any]:
        """Parse message metadata into a clean dict."""
        headers = {h['name'].lower(): h['value'] for h in msg.get('payload', {}).get('headers', [])}
        sender_name, sender_email = parseaddr(headers.get('from', ''))

        return {
            'id': msg['id'],
            'thread_id': msg.get('threadId', ''),
            'subject': headers.get('subject', '(nessun oggetto)'),
            'from_name': sender_name or sender_email,
            'from_email': sender_email,
            'to': headers.get('to', ''),
            'date': headers.get('date', ''),
            'snippet': unescape(msg.get('snippet', '')),
            'label_ids': msg.get('labelIds', []),
            'is_unread': 'UNREAD' in msg.get('labelIds', []),
        }

    def _parse_message_full(self, msg: Dict) -> Dict[str, Any]:
        """Parse full message into a detailed dict."""
        data = self._parse_message_metadata(msg)
        payload = msg.get('payload', {})

        # Extract body
        body_html = ''
        body_text = ''
        self._extract_body(payload, body_html_ref := [], body_text_ref := [])
        body_html = ''.join(body_html_ref)
        body_text = ''.join(body_text_ref)

        # Extract attachments info
        attachments = []
        self._extract_attachments(payload, attachments)

        data['body_html'] = body_html
        data['body_text'] = body_text
        data['attachments'] = attachments
        data['size_estimate'] = msg.get('sizeEstimate', 0)

        return data

    def _extract_body(self, payload: Dict, html_parts: List[str], text_parts: List[str]):
        """Recursively extract body content from message payload."""
        mime_type = payload.get('mimeType', '')

        if mime_type == 'text/html':
            body_data = payload.get('body', {}).get('data', '')
            if body_data:
                html_parts.append(base64.urlsafe_b64decode(body_data).decode('utf-8', errors='replace'))
        elif mime_type == 'text/plain':
            body_data = payload.get('body', {}).get('data', '')
            if body_data:
                text_parts.append(base64.urlsafe_b64decode(body_data).decode('utf-8', errors='replace'))

        for part in payload.get('parts', []):
            self._extract_body(part, html_parts, text_parts)

    def _extract_attachments(self, payload: Dict, attachments: List[Dict]):
        """Recursively extract attachment info from message payload."""
        filename = payload.get('filename', '')
        if filename and payload.get('body', {}).get('attachmentId'):
            attachments.append({
                'filename': filename,
                'mime_type': payload.get('mimeType', ''),
                'size': payload.get('body', {}).get('size', 0),
                'attachment_id': payload['body']['attachmentId'],
            })

        for part in payload.get('parts', []):
            self._extract_attachments(part, attachments)

    # =========================================================================
    # Classification - Rules
    # =========================================================================

    def classify_email_by_rules(self, email_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Classify an email using manual rules. Returns scope info if matched."""
        rules = self._rule_repo.get_all_active_rules()
        if not rules:
            return None

        for rule in rules:
            field_value = self._get_email_field(email_data, rule['field'])
            if field_value and self._matches_rule(field_value, rule['operator'], rule['value']):
                return {
                    'scope_id': rule['scope_id'],
                    'scope_name': rule.get('scope_name', ''),
                    'scope_label': rule.get('scope_label', ''),
                    'confidence': 0.95,
                    'source': 'rule',
                    'rule_id': rule['id'],
                }
        return None

    def _get_email_field(self, email_data: Dict, field: str) -> str:
        """Extract field value from email data for rule matching."""
        field_map = {
            'from': email_data.get('from_email', '') + ' ' + email_data.get('from_name', ''),
            'subject': email_data.get('subject', ''),
            'body': email_data.get('snippet', '') + ' ' + email_data.get('body_text', ''),
            'snippet': email_data.get('snippet', ''),
            'to': email_data.get('to', ''),
        }
        return field_map.get(field, '').lower()

    def _matches_rule(self, field_value: str, operator: str, rule_value: str) -> bool:
        """Check if a field value matches a rule. Supports comma-separated multi-values."""
        # Regex uses raw value, no splitting
        if operator == 'regex':
            try:
                return bool(re.search(rule_value, field_value, re.IGNORECASE))
            except re.error:
                return False

        # Split comma-separated values, match if ANY value matches
        values = [v.strip().lower() for v in rule_value.split(',') if v.strip()]
        if not values:
            return False

        for val in values:
            if operator == 'contains' and val in field_value:
                return True
            elif operator == 'equals' and field_value.strip() == val:
                return True
            elif operator == 'starts_with' and field_value.startswith(val):
                return True
            elif operator == 'ends_with' and field_value.endswith(val):
                return True

        return False

    # =========================================================================
    # Classification - AI
    # =========================================================================

    def classify_email_ai(self, email_data: Dict[str, Any],
                          scopes: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Classify an email using AI (Claude API)."""
        ai_config = self._ai_config_repo.get_active_config()
        if not ai_config or not ai_config.get('api_key'):
            return None

        try:
            import anthropic

            client = anthropic.Anthropic(api_key=ai_config['api_key'])

            scopes_desc = "\n".join([
                f"- {s['name']} (ID: {s['id']}): {s.get('description', s['label'])}"
                for s in scopes
            ])

            prompt = f"""Analizza questa email e classifica in una delle seguenti categorie dello studio dentistico.
Se l'email non e' pertinente a nessuna categoria, rispondi con "none".

Categorie disponibili:
{scopes_desc}

Email:
- Mittente: {email_data.get('from_name', '')} <{email_data.get('from_email', '')}>
- Oggetto: {email_data.get('subject', '')}
- Anteprima: {email_data.get('snippet', '')[:500]}

Rispondi SOLO con un JSON valido nel formato:
{{"scope_name": "nome_categoria", "scope_id": id_numerico, "confidence": 0.0-1.0, "reasoning": "breve motivazione"}}

Se non pertinente: {{"scope_name": "none", "scope_id": null, "confidence": 0.0, "reasoning": "motivazione"}}"""

            response = client.messages.create(
                model=ai_config.get('model', 'claude-sonnet-4-20250514'),
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}]
            )

            import json
            response_text = response.content[0].text.strip()
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                if result.get('scope_name') != 'none' and result.get('scope_id'):
                    return {
                        'scope_id': result['scope_id'],
                        'scope_name': result.get('scope_name', ''),
                        'confidence': result.get('confidence', 0.7),
                        'source': 'ai',
                        'reasoning': result.get('reasoning', ''),
                    }
            return None

        except ImportError:
            logger.error("anthropic package not installed")
            return None
        except Exception as e:
            logger.error(f"AI classification failed: {e}")
            return None

    # =========================================================================
    # Hybrid Classification (orchestrator)
    # =========================================================================

    def classify_email(self, email_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Hybrid classification: rules first, then AI if no match."""
        # Check cache first
        cached = self._cache_repo.get_cached_classification(email_data.get('id', ''))
        if cached and cached.get('scope_id'):
            return {
                'scope_id': cached['scope_id'],
                'source': cached.get('classification_source', 'cache'),
                'confidence': 0.99,
            }

        # Try rules first
        result = self.classify_email_by_rules(email_data)
        if result:
            self._cache_classification(email_data, result)
            return result

        # Try AI
        scopes = self._scope_repo.get_active_scopes()
        if scopes:
            result = self.classify_email_ai(email_data, scopes)
            if result:
                self._cache_classification(email_data, result)
                return result

        return None

    def _cache_classification(self, email_data: Dict, classification: Dict):
        """Cache a classification result."""
        try:
            self._cache_repo.cache_classification({
                'message_id': email_data.get('id', ''),
                'scope_id': classification.get('scope_id'),
                'subject': email_data.get('subject', ''),
                'sender': email_data.get('from_email', ''),
                'date': email_data.get('date', ''),
                'snippet': email_data.get('snippet', ''),
                'classification_source': classification.get('source', 'rule'),
            })
        except Exception as e:
            logger.error(f"Failed to cache classification: {e}")

    # =========================================================================
    # Relevant Emails (main feature)
    # =========================================================================

    def get_relevant_emails(self, max_results: int = 50, page_token: Optional[str] = None,
                            query: Optional[str] = None) -> Dict[str, Any]:
        """Get all emails with classification info attached."""
        try:
            email_result = self.get_emails(max_results=max_results, page_token=page_token, query=query)
            emails = email_result.get('emails', [])

            scopes = self._scope_repo.get_active_scopes()
            scope_map = {s['id']: s for s in scopes}

            total_classified = 0
            for email in emails:
                classification = self.classify_email(email)
                if classification:
                    sid = classification.get('scope_id')
                    scope = scope_map.get(sid, {})
                    email['classification'] = {
                        'scope_id': sid,
                        'scope_name': scope.get('name', ''),
                        'scope_label': scope.get('label', ''),
                        'scope_color': scope.get('color', '#999'),
                        'confidence': classification.get('confidence', 0),
                        'source': classification.get('source', 'unknown'),
                    }
                    total_classified += 1
                else:
                    email['classification'] = None

            return {
                'emails': emails,
                'next_page_token': email_result.get('next_page_token'),
                'total_fetched': len(emails),
                'total_relevant': total_classified,
            }
        except GmailCredentialsNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to get relevant emails: {e}")
            raise GmailApiError(f"Failed to get relevant emails: {str(e)}")

    # =========================================================================
    # Scopes CRUD (delegates to repo)
    # =========================================================================

    def get_scopes(self) -> List[Dict[str, Any]]:
        return self._scope_repo.get_all_scopes()

    def get_active_scopes(self) -> List[Dict[str, Any]]:
        return self._scope_repo.get_active_scopes()

    def create_scope(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._scope_repo.create_scope(data)

    def update_scope(self, scope_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self._scope_repo.update_scope(scope_id, data)

    def delete_scope(self, scope_id: int) -> bool:
        return self._scope_repo.delete_scope(scope_id)

    # =========================================================================
    # Rules CRUD (delegates to repo)
    # =========================================================================

    def get_rules(self, scope_id: Optional[int] = None) -> List[Dict[str, Any]]:
        if scope_id:
            return self._rule_repo.get_rules_by_scope(scope_id)
        return self._rule_repo.get_all_rules()

    def create_rule(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._rule_repo.create_rule(data)

    def update_rule(self, rule_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self._rule_repo.update_rule(rule_id, data)

    def delete_rule(self, rule_id: int) -> bool:
        return self._rule_repo.delete_rule(rule_id)

    # =========================================================================
    # AI Config
    # =========================================================================

    def get_ai_config(self) -> Optional[Dict[str, Any]]:
        config = self._ai_config_repo.get_active_config()
        if config:
            # Mask API key for security
            if config.get('api_key'):
                key = config['api_key']
                config['api_key_masked'] = key[:8] + '...' + key[-4:] if len(key) > 12 else '***'
            config.pop('api_key', None)
        return config

    def save_ai_config(self, data: Dict[str, Any]) -> Dict[str, Any]:
        return self._ai_config_repo.save_config(data)

    def get_ai_config_with_key(self) -> Optional[Dict[str, Any]]:
        """Internal use only - returns full config with key."""
        return self._ai_config_repo.get_active_config()

    def test_ai_classification(self, email_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Test AI classification on a specific email."""
        scopes = self._scope_repo.get_active_scopes()
        return self.classify_email_ai(email_data, scopes)

    # =========================================================================
    # Cache management
    # =========================================================================

    def clear_cache(self) -> bool:
        return self._cache_repo.clear_cache()


# Singleton
email_service = EmailService()
