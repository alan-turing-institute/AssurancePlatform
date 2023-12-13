export function useEnforceLogin() {
  const [token] = useLoginToken();

  if (token == null) {
    window.location.replace("/login");
    return false;
  }

  return true;
}

export function useEnforceLogout() {
  const [token] = useLoginToken();

  if (token != null) {
    window.location.replace("/");
    return false;
  }

  return true;
}

function setToken(value) {
  localStorage.clear();

  if (value) {
    localStorage.setItem("token", value);
  }
}

/** @returns {[string?, (value: string?) => void]} */
export function useLoginToken() {
  const token = localStorage.getItem("token");

  return [token, setToken];
}
