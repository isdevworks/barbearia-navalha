// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = "https://roxxpmhmzpcauaeitfna.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fDOYxr3c7dhiayuLGTxJ7g_UFfiJuK7";
const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const CORTES = [
  ["Corte clássico", "Tesoura e máquina, acabamento na navalha", 45],
  ["Degradê (fade)", "Low, mid ou high fade", 55],
  ["Corte social", "Tesoura, estilo executivo", 50],
  ["Navalhado", "Lateral e nuca na navalha", 50],
  ["Barba", "Toalha quente e navalha", 35],
  ["Corte + Barba", "Combo completo", 75],
  ["Sobrancelha", "Design com navalha", 15],
];
const COR = [
  ["Pintura de cabelo", "Cor única, todas as tonalidades", 90],
  ["Platinado", "Descoloração + tonalização", 180],
  ["Luzes", "Mechas com acabamento natural", 150],
  ["Camuflagem de grisalhos", "Efeito natural", 70],
  ["Pigmentação de barba", "Preenche falhas e escurece", 40],
];
const ALL = [...CORTES, ...COR];
const HORAS = [9, 10, 11, 12, 14, 15, 16, 17, 18];

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
const iso = (d) => d.toISOString().slice(0, 10);
const fmtData = (s) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};
const ativo = (b) => !["recusado", "cancelado"].includes(b.status);

function toast(t) {
  const e = $("toast");
  if (!e) return;
  e.textContent = t;
  e.style.display = "block";
  setTimeout(() => (e.style.display = "none"), 3000);
}

if ($("gCortes")) {
  $("gCortes").innerHTML = CORTES.map(
    (s) =>
      `<div class="card svc"><div><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div><span class="price">${brl(s[2])}</span></div>`,
  ).join("");
  $("gCor").innerHTML = COR.map(
    (s) =>
      `<div class="card svc"><div><b>${esc(s[0])}</b><small>${esc(s[1])}</small></div><span class="price">${brl(s[2])}</span></div>`,
  ).join("");
}

function go(p) {
  document
    .querySelectorAll("section.pg")
    .forEach((s) => s.classList.toggle("on", s.id === p));
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("on", b.dataset.p === p));
  scrollTo(0, 0);
}
if ($("nav")) {
  $("nav").onclick = (e) => {
    if (e.target.dataset.p) go(e.target.dataset.p);
  };
}

let sel = { svc: [], dia: null, hora: null };
let globalBookings = [];

async function fetchBookings() {
  const { data, error } = await _supabase.from("bookings").select("*");
  if (!error && data) {
    globalBookings = data;
    renderOpts();
    renderMeus();
  }
}

// Ouvir alterações em tempo real
_supabase
  .channel("public:bookings")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "bookings" },
    () => {
      fetchBookings();
    },
  )
  .subscribe();

const hojeIso = iso(new Date());
if ($("dataInput")) {
  $("dataInput").min = hojeIso;
  $("dataInput").onchange = (e) => {
    const val = e.target.value;
    if (!val) {
      sel.dia = null;
      renderOpts();
      return;
    }
    const [y, m, d] = val.split("-");
    const dataSelecionada = new Date(y, m - 1, d);
    if (dataSelecionada.getDay() === 0) {
      toast("A barbearia está fechada aos domingos. Escolha outro dia.");
      e.target.value = "";
      sel.dia = null;
    } else {
      sel.dia = val;
    }
    sel.hora = null;
    renderOpts();
  };
}

function mine() {
  try {
    return JSON.parse(localStorage.getItem("meusIds") || "[]");
  } catch (e) {
    return [];
  }
}
function saveMine(id) {
  try {
    const a = mine();
    a.push(id);
    localStorage.setItem("meusIds", JSON.stringify(a));
  } catch (e) {}
}

function renderOpts() {
  const oSvc = $("oSvc");
  if (oSvc) {
    oSvc.innerHTML = ALL.map(
      (s, i) =>
        `<button class="opt ${sel.svc.includes(i) ? "on" : ""}" data-k="svc" data-v="${i}">${esc(s[0])} · ${brl(s[2])}</button>`,
    ).join("");
  }

  const now = new Date(),
    hoje = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const oHora = $("oHora");
  if (oHora) {
    oHora.innerHTML = sel.dia
      ? HORAS.map((h) => {
          const t = h + ":00",
            tomado = globalBookings.some(
              (b) => b.date === sel.dia && b.time === t && ativo(b),
            ),
            passou = sel.dia === hoje && h <= now.getHours();
          return `<button class="opt ${sel.hora === t ? "on" : ""}" data-k="hora" data-v="${t}" ${tomado || passou ? "disabled" : ""}>${t}</button>`;
        }).join("")
      : '<span class="note">Selecione uma data no calendário acima primeiro.</span>';
  }

  const resumo = $("resumo");
  if (resumo) {
    if (sel.svc.length > 0 && sel.dia && sel.hora) {
      const nomes = sel.svc.map((i) => ALL[i][0]).join(" + ");
      const totalPreco = sel.svc.reduce((acc, i) => acc + ALL[i][2], 0);
      resumo.textContent = `${nomes} · ${fmtData(sel.dia)} às ${sel.hora} · ${brl(totalPreco)}`;
    } else {
      resumo.textContent = "";
    }
  }
}

