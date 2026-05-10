import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Send, LogOut, Trash2, AlertCircle, ShieldCheck, Clock, CheckCircle, FileSpreadsheet, Lock, User, Eye, RefreshCw } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyC3sdfjNj_xlEaYk_qta34X8M-8wMh71qg",
  authDomain: "condominio-marques.firebaseapp.com",
  projectId: "condominio-marques",
  storageBucket: "condominio-marques.firebasestorage.app",
  messagingSenderId: "365111986288",
  appId: "1:365111986288:web:bf2266756c5e2a87a38cb5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const APP_ID = "condominio-marques"; 
const EMAIL_ADM = "admcondominiomarques2900@hotmail.com";

// Deteta automaticamente o link do site para incluir nos e-mails
const SITE_URL = window.location.origin;

const CATEGORIAS = [
  { nome: "Academia", descricao: "Despesas de manutenção com a academia, materiais equipamentos e etc." },
  { nome: "Água", descricao: "Consumo de água" },
  { nome: "Conservação e Limpeza", descricao: "Toda a despesa com a equipe de limpeza e materiais de limpeza e conservação" },
  { nome: "Energia Elétrica", descricao: "Consumo de energia" },
  { nome: "Benfeitorias", descricao: "Benfeitorias no edifício, jardins, piscina e demais áreas comuns" },
  { nome: "Gás", descricao: "Consumo de gás" },
  { nome: "Impostos", descricao: "Guias de FGTS, impostos da portaria e equipe de limpeza" },
  { nome: "Individualização de Gás", descricao: "Eventuais gastos adicionais com isto" },
  { nome: "Jurídico", descricao: "Despesas de advogados" },
  { nome: "Manutenção", descricao: "Toda e qualquer manutenção de bombas, elevadores, jardim, piscina e etc" },
  { nome: "Outras Despesas", descricao: "Despesas pequenas tais como material de escritório e afins" },
  { nome: "Portaria", descricao: "Valores pagos a título de portaria (somente)" },
  { nome: "Seguro", descricao: "Seguros em geral" },
  { nome: "Sindico & Adm", descricao: "Salário do síndico/qualquer funcionário orgânico" },
  { nome: "Internet/Telefone/TV", descricao: "Despesas mensais" },
  { nome: "Unclassified", descricao: "Somente lançar nesta categoria o que não se tem conhecimento (será reclassificado posteriormente)" }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [lotesCloud, setLotesCloud] = useState([]);
  const [rascunho, setRascunho] = useState([]);
  const [dataAtual, setDataAtual] = useState(new Date().toISOString().split('T')[0]);
  const [vencimento, setVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState(CATEGORIAS[0].nome);
  const [descricao, setDescricao] = useState('');
  const [valorInput, setValorInput] = useState('');
  const [erroValidacao, setErroValidacao] = useState('');
  const [showModalADM, setShowModalADM] = useState(null);
  const [loteExpandido, setLoteExpandido] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const lotesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'lotes');
    const unsubscribe = onSnapshot(lotesRef, (snapshot) => {
      const lotesData = [];
      snapshot.forEach((doc) => {
        lotesData.push({ dbId: doc.id, ...doc.data() });
      });
      lotesData.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
      setLotesCloud(lotesData);
    }, (error) => {
      console.error("Erro ao ler banco de dados: ", error);
    });
    return () => unsubscribe();
  }, [user]);

  const userRole = useMemo(() => {
    if (!user || !user.email) return null;
    const email = user.email.toLowerCase();
    if (email.includes('andre')) return 'andre';
    if (email.includes('val')) return 'val';
    if (email.includes('sindico')) return 'sindico';
    return 'elias';
  }, [user]);

  const roleNameDisplay = {
    'andre': 'André',
    'val': 'Val',
    'sindico': 'Síndico',
    'elias': 'Operador (Elias)'
  };

  const parseValorBR = (valorStr) => {
    if (!valorStr) return 0;
    let limpo = valorStr.replace(/[^\d,-]/g, ''); 
    limpo = limpo.replace(',', '.'); 
    return parseFloat(limpo) || 0;
  };

  const formatarParaBR = (valor) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
  };

  const gerarTextoResumo = (loteId, despesasLote) => {
    let texto = `LOTE: ${loteId}\n`;
    texto += `Data de Referência: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
    texto += `Despesas Registradas:\n`;
    texto += `--------------------------------------------------\n`;
    let total = 0;
    despesasLote.forEach(d => {
      texto += `- [${d.data}] (Venc: ${d.vencimento}) ${d.categoria}: ${d.descricao} | ${d.valorBR}\n`;
      total += d.valorUS;
    });
    texto += `--------------------------------------------------\n`;
    texto += `TOTAL DO LOTE: ${formatarParaBR(total)}\n`;
    return texto;
  };

  const handleAdicionarRascunho = (e) => {
    e.preventDefault();
    setErroValidacao(''); 
    const valorUS = parseValorBR(valorInput);
    if (valorUS <= 0 || !descricao.trim()) {
      setErroValidacao("Insira uma descrição válida e um valor maior que zero.");
      return;
    }
    const novaDespesa = {
      id: Math.random().toString(36).substring(2, 9),
      data: dataAtual, vencimento: vencimento, categoria, descricao: descricao.trim(),
      valorUS, valorBR: formatarParaBR(valorUS)
    };
    setRascunho([...rascunho, novaDespesa]);
    setDescricao(''); setValorInput('');
  };

  const removerDoRascunho = (id) => {
    setRascunho(rascunho.filter(d => d.id !== id));
  };

  const rascunhoTotal = rascunho.reduce((acc, curr) => acc + curr.valorUS, 0);

  const submeterLoteParaNuvem = async () => {
    if (rascunho.length === 0) return;
    const hoje = new Date();
    const idLote = `LOTE-${hoje.getFullYear().toString().slice(2)}${(hoje.getMonth()+1).toString().padStart(2, '0')}${hoje.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const novoLoteDoc = {
      idLote: idLote,
      dataCriacao: hoje.toISOString(),
      status: 'pendente',
      aprovacoes: { andre: false, val: false, sindico: false },
      despesas: rascunho,
      totalUS: rascunhoTotal,
      criadoPor: user.email
    };

    try {
      const lotesRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'lotes');
      await setDoc(doc(lotesRef, idLote), novoLoteDoc);
      setRascunho([]);
      const subject = `NOVO LOTE NO SISTEMA - ${idLote} - Condomínio Marquês`;
      let body = `Prezados,\n\nUm novo lote de despesas foi inserido no sistema e aguarda a aprovação de vocês.\n\n`;
      body += `ID do Lote: ${idLote}\nValor Total: ${formatarParaBR(rascunhoTotal)}\n\n`;
      body += `👉 Link Direto do Sistema: ${SITE_URL}\n\n`;
      body += `Instruções: Acessem o link acima, confiram as Notas Fiscais anexas a este e-mail e cliquem em "Aprovar" dentro da plataforma.\n\n`;
      body += `Resumo:\n${gerarTextoResumo(idLote, rascunho)}`;
      const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=andre.aiafund@gmail.com,Valcabrera@hotmail.com,admcondominiomarques2900@hotmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailLink, '_blank');
    } catch (error) {
      console.error("Erro ao salvar lote: ", error);
      alert("Erro ao enviar para a nuvem. Verifique sua conexão.");
    }
  };

  const aprovarLote = async (loteId, aprovaAtual) => {
    try {
      const loteRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'lotes', loteId);
      const novasAprovacoes = { ...aprovaAtual, [userRole]: true };
      const todosAprovaram = novasAprovacoes.andre && novasAprovacoes.val && novasAprovacoes.sindico;
      await updateDoc(loteRef, {
        aprovacoes: novasAprovacoes,
        status: todosAprovaram ? 'aprovado' : 'pendente'
      });
    } catch (error) {
      console.error("Erro ao aprovar lote: ", error);
    }
  };

  const exportarCSV = (lote) => {
    const cabecalho = ["Data", "Vencimento", "Categoria", "Descricao", "Valor_US"];
    const linhas = lote.despesas.map(d => [
      d.data, d.vencimento, `"${d.categoria}"`, `"${d.descricao}"`, d.valorUS.toFixed(2)
    ]);
    const conteudoCSV = [cabecalho.join(","), ...linhas.map(l => l.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `Controle_Marques_${lote.idLote}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const confirmarEEnviarADM = async () => {
    if (!showModalADM) return;
    const lote = showModalADM;
    exportarCSV(lote);
    try {
      const loteRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'lotes', lote.dbId);
      await updateDoc(loteRef, { status: 'arquivado' });
    } catch(e) { console.error(e); }
    const subject = `LOTE APROVADO - ${lote.idLote} - Condomínio Marquês`;
    let body = `Prezados da Administração,\n\nSegue para pagamento o ${lote.idLote}, no valor total de ${formatarParaBR(lote.totalUS)}.\n\n`;
    body += `✅ STATUS: Este lote já foi auditado e APROVADO via sistema por André, Val e Síndico.\n\n`;
    body += `👉 Link de Auditoria: ${SITE_URL}\n\n`;
    body += `O CSV foi gerado e as Notas Fiscais devem ser anexadas a este e-mail.\n\n`;
    body += `Resumo:\n${gerarTextoResumo(lote.idLote, lote.despesas)}`;
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL_ADM)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailLink, '_blank');
    setShowModalADM(null);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      setLoginError('Acesso negado. Verifique e-mail e senha.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 m-0"><RefreshCw className="animate-spin text-amber-500" size={48}/><p className="text-white mt-4 font-sans uppercase tracking-widest text-xs">Conectando...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80" alt="Edifício" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-slate-900 mix-blend-multiply"></div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full z-10 relative border-t-4 border-amber-500">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light tracking-widest text-slate-800 uppercase mb-2">
              Condomínio <span className="font-bold text-amber-500">Marquês</span>
            </h1>
            <p className="text-slate-500 text-sm">Gestão e Aprovação em Nuvem</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">E-mail de Acesso</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="seu@email.com" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="••••••••" />
              </div>
            </div>
            {loginError && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 flex items-start"><AlertCircle size={16} className="mr-2 mt-0.5 shrink-0"/>{loginError}</div>}
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg">Entrar no Sistema</button>
          </form>
          <div className="mt-6 text-center text-xs text-slate-400">Protegido por criptografia Google Firebase.</div>
        </div>
      </div>
    );
  }

  const lotesPendentes = lotesCloud.filter(l => l.status === 'pendente');
  const lotesAprovados = lotesCloud.filter(l => l.status === 'aprovado');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      <header className="relative bg-slate-900 text-white shadow-lg py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-2xl font-light tracking-widest text-amber-500 uppercase">Condomínio <span className="font-bold">Marquês</span></h1>
            <div className="flex items-center justify-center md:justify-start text-slate-400 text-sm mt-1"><ShieldCheck size={14} className="mr-1 text-green-400" /> Sistema Real-Time</div>
          </div>
          <div className="flex items-center space-x-4 bg-slate-800/50 py-2 px-4 rounded-xl border border-slate-700">
            <div className="text-right"><p className="text-xs text-slate-400">Logado como</p><p className="text-sm font-semibold text-white">{roleNameDisplay[userRole]}</p></div>
            <button onClick={handleLogout} className="flex items-center space-x-2 text-slate-300 hover:text-red-400"><LogOut size={18} /><span>Sair</span></button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {userRole === 'elias' && (
          <>
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Adicionar Despesa (Rascunho)</h2>
              <form onSubmit={handleAdicionarRascunho} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
                <input type="date" value={dataAtual} onChange={(e) => setDataAtual(e.target.value)} className="px-4 py-2 bg-slate-50 border rounded-lg outline-none" required />
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="px-4 py-2 bg-slate-50 border rounded-lg outline-none" required />
                <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="px-4 py-2 bg-slate-50 border rounded-lg outline-none lg:col-span-2">
                  {CATEGORIAS.map(cat => <option key={cat.nome} value={cat.nome}>{cat.nome}</option>)}
                </select>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição..." className="px-4 py-2 bg-slate-50 border rounded-lg outline-none lg:col-span-2" required />
                <input type="text" value={valorInput} onChange={(e) => setValorInput(e.target.value)} placeholder="Valor R$..." className="px-4 py-2 bg-slate-50 border rounded-lg outline-none lg:col-span-4" required />
                <button type="submit" className="bg-slate-100 hover:bg-slate-200 text-slate-800 border px-4 py-2.5 rounded-lg lg:col-span-2">Adicionar à Lista</button>
              </form>
              {rascunho.length > 0 && (
                <div className="mt-8 border-t pt-6">
                  <div className="flex justify-between items-end mb-4">
                    <h3 className="font-semibold">Itens no Lote Local</h3>
                    <p className="text-xl font-bold text-amber-600">{formatarParaBR(rascunhoTotal)}</p>
                  </div>
                  <button onClick={submeterLoteParaNuvem} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold py-4 rounded-xl shadow-lg uppercase tracking-widest flex items-center justify-center"><Send size={20} className="mr-2" /> Salvar na Nuvem</button>
                </div>
              )}
            </section>
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-6 py-4 flex items-center text-white"><ShieldCheck className="text-amber-500 mr-2" /> Painel de Lotes Cloud</div>
              <div className="p-6 space-y-6">
                {lotesAprovados.map(lote => (
                  <div key={lote.idLote} className="border-2 border-green-400 bg-green-50 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center">
                    <div><span className="font-mono text-sm bg-green-200 text-green-800 px-2 py-1 rounded font-bold">{lote.idLote}</span><span className="ml-4 font-bold text-lg">{formatarParaBR(lote.totalUS)}</span></div>
                    <button onClick={() => setShowModalADM(lote)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center"><FileSpreadsheet size={18} className="mr-2" /> Enviar p/ ADM</button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {userRole !== 'elias' && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center"><ShieldCheck className="text-amber-500 mr-2" /> Aguardando Sua Aprovação</h2>
            {lotesPendentes.length === 0 ? <p className="text-slate-500 italic">Nenhum lote pendente.</p> : (
              <div className="space-y-6">
                {lotesPendentes.map(lote => (
                  <div key={lote.idLote} className="border rounded-xl p-5 bg-white shadow-sm flex flex-col md:flex-row justify-between items-center">
                    <div className="flex-1">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{lote.idLote}</span>
                      <h3 className="text-2xl font-bold mt-2">{formatarParaBR(lote.totalUS)}</h3>
                      <button 
                        onClick={() => setLoteExpandido(loteExpandido === lote.dbId ? null : lote.dbId)}
                        className="text-amber-600 text-xs font-bold flex items-center mt-2 hover:underline"
                      >
                        <Eye size={14} className="mr-1" />
                        {loteExpandido === lote.dbId ? "Ocultar Detalhes" : "Ver Detalhes do Lote"}
                      </button>
                    </div>
                    
                    {lote.aprovacoes[userRole] ? (
                      <span className="text-green-600 font-bold flex items-center bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                        <CheckCircle size={18} className="mr-2" /> Aprovado por você
                      </span>
                    ) : (
                      <button onClick={() => aprovarLote(lote.dbId, lote.aprovacoes)} className="bg-amber-500 hover:bg-amber-600 px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center">
                        <Send size={18} className="mr-2" /> Aprovar Lote
                      </button>
                    )}

                    {loteExpandido === lote.dbId && (
                      <div className="w-full mt-6 pt-4 border-t border-slate-100 animate-in fade-in duration-300">
                        <div className="grid grid-cols-1 gap-2">
                          {lote.despesas.map((d, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                              <div>
                                <span className="font-bold text-slate-700">{d.categoria}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                <span className="text-slate-600">{d.descricao}</span>
                              </div>
                              <span className="font-bold text-slate-800">{d.valorBR}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
      {showModalADM && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
            <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-800">Finalizar Lote {showModalADM.idLote}</h3>
            <p className="text-slate-500 mt-2">O arquivo CSV será gerado e o e-mail para a Administração será aberto com o link de auditoria.</p>
            <button onClick={confirmarEEnviarADM} className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 mt-6 rounded-xl shadow-lg transition-all">Baixar CSV e Abrir E-mail</button>
            <button onClick={() => setShowModalADM(null)} className="w-full text-slate-400 mt-4 font-semibold hover:text-slate-600">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}