import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Send, LogOut, AlertTriangle, Trash2, AlertCircle, Info, ShieldCheck, Clock, CheckCircle, MailCheck, FileSpreadsheet, Lock, User, Eye, RefreshCw } from 'lucide-react';

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

const CATEGORIAS = [
  { nome: "Academia", descricao: "Despesas de manutenção com a academia, materiais equipamentos e etc." },
  { nome: "Água", descricao: "Consumo de água" },
  { nome: "Conservação e Limpeza", descricao: "Toda a despesa com a equipa de limpeza e materiais de limpeza e conservação" },
  { nome: "Energia Elétrica", descricao: "Consumo de energia" },
  { nome: "Benfeitorias", descricao: "Benfeitorias no edifício, jardins, piscina e demais áreas comuns" },
  { nome: "Gás", descricao: "Consumo de gás" },
  { nome: "Impostos", descricao: "Guias de FGTS, impostos da portaria e equipa de limpeza" },
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
      console.error("Erro ao ler base de dados: ", error);
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
    texto += `Despesas Registadas:\n`;
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
      let body = `Prezados,\n\nUm novo lote de despesas foi inserido no sistema e aguarda a aprovação de todos.\n`;
      body += `ID do Lote: ${idLote}\nValor Total: ${formatarParaBR(rascunhoTotal)}\n\n`;
      body += `👉 Acedam ao sistema, confiram as Notas Fiscais anexas a este e-mail e cliquem em "Aprovar".\n\n`;
      body += `Resumo:\n${gerarTextoResumo(idLote, rascunho)}`;
      const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=andre.aiafund@gmail.com,Valcabrera@hotmail.com,admcondominiomarques2900@hotmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailLink, '_blank');
    } catch (error) {
      console.error("Erro ao guardar lote: ", error);
      alert("Erro ao enviar para a nuvem. Verifique a ligação.");
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
      setLoginError('Acesso negado. Verifique os dados.');
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (authLoading) return (
    <div className="h-screen w-screen bg-slate-900 flex items-center justify-center">
      <RefreshCw className="animate-spin text-amber-500" size={48}/>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80" alt="Edifício" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-slate-900/60 mix-blend-multiply"></div>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full z-10 relative border-t-8 border-amber-500">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-light tracking-widest text-slate-800 uppercase mb-2">
              Condomínio <span className="font-bold text-amber-500">Marquês</span>
            </h1>
            <p className="text-slate-500 text-sm">Gestão e Aprovação em Nuvem</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2 text-left">E-mail de Acesso</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="seu@email.com" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2 text-left">Palavra-passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all" placeholder="••••••••" />
              </div>
            </div>
            {loginError && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg flex items-center"><AlertCircle size={16} className="mr-2 shrink-0"/>{loginError}</div>}
            <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 px-4 rounded-xl transition-all shadow-lg active:scale-95">
              Entrar no Sistema
            </button>
          </form>
          <div className="mt-8 text-center text-xs text-slate-400 border-t pt-4">
            Acesso restrito à equipa do Marquês.
          </div>
        </div>
      </div>
    );
  }

  const lotesPendentes = lotesCloud.filter(l => l.status === 'pendente');
  const lotesAprovados = lotesCloud.filter(l => l.status === 'aprovado');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-12">
      <header className="relative bg-slate-900 text-white shadow-lg py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:row justify-between items-center">
          <div className="text-center md:text-left mb-4 md:mb-0">
            <h1 className="text-2xl font-light tracking-widest text-amber-500 uppercase">
              Condomínio <span className="font-bold">Marquês</span>
            </h1>
            <div className="flex items-center justify-center md:justify-start text-slate-400 text-xs mt-1">
              <ShieldCheck size={14} className="mr-1 text-green-400" /> Sistema em Nuvem Real-Time
            </div>
          </div>
          <div className="flex items-center space-x-4 bg-slate-800/50 py-2 px-4 rounded-xl border border-slate-700">
            <div className="text-right">
              <p className="text-[10px] text-slate-400 uppercase">Perfil</p>
              <p className="text-sm font-semibold text-white">{roleNameDisplay[userRole]}</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-slate-300 hover:text-red-400 transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8 space-y-8">
        {userRole === 'elias' && (
          <>
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
                <Plus className="text-amber-500 mr-2" size={20}/> Novo Lote (Rascunho)
              </h2>
              <form onSubmit={handleAdicionarRascunho} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Data</label>
                  <input type="date" value={dataAtual} onChange={(e) => setDataAtual(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Vencimento</label>
                  <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Categoria</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none">
                    {CATEGORIAS.map(cat => <option key={cat.nome} value={cat.nome}>{cat.nome}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fornecedor / Descrição</label>
                  <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Empresa, NF..." className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Valor</label>
                  <input type="text" value={valorInput} onChange={(e) => setValorInput(e.target.value)} placeholder="0,00" className="w-full px-3 py-2 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" required />
                </div>
                <div className="md:col-span-6 flex justify-end items-center space-x-4 mt-2">
                  {erroValidacao && <span className="text-red-500 text-xs font-medium">{erroValidacao}</span>}
                  <button type="submit" className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-6 py-2 rounded-lg border transition-all">
                    Adicionar à Lista
                  </button>
                </div>
              </form>

              {rascunho.length > 0 && (
                <div className="mt-8 pt-6 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-700 uppercase text-xs tracking-wider">Itens do Próximo Lote</h3>
                    <div className="text-right">
                      <span className="text-2xl font-black text-amber-600">{formatarParaBR(rascunhoTotal)}</span>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-slate-200 mb-6">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black">
                        <tr>
                          <th className="px-4 py-3">Data</th>
                          <th className="px-4 py-3">Descrição</th>
                          <th className="px-4 py-3 text-right">Valor</th>
                          <th className="px-4 py-3 text-center">X</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rascunho.map(d => (
                          <tr key={d.id} className="bg-white">
                            <td className="px-4 py-3 whitespace-nowrap text-xs">{d.data}</td>
                            <td className="px-4 py-3"><span className="font-bold text-slate-700">{d.categoria}</span><br/><span className="text-xs text-slate-400">{d.descricao}</span></td>
                            <td className="px-4 py-3 text-right font-bold">{d.valorBR}</td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => removerDoRascunho(d.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={submeterLoteParaNuvem} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-black py-4 rounded-xl transition-all shadow-lg shadow-amber-200 uppercase tracking-widest flex items-center justify-center">
                    <Send size={20} className="mr-2" /> Enviar para Aprovação na Nuvem
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 flex items-center">
            <ShieldCheck className="text-amber-500 mr-2" size={20} />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Painel de Lotes</h2>
          </div>
          <div className="p-6 space-y-8">
            {lotesAprovados.length > 0 && userRole === 'elias' && (
              <div>
                <h3 className="text-xs font-black text-green-600 uppercase mb-4 flex items-center"><CheckCircle size={16} className="mr-2"/> Lotes Aprovados (Enviar p/ ADM)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lotesAprovados.map(lote => (
                    <div key={lote.idLote} className="border-2 border-green-400 bg-green-50 rounded-2xl p-5 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <span className="font-mono text-xs bg-green-200 text-green-800 px-2 py-1 rounded font-bold uppercase">{lote.idLote}</span>
                        <span className="font-black text-xl text-slate-800">{formatarParaBR(lote.totalUS)}</span>
                      </div>
                      <button onClick={() => setShowModalADM(lote)} className="mt-auto bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center transition-all">
                        <FileSpreadsheet size={18} className="mr-2" /> Descarregar e Enviar p/ ADM
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-black text-amber-600 uppercase mb-4 flex items-center"><Clock size={16} className="mr-2"/> Lotes Pendentes de Assinatura</h3>
              {lotesPendentes.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed rounded-2xl text-slate-400 italic">Nenhum lote a aguardar assinatura.</div>
              ) : (
                <div className="space-y-4">
                  {lotesPendentes.map(lote => {
                    const jaAprovou = userRole !== 'elias' ? lote.aprovacoes[userRole] : false;
                    return (
                      <div key={lote.idLote} className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="text-center md:text-left flex-1">
                          <span className="font-mono text-xs text-slate-400 block mb-1 uppercase font-bold">{lote.idLote}</span>
                          <span className="font-black text-2xl text-slate-800 block leading-none">{formatarParaBR(lote.totalUS)}</span>
                          <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Criado por: {lote.criadoPor}</p>
                        </div>
                        <div className="flex gap-2">
                          {['andre', 'val', 'sindico'].map(role => (
                            <div key={role} className={`flex flex-col items-center p-2 rounded-xl border w-24 ${lote.aprovacoes[role] ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                              {lote.aprovacoes[role] ? <CheckCircle size={18} className="text-green-500 mb-1"/> : <Clock size={18} className="text-amber-300 mb-1"/>}
                              <span className="text-[9px] font-black text-slate-400 uppercase">{roleNameDisplay[role]}</span>
                            </div>
                          ))}
                        </div>
                        {userRole !== 'elias' && (
                          <button 
                            disabled={jaAprovou}
                            onClick={() => aprovarLote(lote.dbId, lote.aprovacoes)} 
                            className={`w-full md:w-48 py-4 rounded-xl font-black uppercase text-xs tracking-widest transition-all ${jaAprovou ? 'bg-slate-100 text-slate-400 border cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-lg shadow-amber-100'}`}
                          >
                            {jaAprovou ? 'Já Assinou' : 'Assinar Lote'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {showModalADM && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center border-t-8 border-green-500 animate-in fade-in zoom-in">
            <CheckCircle size={64} className="text-green-500 mb-4 mx-auto" />
            <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase">Lote Concluído!</h3>
            <p className="text-slate-500 mb-6 font-medium">O ficheiro CSV será descarregado agora. <br/>Anexe-o juntamente com as Notas Fiscais no e-mail.</p>
            <div className="flex gap-4">
              <button onClick={() => setShowModalADM(null)} className="flex-1 border-2 border-slate-200 text-slate-400 font-black py-4 rounded-2xl uppercase text-xs hover:bg-slate-50">Cancelar</button>
              <button onClick={confirmarEEnviarADM} className="flex-2 bg-green-600 hover:bg-green-700 text-white font-black py-4 px-6 rounded-2xl uppercase text-xs shadow-xl shadow-green-100">Descarregar e Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}