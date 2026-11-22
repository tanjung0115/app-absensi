import { apiRequest, getToken, isAdminPortal, setToken } from "./api.js";
import { escapeHtml, showToast } from "./components.js";
import { renderAuthView } from "./views/auth.js";
import {
  renderPresensiTab,
  renderProfileTab,
  renderRiwayatTab,
  renderSuratTab,
} from "./views/employee.js";
import {
  renderAdminDashboardTab,
  renderAdminRekapTab,
  renderAdminSuratTab,
  renderAdminUsersTab,
} from "./views/admin.js";

const ICONS = {
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 3 5-6"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  table: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/></svg>`,
};

const appRoot = document.getElementById("app");
let currentProfile = null;
let currentTab = "";

function getNavItems(role) {
  if (role === "admin") {
    return [
      { id: "admin-dashboard", label: "Ringkasan", subtitle: "Statistik kehadiran & tren tahunan", icon: ICONS.chart },
      { id: "admin-users", label: "Verifikasi Pegawai", subtitle: "Persetujuan akun & status kepegawaian", icon: ICONS.users },
      { id: "admin-surat", label: "Tinjau Surat", subtitle: "Kelola pengajuan izin, sakit, & lupa absen", icon: ICONS.file },
      { id: "admin-rekap", label: "Rekap & Ekspor", subtitle: "Laporan presensi bulanan & ekspor Excel", icon: ICONS.table },
      { id: "profil", label: "Profil Saya", subtitle: "Informasi akun & pengaturan identitas", icon: ICONS.user },
    ];
  }
  return [
    { id: "presensi", label: "Presensi Hari Ini", subtitle: "Catat kehadiran masuk & pulang dengan lokasi", icon: ICONS.clock },
    { id: "riwayat", label: "Riwayat Presensi", subtitle: "Daftar catatan kehadiran pribadi", icon: ICONS.list },
    { id: "surat", label: "Surat Keterangan", subtitle: "Pengajuan izin, sakit, & lupa absen", icon: ICONS.file },
    { id: "profil", label: "Profil Saya", subtitle: "Informasi akun & pengaturan kepegawaian", icon: ICONS.user },
  ];
}

function renderShell() {
  const navItems = getNavItems(currentProfile.role);
  if (!navItems.some((n) => n.id === currentTab)) {
    currentTab = navItems[0].id;
  }
  const activeMeta = navItems.find((n) => n.id === currentTab) || navItems[0];
  const initials = (currentProfile.nama || "U").slice(0, 2).toUpperCase();

  appRoot.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div>
          <div class="sidebar-head">
            <div class="brand-mark"><img src="/static/assets/logo.png" alt="Logo Absensi Pegawai" /></div>
            <div>
              <div class="sidebar-title">Absensi Pegawai</div>
              <div class="sidebar-sub">${currentProfile.role === "admin" ? "Panel Administrator" : "Portal Pegawai"}</div>
            </div>
          </div>

          <div class="nav-section-label">Menu Utama</div>
          <nav class="nav-list">
            ${navItems
              .map(
                (item) => `
              <button type="button" class="nav-item ${item.id === currentTab ? "active" : ""}" data-nav="${item.id}">
                ${item.icon}
                <span>${escapeHtml(item.label)}</span>
              </button>
            `
              )
              .join("")}
          </nav>
        </div>

        <div class="sidebar-foot">
          <button type="button" class="user-chip" data-nav="profil" title="Buka Profil Saya">
            <div class="avatar">
              ${
                currentProfile.foto
                  ? `<img src="${escapeHtml(currentProfile.foto)}" alt="${escapeHtml(currentProfile.nama)}" />`
                  : escapeHtml(initials)
              }
            </div>
            <div style="min-width:0;">
              <div style="font-weight:600; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(currentProfile.nama)}
              </div>
              <div class="mono small muted" style="font-size:11.5px;">${escapeHtml(currentProfile.nip)}</div>
            </div>
          </button>
          <button type="button" class="btn btn-secondary btn-sm btn-block" id="logout-btn">Keluar</button>
        </div>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <div class="topbar-title">
            <h2>${escapeHtml(activeMeta.label)}</h2>
            <p>${escapeHtml(activeMeta.subtitle)}</p>
          </div>
          <div class="topbar-clock">
            <div class="clock-pill" id="topbar-clock-pill">--:--</div>
          </div>
        </header>

        <main class="page-content" id="page-content"></main>
      </div>
    </div>

    <nav class="mobile-nav">
      ${navItems
        .slice(0, 4)
        .map(
          (item) => `
        <button type="button" class="${item.id === currentTab ? "active" : ""}" data-nav="${item.id}">
          ${item.icon}
          <span>${escapeHtml(item.label.split(" ")[0])}</span>
        </button>
      `
        )
        .join("")}
    </nav>
  `;

  appRoot.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentTab = btn.dataset.nav;
      renderShell();
    });
  });

  appRoot.querySelector("#logout-btn")?.addEventListener("click", () => {
    setToken("");
    currentProfile = null;
    currentTab = "";
    showToast("Anda telah keluar");
    boot();
  });

  const topClock = appRoot.querySelector("#topbar-clock-pill");
  const updateTopClock = () => {
    if (!topClock || !document.body.contains(topClock)) return false;
    topClock.textContent = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return true;
  };
  updateTopClock();
  const topInterval = setInterval(() => {
    if (!updateTopClock()) clearInterval(topInterval);
  }, 15000);

  const pageContent = appRoot.querySelector("#page-content");
  const navigateTo = (tabId) => {
    currentTab = tabId;
    renderShell();
  };

  if (currentTab === "presensi") {
    renderPresensiTab(pageContent, currentProfile);
  } else if (currentTab === "riwayat") {
    renderRiwayatTab(pageContent);
  } else if (currentTab === "surat") {
    renderSuratTab(pageContent);
  } else if (currentTab === "profil") {
    renderProfileTab(pageContent, currentProfile, (updated) => {
      currentProfile = updated;
      renderShell();
    });
  } else if (currentTab === "admin-dashboard") {
    renderAdminDashboardTab(pageContent, navigateTo);
  } else if (currentTab === "admin-users") {
    renderAdminUsersTab(pageContent);
  } else if (currentTab === "admin-surat") {
    renderAdminSuratTab(pageContent);
  } else if (currentTab === "admin-rekap") {
    renderAdminRekapTab(pageContent);
  }
}

async function boot() {
  if (!getToken()) {
    renderAuthView(appRoot, boot);
    return;
  }

  try {
    const { data } = await apiRequest("/profile");
    if (isAdminPortal() && data.role !== "admin") {
      setToken("");
      showToast("Akses ditolak: halaman ini khusus administrator", "error");
      renderAuthView(appRoot, boot);
      return;
    }
    if (!isAdminPortal() && data.role === "admin") {
      setToken("");
      showToast("Akun admin silakan masuk melalui /admin", "error");
      renderAuthView(appRoot, boot);
      return;
    }
    currentProfile = data;
    renderShell();
  } catch {
    setToken("");
    renderAuthView(appRoot, boot);
  }
}

boot();
