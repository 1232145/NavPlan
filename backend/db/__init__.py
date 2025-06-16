from pymongo import MongoClient, ASCENDING
from pymongo.errors import ConnectionFailure, OperationFailure
from contextlib import contextmanager
import logging
from config import MONGODB_URI, MONGODB_DB

# Configure logging
logger = logging.getLogger(__name__)

class DatabaseManager:
    _instance = None
    _client = None
    _db = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatabaseManager, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        try:
            # Configure client with connection pooling and timeout
            self._client = MongoClient(
                MONGODB_URI,
                maxPoolSize=50,
                minPoolSize=10,
                maxIdleTimeMS=30000,
                connectTimeoutMS=5000,
                serverSelectionTimeoutMS=5000,
                retryWrites=True,
                retryReads=True
            )
            self._db = self._client[MONGODB_DB]
            
            # Create indexes
            self._create_indexes()
            
            # Test connection
            self._client.admin.command('ping')
            logger.info("Successfully connected to MongoDB")
        except ConnectionFailure as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error during database initialization: {e}")
            raise

    def _create_indexes(self):
        try:
            # Create index for user_id for efficient queries
            self._db.archived_lists.create_index([
                ("user_id", ASCENDING)
            ])
            
            # Create text index for name field within lists array for search functionality
            self._db.archived_lists.create_index([
                ("lists.name", "text")
            ])
            
            # Create index for date within lists array for sorting
            self._db.archived_lists.create_index([
                ("lists.date", ASCENDING)
            ])
            
            # Create index for example lists collection
            self._db.example_lists.create_index([
                ("name", ASCENDING)
            ])
            
            logger.info("Successfully created database indexes")
        except OperationFailure as e:
            logger.error(f"Failed to create indexes: {e}")
            raise

    @contextmanager
    def get_database(self):
        """Context manager for database operations"""
        try:
            yield self._db
        except ConnectionFailure as e:
            logger.error(f"Database connection error: {e}")
            raise
        except OperationFailure as e:
            logger.error(f"Database operation error: {e}")
            raise
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            raise

    def close(self):
        """Close the database connection"""
        if self._client:
            try:
                self._client.close()
                logger.info("Database connection closed")
            except Exception as e:
                logger.error(f"Error closing database connection: {e}")
                raise

# Create a single instance of DatabaseManager
db_manager = DatabaseManager()

def get_database():
    """Get database instance with context manager"""
    return db_manager.get_database() 