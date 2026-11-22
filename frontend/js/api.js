export function isAdminPortal() {
  return window.location.pathname.startsWith("/admin");
}

function getTokenKey() {
  return isAdminPortal() ? "absensi_admin_jwt_token" : "absensi_jwt_token";
}

export function getToken() {
  return localStorage.getItem(getTokenKey()) || "";
}

export function setToken(token) {
  const key = getTokenKey();
  if (token) {
    localStorage.setItem(key, token);
  } else {
    localStorage.removeItem(key);
  }
}

export async function apiRequest(path, options = {}) {
  const { method = "GET", body = null, query = null, auth = true } = options;

  let url = path;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") {
        params.append(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = {};
  if (body !== null) {
    headers["Content-Type"] = "application/json";
  }
  if (auth && getToken()) {
    headers["Authorization"] = `Bearer ${getToken()}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth) {
    setToken("");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    let message = "Terjadi kesalahan pada server";
    if (data && typeof data === "object" && data.detail) {
      if (Array.isArray(data.detail)) {
        message = data.detail.map((e) => e.msg || JSON.stringify(e)).join(", ");
      } else {
        message = String(data.detail);
      }
    } else if (typeof data === "string" && data.trim()) {
      message = data;
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return {
    data,
    totalCount: Number(res.headers.get("X-Total-Count") || 0),
  };
}

export async function downloadExcelExport(query = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      params.append(k, String(v));
    }
  }
  const url = `/export${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
  });
  if (!res.ok) {
    throw new Error("Gagal mengunduh file rekap Excel");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : `rekap_presensi.xlsx`;

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
