import os

from storages.backends.azure_storage import AzureStorage


class AzureMediaStorage(AzureStorage):
    account_name = os.getenv("AZURE_ACCOUNT_NAME")
    account_key = os.getenv("AZURE_ACCOUNT_KEY")
    azure_container = "media"
    expiration_secs = None