if ($("agendar")) {
  $("agendar").onclick = (e) => {
    const b = e.target.closest(".opt");
    if (!b || b.disabled) return;
    const k = b.dataset.k,
      v = b.dataset.v;
    if (k === "svc") {
      const idx = +v;
      const pos = sel.svc.indexOf(idx);
      if (pos > -1) sel.svc.splice(pos, 1);
      else sel.svc.push(idx);
    } else {
      sel[k] = v;
      if (k === "dia") sel.hora = null;
    }
    renderOpts();
  };
}

if ($("enviar")) {
  $("enviar").onclick = async () => {
    const nome = $("nome").value.trim(),
      tel = $("tel").value.trim();
    if (
      sel.svc.length === 0 ||
      !sel.dia ||
      !sel.hora ||
      nome.length < 2 ||
      tel.replace(/\D/g, "").length < 8
    )
      return toast(
        "Selecione pelo menos um serviço, data, horário, nome e WhatsApp.",
      );

    if (
      globalBookings.some(
        (b) => b.date === sel.dia && b.time === sel.hora && ativo(b),
      )
    )
      return toast("Esse horário acabou de ser ocupado.");

    const servicosNomes = sel.svc.map((i) => ALL[i][0]).join(" + ");
    const precoTotal = sel.svc.reduce((acc, i) => acc + ALL[i][2], 0);

    const novoId = "bk_" + Date.now();
    const novoAgendamento = {
      id: novoId,
      name: nome,
      phone: tel,
      service: servicosNomes,
      price: precoTotal,
      date: sel.dia,
      time: sel.hora,
      status: "pendente",
      messages: [],
      created: Date.now(),
    };

    const { error } = await _supabase
      .from("bookings")
      .insert([novoAgendamento]);
    if (error) {
      toast("Erro ao enviar agendamento. Tente novamente.");
      return;
    }

    saveMine(novoId);
    sel = { svc: [], dia: null, hora: null };
    if ($("dataInput")) $("dataInput").value = "";
    if ($("nome")) $("nome").value = "";
    if ($("tel")) $("tel").value = "";
    renderOpts();
    fetchBookings();
    toast("Pedido enviado! Aguarde a confirmação.");
    go("meus");
  };
}

function chatHtmlClient(b) {
  const m = (b.messages || [])
    .map(
      (x) =>
        `<div class="msg ${x.from === "dono" ? "dono" : "cli"}"><i>${x.from === "dono" ? "Barbeiro" : esc(b.name)}</i>${esc(x.text)}</div>`,
    )
    .join("");
  return `<div class="chat">${m || '<span class="note">Sem mensagens ainda.</span>'}<div class="row"><input data-chat="${b.id}" placeholder="Escreva uma mensagem" maxlength="300"><button class="btn sm" data-send-cli="${b.id}">Enviar</button></div></div>`;
}

function bkHead(b) {
  return `<div class="top"><div><b>${esc(b.service)}</b> · ${brl(b.price)}<br><span class="note">${fmtData(b.date)} às ${esc(b.time)}</span></div><span class="badge ${b.status}">${b.status}</span></div>`;
}

function renderMeus() {
  const listaMeus = $("listaMeus");
  if (!listaMeus) return;
  const ids = mine();
  const meus = globalBookings
    .filter((b) => ids.includes(b.id))
    .sort((a, b) => b.created - a.created);
  listaMeus.innerHTML = meus.length
    ? meus
        .map(
          (b) =>
            `<div class="card bk">${bkHead(b)}${b.status === "confirmado" ? '<p class="note" style="color:var(--ok)">✔ Horário confirmado. Te esperamos!</p>' : ""}${["pendente", "confirmado"].includes(b.status) ? `<div class="acts"><button class="btn sec sm" data-cancel="${b.id}">Cancelar</button></div>` : ""}${chatHtmlClient(b)}</div>`,
        )
        .join("")
    : '<div class="card note">Você ainda não tem agendamentos.</div>';
}

document.addEventListener("click", async (e) => {
  const t = e.target;
  if (t.dataset.cancel) {
    const id = t.dataset.cancel;
    const { error } = await _supabase
      .from("bookings")
      .update({ status: "cancelado" })
      .eq("id", id);
    if (!error) fetchBookings();
  }
  if (t.dataset.sendCli) {
    const id = t.dataset.sendCli;
    const inp = document.querySelector(`input[data-chat="${id}"]`);
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt) return;
    const b = globalBookings.find((x) => x.id === id);
    if (b) {
      const msgs = [
        ...(b.messages || []),
        { from: "cli", text: txt, t: Date.now() },
      ];
      const { error } = await _supabase
        .from("bookings")
        .update({ messages: msgs })
        .eq("id", id);
      if (!error) {
        inp.value = "";
        fetchBookings();
      }
    }
  }
});

fetchBookings();
