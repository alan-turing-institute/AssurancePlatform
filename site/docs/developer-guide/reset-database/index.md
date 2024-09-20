# Resetting the Database

Resetting the database of the Trustworthy and Ethical Assurance (TEA) Platform might become necessary under various circumstances. Whether you're cleaning up after a demonstration, addressing schema changes, or preparing for a new phase of development, understanding how to reset your database safely and effectively is crucial.

!!! warning

    Resetting the database is a powerful action that can help maintain the cleanliness and integrity of your TEA Platform installation. However, it should be approached with caution to avoid accidental data loss.

## Reasons for Resetting

**Post-Demo Cleanup**: After demonstrating the TEA Platform, you might want to remove all test data, including users and cases, to ensure a clean slate for actual use.

**Schema Changes**: Implementing changes in the database schema that cannot be migrated using Django's standard migration tools may require a fresh start.

## Resetting Environments

The process for resetting the TEA Platform database differs depending on the environment in which it is deployed:

**Local Deployment**: For developers and users running the TEA Platform locally, resetting involves clearing the local database file or using Django's database management commands. Instructions for clearing the database and starting afresh on your local development machine are provided in the [Local Reset Guide](local.md).

**Azure Cloud Deployment**: For instances deployed on Microsoft Azure or similar cloud services, the process may involve interacting with cloud database services and utilizing the Azure portal or CLI tools. The [Azure Reset Guide](azure.md) provides detailed instructions for resetting the database in this scenario.

## Additional Considerations

**Backup and Data Loss**: Always ensure that any valuable data is backed up before initiating a database reset. Data loss is irreversible once the reset process is complete.

**Security Practices**: Be mindful of security best practices, especially when handling database credentials and accessing cloud services.

**Deploying on Azure**: Refer back to the [deployment guide](../deployment/azure.md) if you need to reconfigure or redeploy the TEA Platform on Azure after resetting.
