// CADEADO DE SEGURANÇA
// Se o navegador não tiver a chave de autenticação, é expulso para o login
if (localStorage.getItem("barbergold_autenticado") !== "sim") {
  window.location.href = "login.html";
}

// Função para o dono sair do painel (opcional, podes ligar a um botão "Sair")
function fazerLogout() {
  localStorage.removeItem("barbergold_autenticado");
  window.location.href = "login.html";
}
// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = "https://roxxpmhmzpcauaeitfna.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fDOYxr3c7dhiayuLGTxJ7g_UFfiJuK7";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const brl = (n) => "R$ " + n.toFixed(2).replace(".", ",");
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmtData = (s) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function toast(t) {
  const e = $("toast");
  if (!e) return;
  e.textContent = t;
  e.style.display = "block";
  setTimeout(() => (e.style.display = "none"), 3000);
}

let filtro = "todos";
let globalBookingsAdmin = [];

async function fetchAdminBookings() {
  const { data, error } = await _supabase.from("bookings").select("*");
  if (!error && data) {
    globalBookingsAdmin = data;
    renderAdmin();
  }
}

// Ouvir alterações em tempo real para o admin
_supabase
  .channel("public:bookings_admin")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "bookings" },
    () => {
      fetchAdminBookings();
    },
  )
  .subscribe();

function bkHeadAdmin(b) {
  const phoneClean = (b.phone || "").replace(/\D/g, "");
  return `<div class="top"><div><b>${esc(b.service)}</b> · ${brl(b.price)}<br><span class="note">${fmtData(b.date)} às ${esc(b.time)} · <b>${esc(b.name)}</b> · <a style="color:var(--ac)" href="https://wa.me/55${phoneClean}" target="_blank" rel="noopener">${esc(b.phone)}</a></span></div><span class="badge ${b.status}">${b.status}</span></div>`;
}

function chatHtmlAdmin(b) {
  const m = (b.messages || [])
    .map(
      (x) =>
        `<div class="msg ${x.from === "dono" ? "dono" : "cli"}"><i>${x.from === "dono" ? "Barbeiro" : esc(b.name)}</i>${esc(x.text)}</div>`,
    )
    .join("");
  return `<div class="chat">${m || '<span class="note">Sem mensagens ainda.</span>'}<div class="row"><input data-chat-admin="${b.id}" placeholder="Escreva uma mensagem" maxlength="300"><button class="btn sm" data-send-admin="${b.id}">Enviar</button></div></div>`;
}

function renderAdmin() {
  const stats = $("stats");
  if (stats) {
    const c = (s) => globalBookingsAdmin.filter((b) => b.status === s).length;
    const faturado = globalBookingsAdmin
      .filter((b) => b.status === "concluído")
      .reduce((a, b) => a + b.price, 0);
    stats.innerHTML = `
      <div class="card"><b>${c("pendente")}</b>Pendentes</div>
      <div class="card"><b>${c("confirmado")}</b>Confirmados</div>
      <div class="card"><b>${c("concluído")}</b>Concluídos</div>
      <div class="card"><b>${brl(faturado)}</b>Faturado</div>
    `;
  }

  const filtros = $("filtros");
  if (filtros) {
    const options = [
      "todos",
      "pendente",
      "confirmado",
      "concluído",
      "recusado",
      "cancelado",
    ];
    filtros.innerHTML = options
      .map(
        (f) =>
          `<button class="opt ${filtro === f ? "on" : ""}" data-f="${f}">${f}</button>`,
      )
      .join("");
  }

  const listaDono = $("listaDono");
  if (listaDono) {
    const L = globalBookingsAdmin
      .filter((b) => filtro === "todos" || b.status === filtro)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    listaDono.innerHTML = L.length
      ? L.map(
          (b) => `
          <div class="card bk">
            ${bkHeadAdmin(b)}
            <div class="acts">
              ${b.status === "pendente" ? `<button class="btn ok sm" data-st="confirmado" data-id="${b.id}">Confirmar</button><button class="btn bad sm" data-st="recusado" data-id="${b.id}">Recusar</button>` : ""}
              ${b.status === "confirmado" ? `<button class="btn sm" data-st="concluído" data-id="${b.id}">Marcar concluído</button> <button class="btn bad sm" data-st="cancelado" data-id="${b.id}">Faltou / Cancelar</button>` : ""}
            </div>
            ${chatHtmlAdmin(b)}
          </div>
        `,
        ).join("")
      : '<div class="card note">Nenhum agendamento neste filtro.</div>';
  }
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.f) {
    filtro = t.dataset.f;
    renderAdmin();
  }
  if (t.dataset.st) {
    const id = t.dataset.id;
    const statusNovo = t.dataset.st;
    const b = globalBookingsAdmin.find((x) => x.id === id);
    if (b) {
      let msgs = b.messages || [];

      // Lógica de mensagens automáticas baseada no novo status
      if (
        statusNovo === "confirmado" ||
        statusNovo === "recusado" ||
        statusNovo === "cancelado"
      ) {
        let msgTexto = "";

        if (statusNovo === "confirmado") {
          msgTexto = `Olá ${b.name}, seu horário de ${fmtData(b.date)} às ${b.time} está confirmado!`;
        } else if (statusNovo === "recusado") {
          msgTexto =
            "Infelizmente não consigo atender nesse horário. Pode escolher outro?";
        } else if (statusNovo === "cancelado") {
          msgTexto =
            "O agendamento precisou ser cancelado. Por favor, solicite um novo horário no sistema ou fale comigo por aqui!";
        }

        msgs.push({
          from: "dono",
          text: msgTexto,
          t: Date.now(),
        });
      }

      const { error } = await _supabase
        .from("bookings")
        .update({ status: statusNovo, messages: msgs })
        .eq("id", id);
      if (!error) fetchAdminBookings();
    }
  }
  if (t.dataset.sendAdmin) {
    const id = t.dataset.sendAdmin;
    const inp = document.querySelector(`input[data-chat-admin="${id}"]`);
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt) return;
    const b = globalBookingsAdmin.find((x) => x.id === id);
    if (b) {
      const msgs = [
        ...(b.messages || []),
        { from: "dono", text: txt, t: Date.now() },
      ];
      const { error } = await _supabase
        .from("bookings")
        .update({ messages: msgs })
        .eq("id", id);
      if (!error) {
        inp.value = "";
        fetchAdminBookings();
      }
    }
  }
});

fetchAdminBookings();
