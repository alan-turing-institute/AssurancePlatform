# Django Settings for the TEA Platform

This section details the Django framework settings essential for the TEA Platform's operation. It guides you through configuring settings for different environments, such as development, testing, and production, including database configurations, security enhancements, and application-specific options.

## Security and Environment Configuration

`SECRET_KEY`: A critical setting that should be unique and kept secret in production environments. Ensure that it is not stored in version control and is generated uniquely for each deployment.

`DEBUG`: This setting controls whether Django runs in debug mode. It should be set to False in production to avoid exposing sensitive information.

`CORS_ORIGIN_WHITELIST`: Specifies the hosts allowed to make cross-origin requests to your Django backend. For local development with the React frontend, this typically includes localhost:3000.

## Database Settings

The TEA Platform supports both SQLite (for development and testing) and PostgreSQL (recommended for production). Database configurations can be adjusted based on the environment variables:

**SQLite**: Used by default if no environment variables are set. Ideal for development and testing phases.

    ```python
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
    ```

**PostgreSQL**: For production, environment variables such as DBHOST, DBNAME, DBUSER, and DBPASSWORD need to be defined. This setup enhances the platform's scalability and security in production deployments.

    ```python
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "HOST": os.environ.get("DBHOST"),
            "NAME": os.environ.get("DBNAME"),
            "USER": os.environ.get("DBUSER"),
            "PASSWORD": os.environ.get("DBPASSWORD"),
        }
    }
    ```

## Application and Middleware Configuration

`INSTALLED_APPS`: Includes Django's default apps and third-party apps such as rest_framework for the REST API functionality, corsheaders for handling Cross-Origin Resource Sharing (CORS) settings, and allauth for authentication.

`MIDDLEWARE`: A series of middleware classes that process request/response objects. It includes CorsMiddleware for managing CORS headers according to your `CORS_ORIGIN_WHITELIST`.

## REST Framework and Authentication

`REST_FRAMEWORK`: Configures the default permissions and authentication classes. For instance, using `rest_framework.permissions.AllowAny` to allow unrestricted access or `rest_framework.authentication.TokenAuthentication` for API token-based authentication.

## Static and Media Files

`STATIC_URL`: Defines the URL path for serving static files (CSS, JavaScript, images).

## Additional Settings

`LANGUAGE_CODE` and `TIME_ZONE`: Adjust these settings to match your locale and timezone preferences.

`EMAIL_BACKEND`: Configures the backend to use for sending emails. For development, using `django.core.mail.backends.console.EmailBackend` logs emails to the console instead of sending them.

## Adjusting Settings for Different Environments

For a seamless transition between development, testing, and production environments, consider using environment variables to dynamically adjust settings. Utilize Django's `os.environ.get()` to fetch environment variables and apply conditional logic to switch between different database backends or to toggle the `DEBUG` setting.

## Final Thoughts

Properly configuring the Django settings is crucial for the security, performance, and functionality of the TEA Platform. Ensure sensitive settings like `SECRET_KEY` are securely managed and that the database configurations are appropriate for your deployment environment.
