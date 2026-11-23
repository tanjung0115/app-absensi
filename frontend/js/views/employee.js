import { apiRequest } from "../api.js";
import {
  OFFICE_COORDS,
  emptyStateHtml,
  escapeHtml,
  formatDateId,
  formatTimeId,
  haversineMeters,
  openAbsensiDetailModal,
  openBuktiModal,
  showToast,
  statusBadge,
} from "../components.js";

function compressImageToDataUrl(source, maxW = 480) {
  const canvas = document.createElement("canvas");
  const ratio = source.width ? Math.min(1, maxW / source.width) : 1;
  canvas.width = Math.round((source.width || 480) * ratio);
  canvas.height = Math.round((source.height || 320) * ratio);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

export async function renderPresensiTab(container, _profile) {
  let selectedStatus = "hadir";
  let photoDataUrl = "";
  let lat = null;
  let long = null;
  let stream = null;
  let todayRecord = null;

  try {
    const { data } = await apiRequest("/riwayat", { query: { limit: 1, offset: 0 } });
    const todayIso = new Date().toISOString().slice(0, 10);
    if (Array.isArray(data) && data[0] && data[0].tanggal === todayIso) {
      todayRecord = data[0];
    }
  } catch {
    // Abaikan jika gagal memuat ringkasan hari ini
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  function updateGpsDisplay() {
    const gpsInfo = container.querySelector("#gps-info");
    if (!gpsInfo) return;
    if (lat === null || long === null) {
      gpsInfo.innerHTML = `<span class="small muted">Koordinat belum diambil.</span>`;
      return;
    }
    const dist = haversineMeters(lat, long, OFFICE_COORDS.lat, OFFICE_COORDS.long);
    const inRange = dist <= OFFICE_COORDS.maxMeters;
    const isWfh = selectedStatus === "wfh" || (todayRecord?.jam_masuk && !todayRecord?.jam_keluar && todayRecord?.status === "wfh");
    gpsInfo.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
        <span class="mono small">${lat.toFixed(6)}, ${long.toFixed(6)}</span>
        ${
          isWfh
            ? `<span class="badge badge-blue">${dist.toFixed(1)} m · WFH (Bebas lokasi)</span>`
            : `<span class="badge ${inRange ? "badge-green" : "badge-red"}">${dist.toFixed(1)} m · ${inRange ? "Dalam radius" : "Di luar radius 50 m"}</span>`
        }
      </div>
    `;
  }

  container.innerHTML = `
    <div class="hero-clock-card">
      <div>
        <div class="small" style="color: #bfd3c9; text-transform: uppercase; letter-spacing: 0.06em;">Waktu Lokal Saat Ini</div>
        <div class="hero-time" id="hero-live-time">--:--:--</div>
        <div class="hero-date" id="hero-live-date">-</div>
      </div>
      <div class="window-chips">
        <div class="window-chip">
          <span style="color:#bfd3c9;">Jam Normal Masuk</span>
          <strong>07:00 – 09:00</strong>
        </div>
        <div class="window-chip">
          <span style="color:#bfd3c9;">Jam Normal Pulang</span>
          <strong>16:00 – 18:00</strong>
        </div>
        <div class="window-chip">
          <span style="color:#bfd3c9;">Status Hari Ini</span>
          <strong>${
            todayRecord
              ? `${escapeHtml(todayRecord.status.toUpperCase())}${todayRecord.jam_keluar ? " (Lengkap)" : " (Masuk)"}`
              : "Belum Presensi"
          }</strong>
        </div>
      </div>
    </div>

    <div class="grid-asymmetric">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Bukti Foto &amp; Keterangan</h3>
          <span class="small muted">Wajib untuk Hadir, WFH, &amp; Clock-Out</span>
        </div>

        <div class="form-stack">
          <div class="field">
            <label>Jenis Kehadiran (Clock-In)</label>
            <div class="status-pills" id="status-pills">
              ${[
                { value: "hadir", label: "WFO" },
                { value: "wfh", label: "WFH" },
              ]
                .map(
                  (s) =>
                    `<button type="button" class="status-pill-btn ${s.value === selectedStatus ? "active" : ""}" data-status="${s.value}">${s.label}</button>`
                )
                .join("")}
            </div>
          </div>

          <div class="camera-box" id="camera-box">
            <div class="small muted" style="text-align:center; padding: 16px;">
              Belum ada foto diambil.<br />Aktifkan kamera atau unggah gambar.
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="start-cam-btn">Aktifkan Kamera</button>
            <button type="button" class="btn btn-primary btn-sm" id="snap-cam-btn" style="display:none;">Ambil Foto</button>
            <label class="btn btn-secondary btn-sm" style="margin:0;">
              Unggah Foto
              <input type="file" accept="image/*" id="upload-photo-input" hidden />
            </label>
            <button type="button" class="btn btn-secondary btn-sm" id="clear-photo-btn" style="display:none;">Hapus</button>
          </div>

          <div class="field">
            <label for="presensi-catatan">Keterangan / Catatan (wajib untuk Hadir &amp; WFH)</label>
            <textarea id="presensi-catatan" class="textarea" placeholder="Contoh: Hadir di kantor ruang IT, atau aktivitas WFH hari ini"></textarea>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Verifikasi Lokasi &amp; Aksi</h3>
        </div>

        <div class="form-stack">
          <div class="gps-box">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:13px;">Koordinat GPS</span>
              <span class="mono small muted">${OFFICE_COORDS.name}: ${OFFICE_COORDS.lat.toFixed(4)}, ${OFFICE_COORDS.long.toFixed(4)}</span>
            </div>
            <div id="gps-info"></div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px;">
              <button type="button" class="btn btn-secondary btn-sm" id="get-gps-btn">Ambil Lokasi GPS</button>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-top:4px;">
            <button type="button" class="btn ${todayRecord && todayRecord.jam_masuk && !todayRecord.jam_keluar ? "btn-secondary" : "btn-primary"}" id="clock-in-btn">Clock In</button>
            <button type="button" class="btn ${todayRecord && todayRecord.jam_masuk && !todayRecord.jam_keluar ? "btn-primary" : "btn-secondary"}" id="clock-out-btn">Clock Out</button>
          </div>

          ${
            todayRecord
              ? `
            <div style="border-top: 1px solid var(--border-hairline); padding-top: 14px; margin-top: 4px;">
              <div class="small" style="font-weight:600; margin-bottom:8px;">Ringkasan Presensi Hari Ini</div>
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;" class="small">
                <div><span class="muted">Masuk:</span> <span class="mono">${formatTimeId(todayRecord.jam_masuk)}</span></div>
                <div><span class="muted">Pulang:</span> <span class="mono">${formatTimeId(todayRecord.jam_keluar)}</span></div>
                <div><span class="muted">Status:</span> ${statusBadge(todayRecord.status)}</div>
                <div><span class="muted">Jarak:</span> <span class="mono">${todayRecord.jarak_masuk !== null ? `${todayRecord.jarak_masuk.toFixed(1)} m` : "-"}</span></div>
              </div>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </div>
  `;

  updateGpsDisplay();

  const tickClock = () => {
    const timeEl = container.querySelector("#hero-live-time");
    const dateEl = container.querySelector("#hero-live-date");
    if (!timeEl || !dateEl) return false;
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateEl.textContent = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return true;
  };
  tickClock();
  const clockInterval = setInterval(() => {
    if (!tickClock()) {
      clearInterval(clockInterval);
      stopCamera();
    }
  }, 1000);

  container.querySelectorAll("#status-pills .status-pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedStatus = btn.dataset.status;
      container.querySelectorAll("#status-pills .status-pill-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updateGpsDisplay();
    });
  });

  const camBox = container.querySelector("#camera-box");
  const startCamBtn = container.querySelector("#start-cam-btn");
  const snapCamBtn = container.querySelector("#snap-cam-btn");
  const clearPhotoBtn = container.querySelector("#clear-photo-btn");

  function showCapturedPhoto(url) {
    photoDataUrl = url;
    camBox.innerHTML = `<img src="${url}" alt="Foto presensi" />`;
    snapCamBtn.style.display = "none";
    clearPhotoBtn.style.display = "inline-flex";
  }

  startCamBtn.addEventListener("click", async () => {
    try {
      stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      const video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      camBox.innerHTML = "";
      camBox.appendChild(video);
      snapCamBtn.style.display = "inline-flex";
      clearPhotoBtn.style.display = "none";
    } catch {
      showToast("Kamera tidak tersedia atau izin ditolak. Silakan unggah foto.", "error");
    }
  });

  snapCamBtn.addEventListener("click", () => {
    const video = camBox.querySelector("video");
    if (!video) return;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth || 480;
    tempCanvas.height = video.videoHeight || 360;
    tempCanvas.getContext("2d").drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const dataUrl = compressImageToDataUrl(tempCanvas, 480);
    stopCamera();
    showCapturedPhoto(dataUrl);
  });

  container.querySelector("#upload-photo-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      stopCamera();
      showCapturedPhoto(compressImageToDataUrl(img, 480));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  });

  clearPhotoBtn.addEventListener("click", () => {
    photoDataUrl = "";
    stopCamera();
    camBox.innerHTML = `
      <div class="small muted" style="text-align:center; padding: 16px;">
        Belum ada foto diambil.<br />Aktifkan kamera atau unggah gambar.
      </div>
    `;
    clearPhotoBtn.style.display = "none";
  });

  container.querySelector("#get-gps-btn").addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Browser tidak mendukung Geolocation", "error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lat = pos.coords.latitude;
        long = pos.coords.longitude;
        updateGpsDisplay();
        showToast("Koordinat GPS berhasil diperbarui");
      },
      () => {
        showToast("Gagal membaca GPS. Pastikan izin lokasi aktif.", "error");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  function setActiveClockBtn(which) {
    const inBtn = container.querySelector("#clock-in-btn");
    const outBtn = container.querySelector("#clock-out-btn");
    if (!inBtn || !outBtn) return;
    if (which === "out") {
      inBtn.classList.remove("btn-primary");
      inBtn.classList.add("btn-secondary");
      outBtn.classList.remove("btn-secondary");
      outBtn.classList.add("btn-primary");
    } else {
      outBtn.classList.remove("btn-primary");
      outBtn.classList.add("btn-secondary");
      inBtn.classList.remove("btn-secondary");
      inBtn.classList.add("btn-primary");
    }
  }

  container.querySelector("#clock-in-btn").addEventListener("click", async () => {
    setActiveClockBtn("in");
    const catatan = container.querySelector("#presensi-catatan").value.trim();
    if (!photoDataUrl || !catatan) {
      showToast("Status Hadir dan WFH wajib melampirkan foto serta keterangan", "error");
      return;
    }
    if (selectedStatus === "hadir" && (lat === null || long === null)) {
      showToast("Status Hadir wajib mengambil koordinat lokasi GPS", "error");
      return;
    }
    const btn = container.querySelector("#clock-in-btn");
    btn.disabled = true;
    try {
      const { data } = await apiRequest("/clock-in", {
        method: "POST",
        body: {
          status: selectedStatus,
          foto_masuk: photoDataUrl || null,
          lat_masuk: lat,
          long_masuk: long,
          catatan,
        },
      });
      showToast(data.message || "Clock-in berhasil");
      stopCamera();
      renderPresensiTab(container, _profile);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
    }
  });

  container.querySelector("#clock-out-btn").addEventListener("click", async () => {
    setActiveClockBtn("out");
    if (!photoDataUrl || lat === null || long === null) {
      showToast("Clock-out wajib melampirkan foto dan koordinat lokasi", "error");
      return;
    }
    const catatan = container.querySelector("#presensi-catatan").value.trim() || null;
    const btn = container.querySelector("#clock-out-btn");
    btn.disabled = true;
    try {
      const { data } = await apiRequest("/clock-out", {
        method: "POST",
        body: {
          foto_keluar: photoDataUrl,
          lat_keluar: lat,
          long_keluar: long,
          catatan,
        },
      });
      showToast(data.message || "Clock-out berhasil");
      stopCamera();
      renderPresensiTab(container, _profile);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
    }
  });
}

export async function renderRiwayatTab(container) {
  let offset = 0;
  const limit = 20;

  async function load() {
    container.innerHTML = `<div class="card"><div class="muted small">Memuat riwayat presensi...</div></div>`;
    try {
      const { data, totalCount } = await apiRequest("/riwayat", { query: { limit, offset } });
      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div>
              <h3 class="card-title">Riwayat Presensi Pribadi</h3>
              <div class="small muted">Total ${totalCount} catatan kehadiran</div>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="prev-page" ${offset === 0 ? "disabled" : ""}>Sebelumnya</button>
              <button type="button" class="btn btn-secondary btn-sm" id="next-page" ${offset + limit >= totalCount ? "disabled" : ""}>Berikutnya</button>
            </div>
          </div>

          ${
            data.length === 0
              ? emptyStateHtml("Belum ada riwayat presensi", "Catatan clock-in dan clock-out Anda akan tampil di sini.")
              : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jam Masuk</th>
                    <th>Jam Pulang</th>
                    <th>Status</th>
                    <th>Jarak Masuk</th>
                    <th>Jarak Pulang</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  ${data
                    .map(
                      (row) => `
                    <tr data-riwayat-id="${row.id}" style="cursor:pointer;" title="Klik untuk lihat detail">
                      <td class="mono">${formatDateId(row.tanggal)}</td>
                      <td class="mono">${formatTimeId(row.jam_masuk)}</td>
                      <td class="mono">${formatTimeId(row.jam_keluar)}</td>
                      <td>${statusBadge(row.status)}</td>
                      <td class="mono">${row.jarak_masuk !== null ? `${row.jarak_masuk.toFixed(1)} m` : "-"}</td>
                      <td class="mono">${row.jarak_keluar !== null ? `${row.jarak_keluar.toFixed(1)} m` : "-"}</td>
                      <td>${escapeHtml(row.catatan || "-")}</td>
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

      container.querySelectorAll("[data-riwayat-id]").forEach((tr) => {
        tr.addEventListener("click", () => {
          const item = data.find((x) => String(x.id) === tr.dataset.riwayatId);
          if (item) openAbsensiDetailModal(item);
        });
      });

      container.querySelector("#prev-page")?.addEventListener("click", () => {
        offset = Math.max(0, offset - limit);
        load();
      });
      container.querySelector("#next-page")?.addEventListener("click", () => {
        offset += limit;
        load();
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}

export async function renderSuratTab(container) {
  let statusFilter = "";
  let buktiDataUrl = "";
  let buktiNama = "";

  async function load() {
    try {
      const { data } = await apiRequest("/surat", {
        query: { status: statusFilter || undefined, limit: 50 },
      });

      const todayIso = new Date().toISOString().slice(0, 10);
      container.innerHTML = `
        <div class="grid-asymmetric">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Daftar Surat Keterangan</h3>
              <select id="surat-filter-status" class="select" style="width:auto; padding:6px 10px; font-size:12.5px;">
                <option value="">Semua Status</option>
                <option value="pending" ${statusFilter === "pending" ? "selected" : ""}>Pending</option>
                <option value="diterima" ${statusFilter === "diterima" ? "selected" : ""}>Diterima</option>
                <option value="ditolak" ${statusFilter === "ditolak" ? "selected" : ""}>Ditolak</option>
              </select>
            </div>

            ${
              data.length === 0
                ? emptyStateHtml("Belum ada surat keterangan", "Ajukan izin, sakit, atau lupa absen melalui formulir di samping.")
                : `
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Jenis</th>
                      <th>Keterangan</th>
                      <th>Bukti</th>
                      <th>Status</th>
                      <th>Catatan Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data
                      .map(
                        (s) => `
                      <tr>
                        <td class="mono">${formatDateId(s.tanggal)}</td>
                        <td>${statusBadge(s.jenis)}</td>
                        <td>${escapeHtml(s.keterangan || "-")}</td>
                        <td>
                          ${
                            s.bukti
                              ? `<button type="button" class="btn btn-secondary btn-sm" data-view-bukti="${s.id}">Lihat ${s.bukti.startsWith("data:application/pdf") ? "PDF" : "Foto"}</button>`
                              : `<span class="small muted">-</span>`
                          }
                        </td>
                        <td>${statusBadge(s.status)}</td>
                        <td class="small muted">${escapeHtml(s.catatan_review || "-")}</td>
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

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Ajukan Surat Baru</h3>
            </div>
            <form id="surat-form" class="form-stack">
              <div class="field">
                <label for="surat-tanggal">Tanggal</label>
                <input id="surat-tanggal" type="date" class="input" value="${todayIso}" required />
              </div>

              <div class="field">
                <label for="surat-jenis">Jenis Keterangan</label>
                <select id="surat-jenis" class="select" required>
                  <option value="izin">Izin</option>
                  <option value="sakit">Sakit</option>
                  <option value="lupa">Lupa Absen</option>
                </select>
              </div>

              <div class="field">
                <label for="surat-bukti-input">Bukti Pendukung (Foto atau PDF)</label>
                <label class="btn btn-secondary btn-sm" style="margin:0; width:fit-content; cursor:pointer;">
                  Pilih Foto / Dokumen PDF
                  <input id="surat-bukti-input" type="file" accept="image/*,application/pdf" hidden />
                </label>
                <div id="surat-bukti-preview" class="small muted" style="margin-top:4px;">
                  Belum ada file dipilih (maks. PDF 2,5 MB).
                </div>
              </div>

              <div class="field">
                <label for="surat-ket">Keterangan / Alasan</label>
                <textarea id="surat-ket" class="textarea" maxlength="500" placeholder="Jelaskan alasan pengajuan Anda..." required></textarea>
              </div>

              <button type="submit" class="btn btn-primary btn-block" id="surat-submit-btn">Kirim Pengajuan</button>
            </form>
          </div>
        </div>
      `;

      container.querySelector("#surat-filter-status")?.addEventListener("change", (e) => {
        statusFilter = e.target.value;
        load();
      });

      container.querySelectorAll("[data-view-bukti]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const item = data.find((x) => String(x.id) === btn.dataset.viewBukti);
          if (item?.bukti) openBuktiModal(item.bukti, item.bukti_nama);
        });
      });

      const previewEl = container.querySelector("#surat-bukti-preview");
      container.querySelector("#surat-bukti-input")?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        buktiNama = file.name;

        if (file.type === "application/pdf") {
          if (file.size > 2.5 * 1024 * 1024) {
            showToast("Ukuran dokumen PDF maksimal 2,5 MB", "error");
            buktiDataUrl = "";
            buktiNama = "";
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            buktiDataUrl = String(reader.result || "");
            previewEl.innerHTML = `<span class="badge badge-blue">PDF: ${escapeHtml(buktiNama)}</span>`;
          };
          reader.readAsDataURL(file);
        } else if (file.type.startsWith("image/")) {
          const img = new Image();
          img.onload = () => {
            buktiDataUrl = compressImageToDataUrl(img, 900);
            URL.revokeObjectURL(img.src);
            previewEl.innerHTML = `<img src="${buktiDataUrl}" alt="Preview bukti" style="max-height:110px; border-radius:6px; border:1px solid var(--border-hairline); margin-top:4px;" />`;
          };
          img.src = URL.createObjectURL(file);
        } else {
          showToast("Format file harus berupa foto atau PDF", "error");
        }
      });

      container.querySelector("#surat-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const ket = container.querySelector("#surat-ket").value.trim();
        if (!buktiDataUrl) {
          showToast("Wajib melampirkan bukti foto atau dokumen PDF", "error");
          return;
        }
        if (!ket) {
          showToast("Keterangan / alasan wajib diisi", "error");
          return;
        }

        const btn = container.querySelector("#surat-submit-btn");
        btn.disabled = true;
        try {
          const { data: res } = await apiRequest("/surat", {
            method: "POST",
            body: {
              tanggal: container.querySelector("#surat-tanggal").value,
              jenis: container.querySelector("#surat-jenis").value,
              keterangan: ket,
              bukti: buktiDataUrl,
              bukti_nama: buktiNama || null,
            },
          });
          buktiDataUrl = "";
          buktiNama = "";
          showToast(res.message || "Surat berhasil diajukan");
          load();
        } catch (err) {
          showToast(err.message, "error");
          btn.disabled = false;
        }
      });
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  load();
}

export function renderProfileTab(container, profile, onProfileUpdated) {
  let pendingFoto = profile.foto || "";

  function renderAvatarContent(fotoVal) {
    return fotoVal
      ? `<img src="${escapeHtml(fotoVal)}" alt="${escapeHtml(profile.nama)}" />`
      : escapeHtml((profile.nama || "U").slice(0, 2).toUpperCase());
  }

  container.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Identitas Pegawai</h3>
          ${statusBadge(profile.status)}
        </div>
        <div style="display:flex; align-items:center; gap:16px; margin-bottom: 18px;">
          <div class="avatar" id="prof-avatar-preview" style="width:68px; height:68px; font-size:20px;">
            ${renderAvatarContent(pendingFoto)}
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:17px; font-weight:700;">${escapeHtml(profile.nama)}</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              <label class="btn btn-secondary btn-sm" style="margin:0; cursor:pointer;">
                Ubah Foto Profil
                <input type="file" accept="image/*" id="prof-foto-file" hidden />
              </label>
              ${
                pendingFoto
                  ? `<button type="button" class="btn btn-secondary btn-sm" id="prof-foto-remove">Hapus Foto</button>`
                  : ""
              }
            </div>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-hairline); padding-top: 14px; display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div>
            <div class="small muted">NIP</div>
            <div class="mono" style="font-weight:600; margin-top:2px;">${escapeHtml(profile.nip)}</div>
          </div>
          <div>
            <div class="small muted">Status Kepegawaian</div>
            <div style="font-weight:600; margin-top:2px; text-transform:capitalize;">${escapeHtml(profile.kepegawaian || "-")}</div>
          </div>
          <div>
            <div class="small muted">Divisi</div>
            <div style="font-weight:600; margin-top:2px;">${escapeHtml(profile.divisi || "-")}</div>
          </div>
          <div>
            <div class="small muted">Peran</div>
            <div style="font-weight:600; margin-top:2px; text-transform:capitalize;">${escapeHtml(profile.role)}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Perbarui Profil</h3>
        </div>
        <form id="profile-form" class="form-stack">
          <div class="field">
            <label for="prof-nip">NIP</label>
            <input id="prof-nip" class="input mono" type="text" value="${escapeHtml(profile.nip)}" disabled style="background:var(--bg-subtle); color:var(--ink-secondary);" />
          </div>

          <div class="field">
            <label for="prof-nama">Nama Lengkap</label>
            <input id="prof-nama" class="input" type="text" minlength="2" maxlength="100" value="${escapeHtml(profile.nama)}" required />
          </div>

          <div class="field">
            <label for="prof-kepegawaian">Status Kepegawaian</label>
            <select id="prof-kepegawaian" class="select">
              <option value="staff" ${profile.kepegawaian === "staff" ? "selected" : ""}>Staff</option>
              <option value="magang" ${profile.kepegawaian === "magang" ? "selected" : ""}>Magang</option>
            </select>
          </div>

          <div class="field">
            <label for="prof-divisi">Divisi</label>
            <input id="prof-divisi" class="input" type="text" maxlength="100" value="${escapeHtml(profile.divisi || "")}" placeholder="Contoh: IT, Keuangan, Operasional" />
          </div>

          <button type="submit" class="btn btn-primary" id="prof-save-btn">Simpan Perubahan</button>
        </form>
      </div>
    </div>
  `;

  async function saveProfile(extra = {}) {
    const { data } = await apiRequest("/profile", {
      method: "PUT",
      body: {
        nama: container.querySelector("#prof-nama").value.trim(),
        kepegawaian: container.querySelector("#prof-kepegawaian").value,
        divisi: container.querySelector("#prof-divisi").value.trim(),
        foto: pendingFoto,
        ...extra,
      },
    });
    return data;
  }

  container.querySelector("#prof-foto-file")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = async () => {
      pendingFoto = compressImageToDataUrl(img, 320);
      URL.revokeObjectURL(img.src);
      container.querySelector("#prof-avatar-preview").innerHTML = renderAvatarContent(pendingFoto);
      try {
        const updated = await saveProfile({ foto: pendingFoto });
        showToast("Foto profil berhasil diperbarui");
        onProfileUpdated(updated);
      } catch (err) {
        showToast(err.message, "error");
      }
    };
    img.src = URL.createObjectURL(file);
  });

  container.querySelector("#prof-foto-remove")?.addEventListener("click", async () => {
    pendingFoto = "";
    try {
      const updated = await saveProfile({ foto: "" });
      showToast("Foto profil dihapus");
      onProfileUpdated(updated);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  container.querySelector("#profile-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = container.querySelector("#prof-save-btn");
    btn.disabled = true;
    try {
      const updated = await saveProfile();
      showToast("Profil berhasil diperbarui");
      onProfileUpdated(updated);
    } catch (err) {
      showToast(err.message, "error");
      btn.disabled = false;
    }
  });
}
