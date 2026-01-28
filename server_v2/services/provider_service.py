
import logging
from typing import Optional, List, Dict, Any
from core.database_manager import DatabaseManager
from repositories.provider_repository import ProviderRepository
from core.exceptions import ValidationError

logger = logging.getLogger(__name__)

class ProviderService:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.provider_repository = ProviderRepository(db_manager)

    def get_all_providers(self) -> List[Dict[str, Any]]:
        """Get all active providers."""
        return self.provider_repository.get_all_active()

    def get_provider_by_id(self, provider_id: int) -> Optional[Dict[str, Any]]:
        """Get provider by ID."""
        return self.provider_repository.get_by_id(provider_id)

    def create_provider(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new provider."""
        # Validation
        if not data.get('name'):
            raise ValidationError("Provider name is required")
            
        # Check duplicates? (Optional, maybe allow same name different type)
        
        return self.provider_repository.create(data)

    def update_provider(self, provider_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a provider."""
        existing = self.provider_repository.get_by_id(provider_id)
        if not existing:
            return None
            
        return self.provider_repository.update(provider_id, data)

    def delete_provider(self, provider_id: int) -> bool:
        """Soft delete a provider."""
        return self.provider_repository.delete(provider_id)
