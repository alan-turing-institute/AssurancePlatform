'use client'

type TokenHookReturnType = [string | null, (value: any) => void];

/**
 * Enforce that the user is logged in.
 *
 * @returns {boolean} Whether the user is logged in.
 */
export function useEnforceLogin() {
  const [token] = useLoginToken();

  if (token == null) {
    window.location.replace("/");
    
    return false;
  }

  return true;
}

/**
 * Enforce that the user is logged out.
 *
 * @returns {boolean} Whether the user is logged out.
 */
export function useEnforceLogout() {
  const [token] = useLoginToken();

  if (token != null) {
    window.location.replace("/");
    return false;
  }

  return true;
}

/**
 * Redirect the user to the login page if they are not logged in.
 *
 * @returns {void}
 */
export function unauthorized() {
  window.location.replace("/logout/expired");
}

/**
 * Set the user's login token. The token is stored in local storage.
 *
 * @param {string} value - The token to set.
 * @returns {void}
 */
const setToken = (value: any) => {
  localStorage.clear();

  if (value) {
    localStorage.setItem("token", value);
  }

  return null
}

/**
 * Get the user's login token. The token is stored in local storage.
 *
 * @returns {[string, function]} The user's login token and a function to set the token.
 */
export function useLoginToken(): TokenHookReturnType {
  let token = null
  if (typeof window !== 'undefined') {
    token = localStorage.getItem("token");
  }
  return [token, setToken];
}