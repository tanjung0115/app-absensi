export const OFFICE_COORDS = {
  lat: -6.957466,
  long: 107.688987,
  maxMeters: 50,
  name: "PT. Validata Teknologi",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function showToast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : ""}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 3800);
}

export function closeModal() {
  const root = document.getElementById("modal-root");
  if (root) root.innerHTML = "";
}

export function openModal({ title, bodyHtml, onMount }) {
  const root = document.getElementById("modal-root");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal-card" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="modal-close-btn">Tutup</button>
        </div>
        <div id="modal-body">${bodyHtml}</div>
      </div>
    </div>
  `;

  root.querySelector("#modal-close-btn")?.addEventListener("click", closeModal);
  root.querySelector("#modal-backdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-backdrop") closeModal();
  });

  if (typeof onMount === "function") {
    onMount(root.querySelector("#modal-body"));
  }
}

export function openBuktiModal(bukti, buktiNama = "bukti") {
  if (!bukti) return;
  const isPdf = bukti.startsWith("data:application/pdf");
  openModal({
    title: `Bukti Pendukung — ${buktiNama || (isPdf ? "Dokumen PDF" : "Foto")}`,
    bodyHtml: `
      <div class="form-stack">
        ${
          isPdf
            ? `<iframe src="${bukti}" style="width:100%; height:420px; border:1px solid var(--border-hairline); border-radius:8px;"></iframe>`
            : `<img src="${bukti}" alt="Bukti surat" style="width:100%; max-height:420px; object-fit:contain; border-radius:8px; background:var(--bg-subtle);" />`
        }
        <div class="modal-actions">
          <a href="${bukti}" download="${escapeHtml(buktiNama || (isPdf ? "bukti.pdf" : "bukti.jpg"))}" class="btn btn-secondary btn-sm">Unduh File</a>
          <button type="button" class="btn btn-primary btn-sm" id="bukti-close-btn">Tutup</button>
        </div>
      </div>
    `,
    onMount: (body) => {
      body.querySelector("#bukti-close-btn")?.addEventListener("click", closeModal);
    },
  });
}

export function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    aktif: "badge-green",
    hadir: "badge-green",
    telat: "badge-amber",
    diterima: "badge-green",
    pending: "badge-amber",
    izin: "badge-amber",
    sakit: "badge-amber",
    lupa: "badge-amber",
    wfh: "badge-blue",
    ditolak: "badge-red",
    absen: "badge-red",
  };
  const cls = map[s] || "badge-neutral";
  return `<span class="badge ${cls}">${escapeHtml(s || "-")}</span>`;
}

export function formatDateId(isoDate) {
  if (!isoDate) return "-";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatTimeId(isoDatetime) {
  if (!isoDatetime) return "-";
  const d = new Date(isoDatetime);
  if (Number.isNaN(d.getTime())) return isoDatetime;
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function emptyStateHtml(title, subtitle) {
  return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <path d="M7 9h10M7 13h6"></path>
      </svg>
      <div style="font-weight: 600; color: var(--ink-primary); margin-bottom: 4px;">${escapeHtml(title)}</div>
      <div class="small">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function renderTrendsSvgChart(tren = []) {
  const width = 680;
  const height = 230;
  const padL = 34;
  const padR = 14;
  const padT = 18;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(
    4,
    ...tren.map((t) =>
      Math.max(
        t.jumlah_absensi || 0,
        (t.surat_diterima || 0) + (t.surat_pending || 0) + (t.surat_ditolak || 0)
      )
    )
  );

  const step = plotW / 12;
  const barW = Math.min(18, step * 0.34);

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const gridLines = yTicks
    .map((val) => {
      const y = padT + plotH - (val / maxVal) * plotH;
      return `
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="#eae5dc" stroke-dasharray="3 3" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#828791" font-family="JetBrains Mono, monospace">${val}</text>
      `;
    })
    .join("");

  const bars = tren
    .map((item, idx) => {
      const cx = padL + idx * step + step / 2;
      const absH = ((item.jumlah_absensi || 0) / maxVal) * plotH;
      const suratTotal =
        (item.surat_diterima || 0) + (item.surat_pending || 0) + (item.surat_ditolak || 0);
      const surH = (suratTotal / maxVal) * plotH;

      const absY = padT + plotH - absH;
      const surY = padT + plotH - surH;
      const label = MONTH_SHORT[idx] || String(item.bulan);

      return `
        <g class="chart-col">
          <title>${label}: ${item.jumlah_absensi || 0} presensi, ${suratTotal} surat (diterima ${item.surat_diterima || 0}, pending ${item.surat_pending || 0}, ditolak ${item.surat_ditolak || 0})</title>
          <rect x="${cx - barW - 1.5}" y="${absY}" width="${barW}" height="${Math.max(0, absH)}" rx="3" fill="#14533c" />
          <rect x="${cx + 1.5}" y="${surY}" width="${barW}" height="${Math.max(0, surH)}" rx="3" fill="#c25e28" opacity="0.88" />
          <text x="${cx}" y="${height - 10}" text-anchor="middle" font-size="11" fill="#585e68">${label}</text>
        </g>
      `;
    })
    .join("");

  return `
    <div class="chart-wrap">
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; min-width: 520px; height: auto; display: block;">
        ${gridLines}
        <line x1="${padL}" y1="${padT + plotH}" x2="${width - padR}" y2="${padT + plotH}" stroke="#cfc9bd" />
        ${bars}
      </svg>
    </div>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-swatch" style="background: #14533c;"></span> Jumlah Presensi</span>
      <span class="legend-item"><span class="legend-swatch" style="background: #c25e28;"></span> Total Pengajuan Surat</span>
    </div>
  `;
}
