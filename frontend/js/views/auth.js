import { apiRequest, isAdminPortal, setToken } from "../api.js";
import { showToast } from "../components.js";

export function renderAuthView(root, onAuthenticated) {
  const adminMode = isAdminPortal();
  let mode = "login";

  function draw() {
    root.innerHTML = `
      <div class="auth-shell">
        <section class="auth-editorial">
          <div class="auth-brand">
            <div class="brand-mark"><img src="/static/assets/logo.png" alt="Logo Absensi Pegawai" /></div>
            <div>
              <div style="font-weight: 700; font-size: 15px; letter-spacing: -0.01em;">Absensi Pegawai</div>
              <div style="font-size: 12px; color: #b5c9bf;">${adminMode ? "Panel Administrator" : "Portal Kehadiran &amp; Kepegawaian"}</div>
            </div>
          </div>

          <div class="auth-hero">
            <div class="auth-kicker">
              <span class="pulse-dot"></span>
              ${adminMode ? "Akses Khusus Administrator" : "Sistem Presensi Terintegrasi"}
            </div>
            <h1>${
              adminMode
                ? "Kelola verifikasi pegawai, tinjauan surat, dan rekap kehadiran."
                : "Catat kehadiran harian dengan verifikasi lokasi dan rekap otomatis."
            }</h1>
          </div>

          <div class="auth-specs">
            <div>
              <div class="auth-spec-label">Jam Masuk</div>
              <div class="auth-spec-val">07:00 – 09:00</div>
            </div>
            <div>
              <div class="auth-spec-label">Jam Pulang</div>
              <div class="auth-spec-val">16:00 – 18:00</div>
            </div>
            <div>
              <div class="auth-spec-label">Radius Kantor</div>
              <div class="auth-spec-val">Maks. 50 m</div>
            </div>
          </div>
        </section>

        <section class="auth-panel">
          <div class="auth-box">
            ${
              adminMode
                ? ""
                : `
              <div class="segmented" role="tablist">
                <button type="button" data-mode="login" class="${mode === "login" ? "active" : ""}">Masuk</button>
                <button type="button" data-mode="register" class="${mode === "register" ? "active" : ""}">Daftar Pegawai</button>
              </div>
            `
            }

            ${
              mode === "login"
                ? `
              <form id="login-form" class="form-stack">
                <div>
                  <h2 style="margin: 0 0 4px; font-size: 21px; letter-spacing: -0.02em;">${
                    adminMode ? "Masuk Administrator" : "Selamat datang kembali"
                  }</h2>
                  <p class="muted small" style="margin: 0;">${
                    adminMode ? "Gunakan kredensial administrator yang terdaftar." : "Gunakan NIP dan kata sandi akun aktif Anda."
                  }</p>
                </div>

                <div class="field">
                  <label for="login-nip">${adminMode ? "Username Admin" : "NIP"}</label>
                  <input id="login-nip" name="nip" class="input" type="text" placeholder="${
                    adminMode ? "Masukkan username admin" : "Contoh: 199001012020121001"
                  }" required />
                </div>

                <div class="field">
                  <label for="login-password">Kata Sandi</label>
                  <input id="login-password" name="password" class="input" type="password" placeholder="Masukkan kata sandi" required />
                </div>

                <button type="submit" class="btn btn-primary btn-block" id="login-submit">${
                  adminMode ? "Masuk ke Panel Admin" : "Masuk ke Sistem"
                }</button>
              </form>
            `
                : `
              <form id="register-form" class="form-stack">
                <div>
                  <h2 style="margin: 0 0 4px; font-size: 21px; letter-spacing: -0.02em;">Registrasi Pegawai Baru</h2>
                  <p class="muted small" style="margin: 0;">Akun baru perlu disetujui admin sebelum bisa login.</p>
                </div>

                <div class="field">
                  <label for="reg-nip">NIP</label>
                  <input id="reg-nip" name="nip" class="input" type="text" minlength="3" maxlength="50" placeholder="Minimal 3 karakter" required />
                </div>

                <div class="field">
                  <label for="reg-nama">Nama Lengkap</label>
                  <input id="reg-nama" name="nama" class="input" type="text" minlength="2" maxlength="100" placeholder="Nama lengkap pegawai" required />
                </div>

                <div class="field">
                  <label for="reg-kepegawaian">Status Kepegawaian</label>
                  <select id="reg-kepegawaian" name="kepegawaian" class="select" required>
                    <option value="staff">Staff</option>
                    <option value="magang">Magang</option>
                  </select>
                </div>

                <div class="field">
                  <label for="reg-password">Kata Sandi</label>
                  <input id="reg-password" name="password" class="input" type="password" minlength="6" maxlength="100" placeholder="Minimal 6 karakter" required />
                </div>

                <button type="submit" class="btn btn-primary btn-block" id="reg-submit">Kirim Pendaftaran</button>
              </form>
            `
            }
          </div>
        </section>
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.dataset.mode;
        draw();
      });
    });

    if (mode === "login") {
      root.querySelector("#login-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = root.querySelector("#login-submit");
        const nip = root.querySelector("#login-nip").value.trim();
        const password = root.querySelector("#login-password").value;

        btn.disabled = true;
        btn.textContent = "Memverifikasi...";
        try {
          const { data } = await apiRequest("/login", {
            method: "POST",
            body: { nip, password },
            auth: false,
          });
          setToken(data.access_token);
          showToast("Berhasil masuk");
          await onAuthenticated();
        } catch (err) {
          showToast(err.message, "error");
          btn.disabled = false;
          btn.textContent = "Masuk ke Sistem";
        }
      });
    } else {
      root.querySelector("#register-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = root.querySelector("#reg-submit");
        const payload = {
          nip: root.querySelector("#reg-nip").value.trim(),
          nama: root.querySelector("#reg-nama").value.trim(),
          kepegawaian: root.querySelector("#reg-kepegawaian").value,
          password: root.querySelector("#reg-password").value,
        };

        btn.disabled = true;
        btn.textContent = "Mendaftarkan...";
        try {
          const { data } = await apiRequest("/register", {
            method: "POST",
            body: payload,
            auth: false,
          });
          showToast(data.message || "Registrasi berhasil");
          mode = "login";
          draw();
        } catch (err) {
          showToast(err.message, "error");
          btn.disabled = false;
          btn.textContent = "Kirim Pendaftaran";
        }
      });
    }
  }

  draw();
}
