# Creating a Legacy (OAuth) App on GitHub

1. **Login to GitHub**:
   Navigate to [GitHub](https://github.com/) and log in to your account.

2. **Access the Developer Settings**:
   - Click on your profile picture (top right corner).
   - From the dropdown menu, choose "Settings".
   - In the left sidebar, scroll down and select "Developer settings".

3. **Navigate to OAuth Apps**:
   - In the left sidebar of the Developer settings, click on "OAuth Apps".
   - This will show you a list of existing OAuth apps, if any. To create a new one, click on the "New OAuth App" button.

4. **Fill Out the Application Details**:
   - **Application name**: Enter "Assurance Platform".
   - **Homepage URL**: Enter `https://assuranceplatform.azurewebsites.net`.
   - **Application description**: This is optional, but you can provide a short description of your application here.
   - **Authorization callback URL**: Enter `http://assuranceplatform.azurewebsites.net/login`.

5. **Register the Application**:
   - After filling out the necessary details, click on the "Register application" button at the bottom.

6. **Note the Client ID and Client Secret**:
   - Once your application is registered, you'll be redirected to a page that displays your application's details.
   - Here, you'll find two important pieces of information: the `Client ID` and the `Client Secret`. Both are essential for integrating your application with GitHub OAuth.
   - **Important**: The `Client Secret` is only displayed once. Make sure to copy and save it securely. If you lose it, you'll need to reset it, which could disrupt any services using the current secret.

## Setting up GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in eap_backend/settings.py

1. **Navigate to Your Project**:
   - Navigate to the directory where your `eap_backend/settings.py` file is located.

2. **Edit the settings.py File**:
   - Open the `settings.py` file in a text editor or Integrated Development Environment (IDE) of your choice.

3. **Add/Update the Client ID and Client Secret**:
   - Find the section where environment variables or settings related to third-party integrations are defined. If the variables `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` already exist, update their values. If they don't, add them:
     ```python
     GITHUB_CLIENT_ID = 'your_client_id_here'
     GITHUB_CLIENT_SECRET = 'your_client_secret_here'
     ```

   - Replace `your_client_id_here` with the `Client ID` and `your_client_secret_here` with the `Client Secret` you obtained from GitHub.

4. **Save the Changes**:
   - After adding or updating the values, save the file.

5. **Restart Your Application**:
   - If your application or server is running, you'll likely need to restart it to ensure the changes take effect.

**Note**: Storing sensitive information like the `Client Secret` directly in the code is not recommended for production applications. It's better to use environment variables or secure secret management tools. The above instructions are for simplicity and clarity. For production, consider using secure methods to store and access your secrets.

e.g.,  `settings.py` should look like this:

```
GITHUB_CLIENT_ID = "xxxxx"
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")
```

and in your environment variables, you should have `GITHUB_CLIENT_SECRET` set to the value you got from GitHub.
