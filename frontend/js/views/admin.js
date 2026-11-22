import { apiRequest, downloadExcelExport } from "../api.js";
import {
  closeModal,
  emptyStateHtml,
  escapeHtml,
  formatDateId,
  formatTimeId,
  openModal,
  renderTrendsSvgChart,
  showToast,
  statusBadge,
} from "../components.js";

export async function renderAdminDashboardTab(container, onNavigate) {
  let selectedYear = new Date().getFullYear();

  async function load() {
    container.innerHTML = `<div class="card"><div class="muted small">Memuat ringkasan admin...</div></div>`;
    try {
      const [{ data: summary }, { data: trends }] = await Promise.all([
        apiRequest("/admin/dashboard"),
        apiRequest("/admin/dashboard/trends", { query: { tahun: selectedYear } }),
      ]);

      const years = [selectedYear - 1, selectedYear, selectedYear + 1];

      container.innerHTML = `
        <div class="kpi-strip">
          <div class="kpi-card">
            <div class="kpi-label">Total Pegawai</div>
            <div class="kpi-value">${summary.total_user_aktif}</div>
            <div class="kpi-foot">Pegawai berstatus aktif</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Menunggu Persetujuan</div>
            <div class="kpi-value" style="color: ${summary.total_user_pending > 0 ? "var(--amber)" : "inherit"};">
              ${summary.total_user_pending}
            </div>
            <div class="kpi-foot">Registrasi pegawai baru</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Surat Pending</div>
            <div class="kpi-value" style="color: ${summary.total_surat_pending > 0 ? "var(--amber)" : "inherit"};">
              ${summary.total_surat_pending}
            </div>
            <div class="kpi-foot">Izin / sakit / lupa absen</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Presensi Hari Ini</div>
            <div class="kpi-value" style="color: var(--brand);">${summary.total_absensi_hari_ini}</div>
            <div class="kpi-foot">Tercatat pada tanggal hari ini</div>
          </div>
        </div>

        <div class="grid-asymmetric">
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Tren Presensi &amp; Surat (${trends.tahun})</h3>
                <div class="small muted">Distribusi bulanan selama satu tahun</div>
              </div>
              <select id="trend-year-select" class="select" style="width:auto; padding:6px 10px; font-size:12.5px;">
                ${years.map((y) => `<option value="${y}" ${y === selectedYear ? "selected" : ""}>${y}</option>`).join("")}
              </select>
            </div>
            ${renderTrendsSvgChart(trends.tren || [])}
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Tindakan Cepat</h3>
            </div>
            <div class="form-stack">
              <div style="padding:12px; border:1px solid var(--border-hairline); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <div style="font-weight:600;">Verifikasi Pegawai</div>
                  <div class="small muted">${summary.total_user_pending} akun menunggu</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="jump-users">Buka</button>
              </div>

              <div style="padding:12px; border:1px solid var(--border-hairline); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <div style="font-weight:600;">Tinjau Surat Keterangan</div>
                  <div class="small muted">${summary.total_surat_pending} surat pending</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="jump-surat">Buka</button>
              </div>

              <div style="padding:12px; border:1px solid var(--border-hairline); border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                <div>
                  <div style="font-weight:600;">Rekap &amp; Ekspor Excel</div>
                  <div class="small muted">Unduh laporan kehadiran</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" id="jump-rekap">Buka</button>
              </div>
            </div>
          </div>
        </div>
      `;

      container.querySelector("#trend-year-select")?.addEventListener("change", (e) => {
        selectedYear = Number(e.target.value);
        load();
      });
      container.querySelector("#jump-users")?.addEventListener("click", () => onNavigate("admin-users"));
      container.querySelector("#jump-surat")?.addEventListener("click", () => onNavigate("admin-surat"));
      container.querySelector("#jump-rekap")?.addEventListener("click", () => onNavigate("admin-rekap"));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}

export async function renderAdminUsersTab(container) {
  let statusFilter = "";

  async function load() {
    container.innerHTML = `<div class="card"><div class="muted small">Memuat daftar pegawai...</div></div>`;
    try {
      const { data, totalCount } = await apiRequest("/users", {
        query: { status: statusFilter || undefined, limit: 100 },
      });

      container.innerHTML = `
        <div class="card">
          <div class="toolbar">
            <div>
              <h3 class="card-title">Verifikasi &amp; Daftar Pegawai</h3>
              <div class="small muted">${totalCount} pegawai ditemukan</div>
            </div>
            <div class="filter-group">
              <select id="user-status-filter" class="select">
                <option value="">Semua Status</option>
                <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
                <option value="aktif" ${statusFilter === "aktif" ? "selected" : ""}>Aktif</option>
                <option value="ditolak" ${statusFilter === "ditolak" ? "selected" : ""}>Ditolak</option>
              </select>
            </div>
          </div>

          ${
            data.length === 0
              ? emptyStateHtml("Tidak ada data pegawai", "Belum ada pegawai yang sesuai filter ini.")
              : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>NIP</th>
                    <th>Nama</th>
                    <th>Kepegawaian</th>
                    <th>Status</th>
                    <th style="text-align:right;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${data
                    .map(
                      (u) => `
                    <tr>
                      <td class="mono">${escapeHtml(u.nip)}</td>
                      <td style="font-weight:600;">${escapeHtml(u.nama)}</td>
                      <td>${escapeHtml(u.kepegawaian || "-")}</td>
                      <td>${statusBadge(u.status)}</td>
                      <td style="text-align:right; white-space:nowrap;">
                        ${
                          u.status !== "aktif"
                            ? `<button type="button" class="btn btn-primary btn-sm" data-approve="${u.id}">Aktifkan</button>`
                            : ""
                        }
                        ${
                          u.status !== "ditolak"
                            ? `<button type="button" class="btn btn-danger btn-sm" data-reject="${u.id}">Tolak</button>`
                            : ""
                        }
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;

      container.querySelector("#user-status-filter")?.addEventListener("change", (e) => {
        statusFilter = e.target.value;
        load();
      });

      const handleApprove = async (userId, status) => {
        try {
          const { data: res } = await apiRequest("/approve-user", {
            method: "PUT",
            body: { user_id: Number(userId), status },
          });
          showToast(res.message || "Status pegawai diperbarui");
          load();
        } catch (err) {
          showToast(err.message, "error");
        }
      };

      container.querySelectorAll("[data-approve]").forEach((btn) => {
        btn.addEventListener("click", () => handleApprove(btn.dataset.approve, "aktif"));
      });
      container.querySelectorAll("[data-reject]").forEach((btn) => {
        btn.addEventListener("click", () => handleApprove(btn.dataset.reject, "ditolak"));
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}

export async function renderAdminSuratTab(container) {
  let statusFilter = "";
  let jenisFilter = "";

  async function load() {
    container.innerHTML = `<div class="card"><div class="muted small">Memuat pengajuan surat...</div></div>`;
    try {
      const { data, totalCount } = await apiRequest("/surat", {
        query: {
          status: statusFilter || undefined,
          jenis: jenisFilter || undefined,
          limit: 100,
        },
      });

      container.innerHTML = `
        <div class="card">
          <div class="toolbar">
            <div>
              <h3 class="card-title">Tinjauan Surat Keterangan</h3>
              <div class="small muted">${totalCount} surat tercatat</div>
            </div>
            <div class="filter-group">
              <select id="admin-surat-status" class="select">
                <option value="">Semua Status</option>
                <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
                <option value="diterima" ${statusFilter === "diterima" ? "selected" : ""}>Diterima</option>
                <option value="ditolak" ${statusFilter === "ditolak" ? "selected" : ""}>Ditolak</option>
              </select>
              <select id="admin-surat-jenis" class="select">
                <option value="">Semua Jenis</option>
                <option value="izin" ${jenisFilter === "izin" ? "selected" : ""}>Izin</option>
                <option value="sakit" ${jenisFilter === "sakit" ? "selected" : ""}>Sakit</option>
                <option value="lupa" ${jenisFilter === "lupa" ? "selected" : ""}>Lupa Absen</option>
              </select>
            </div>
          </div>

          ${
            data.length === 0
              ? emptyStateHtml("Belum ada pengajuan surat", "Surat izin, sakit, atau lupa absen dari pegawai akan muncul di sini.")
              : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Tanggal</th>
                    <th>Jenis</th>
                    <th>Keterangan</th>
                    <th>Status</th>
                    <th>Catatan Review</th>
                    <th style="text-align:right;">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${data
                    .map(
                      (s) => `
                    <tr>
                      <td>
                        <div style="font-weight:600;">${escapeHtml(s.nama)}</div>
                        <div class="mono small muted">${escapeHtml(s.nip)}</div>
                      </td>
                      <td class="mono">${formatDateId(s.tanggal)}</td>
                      <td>${statusBadge(s.jenis)}</td>
                      <td>${escapeHtml(s.keterangan || "-")}</td>
                      <td>${statusBadge(s.status)}</td>
                      <td class="small muted">${escapeHtml(s.catatan_review || "-")}</td>
                      <td style="text-align:right;">
                        <button type="button" class="btn btn-secondary btn-sm" data-review="${s.id}">Tinjau</button>
                      </td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;

      container.querySelector("#admin-surat-status")?.addEventListener("change", (e) => {
        statusFilter = e.target.value;
        load();
      });
      container.querySelector("#admin-surat-jenis")?.addEventListener("change", (e) => {
        jenisFilter = e.target.value;
        load();
      });

      container.querySelectorAll("[data-review]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = data.find((x) => String(x.id) === btn.dataset.review);
          if (!item) return;

          openModal({
            title: `Tinjau Surat — ${item.nama}`,
            bodyHtml: `
              <div class="form-stack">
                <div class="small muted">
                  Tanggal: <span class="mono">${formatDateId(item.tanggal)}</span> · Jenis: <strong>${escapeHtml(item.jenis)}</strong>
                </div>
                <div style="padding:10px 12px; background:var(--bg-subtle); border-radius:8px; font-size:13px;">
                  ${escapeHtml(item.keterangan || "Tidak ada keterangan tambahan.")}
                </div>
                <div class="field">
                  <label for="rev-status">Keputusan</label>
                  <select id="rev-status" class="select">
                    <option value="diterima">Terima Surat</option>
                    <option value="ditolak">Tolak Surat</option>
                  </select>
                </div>
                <div class="field">
                  <label for="rev-note">Catatan Review (opsional)</label>
                  <textarea id="rev-note" class="textarea" maxlength="500" placeholder="Tambahkan catatan untuk pegawai...">${escapeHtml(item.catatan_review || "")}</textarea>
                </div>
                <div class="modal-actions">
                  <button type="button" class="btn btn-secondary" id="rev-cancel">Batal</button>
                  <button type="button" class="btn btn-primary" id="rev-save">Simpan Keputusan</button>
                </div>
              </div>
            `,
            onMount: (modalBody) => {
              modalBody.querySelector("#rev-cancel")?.addEventListener("click", closeModal);
              modalBody.querySelector("#rev-save")?.addEventListener("click", async () => {
                const status = modalBody.querySelector("#rev-status").value;
                const catatan_review = modalBody.querySelector("#rev-note").value.trim() || null;
                try {
                  const { data: res } = await apiRequest(`/surat/${item.id}/review`, {
                    method: "PUT",
                    body: { status, catatan_review },
                  });
                  showToast(res.message || "Surat berhasil ditinjau");
                  closeModal();
                  load();
                } catch (err) {
                  showToast(err.message, "error");
                }
              });
            },
          });
        });
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}

export async function renderAdminRekapTab(container) {
  const now = new Date();
  let bulan = String(now.getMonth() + 1);
  let tahun = String(now.getFullYear());
  let nama = "";
  let kepegawaian = "";

  async function load() {
    container.innerHTML = `<div class="card"><div class="muted small">Memuat rekap presensi...</div></div>`;
    try {
      const query = {
        bulan: bulan || undefined,
        tahun: tahun || undefined,
        nama: nama || undefined,
        kepegawaian: kepegawaian || undefined,
        limit: 100,
      };
      const { data, totalCount } = await apiRequest("/rekap", { query });

      container.innerHTML = `
        <div class="card">
          <div class="toolbar">
            <div>
              <h3 class="card-title">Rekap Presensi Pegawai</h3>
              <div class="small muted">${totalCount} data sesuai filter</div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" id="export-xlsx-btn">Ekspor Excel (.xlsx)</button>
          </div>

          <form id="rekap-filter-form" class="filter-group" style="margin-bottom: 14px;">
            <select id="rek-bulan" class="select">
              <option value="">Semua Bulan</option>
              ${Array.from({ length: 12 }, (_, i) => i + 1)
                .map((m) => `<option value="${m}" ${String(m) === bulan ? "selected" : ""}>Bulan ${m}</option>`)
                .join("")}
            </select>
            <input id="rek-tahun" class="input" type="number" min="2000" max="2100" value="${escapeHtml(tahun)}" placeholder="Tahun" style="width:95px;" />
            <input id="rek-nama" class="input" type="text" value="${escapeHtml(nama)}" placeholder="Cari nama..." />
            <select id="rek-kepegawaian" class="select">
              <option value="">Semua Kepegawaian</option>
              <option value="staff" ${kepegawaian === "staff" ? "selected" : ""}>Staff</option>
              <option value="magang" ${kepegawaian === "magang" ? "selected" : ""}>Magang</option>
            </select>
            <button type="submit" class="btn btn-secondary btn-sm">Terapkan</button>
          </form>

          ${
            data.length === 0
              ? emptyStateHtml("Tidak ada data rekap", "Ubah filter bulan, tahun, atau nama pegawai untuk melihat data.")
              : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Pegawai</th>
                    <th>Kepegawaian</th>
                    <th>Tanggal</th>
                    <th>Masuk</th>
                    <th>Pulang</th>
                    <th>Status</th>
                    <th>Jarak</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  ${data
                    .map(
                      (r) => `
                    <tr>
                      <td>
                        <div style="font-weight:600;">${escapeHtml(r.nama)}</div>
                        <div class="mono small muted">${escapeHtml(r.nip)}</div>
                      </td>
                      <td>${escapeHtml(r.kepegawaian || "-")}</td>
                      <td class="mono">${formatDateId(r.tanggal)}</td>
                      <td class="mono">${formatTimeId(r.jam_masuk)}</td>
                      <td class="mono">${formatTimeId(r.jam_keluar)}</td>
                      <td>${statusBadge(r.status)}</td>
                      <td class="mono small">${r.jarak_masuk !== null ? `${r.jarak_masuk.toFixed(1)} m` : "-"}</td>
                      <td class="small">${escapeHtml(r.catatan || "-")}</td>
                    </tr>
                  `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          }
        </div>
      `;

      container.querySelector("#rekap-filter-form")?.addEventListener("submit", (e) => {
        e.preventDefault();
        bulan = container.querySelector("#rek-bulan").value;
        tahun = container.querySelector("#rek-tahun").value.trim();
        nama = container.querySelector("#rek-nama").value.trim();
        kepegawaian = container.querySelector("#rek-kepegawaian").value;
        load();
      });

      container.querySelector("#export-xlsx-btn")?.addEventListener("click", async () => {
        try {
          await downloadExcelExport({
            bulan: bulan || undefined,
            tahun: tahun || undefined,
            nama: nama || undefined,
            kepegawaian: kepegawaian || undefined,
          });
          showToast("File Excel berhasil diunduh");
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}
