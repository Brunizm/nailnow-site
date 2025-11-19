/**
 * @fileoverview Lógica para o formulário de cadastro de clientes.
 * @version 3.0
 * @author Brunno Sena <contato@brunnoleitesena.com.br>
 *
 * @description
 * Simplifica o cadastro enviando os dados diretamente para o Firestore,
 * garantindo que a senha seja armazenada exatamente como digitada pelo
 * cliente e evitando falhas de rede com múltiplos endpoints de função.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZeg0zQtv9a5crhnWP2biJ1UPA_LCVoR28",
  authDomain: "nailnow-site-72103273-8290b.firebaseapp.com",
  projectId: "nailnow-site-72103273-8290b",
  storageBucket: "nailnow-site-72103273-8290b.appspot.com",
  messagingSenderId: "729530854645",
  appId: "1:729530854645:web:e39cfffff423bf384da9bc",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("form-cadastro-cliente");
const btnSubmit = document.getElementById("btnSubmit");
const formMsg = document.getElementById("formMsg");

function parseCoordinate(value) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

if (!form) {
  console.warn("[cliente-cadastro] Formulário não encontrado pelo id 'form-cadastro-cliente'.");
} else {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Enviando...";
    formMsg.textContent = "";

    const nomeCompleto = form.elements.nome?.value?.trim() || "";
    const email = form.elements.email?.value?.trim() || "";
    const telefone = form.elements.telefone?.value?.trim() || "";
    const senha = form.elements.senha?.value || "";
    const confirmarSenha = form.elements.confirmarSenha?.value || "";
    const enderecoTexto = form.elements.endereco_text?.value?.trim() || "";
    const enderecoFormatado = form.elements.endereco_formatado?.value?.trim() || "";
    const enderecoAlternativo = form.elements.endereco?.value?.trim() || "";
    const endereco = enderecoTexto || enderecoFormatado || enderecoAlternativo;
    const complemento = form.elements.complemento?.value?.trim() || "";
    const placeId = form.elements.place_id?.value?.trim() || "";
    const lat = parseCoordinate(form.elements.lat?.value);
    const lng = parseCoordinate(form.elements.lng?.value);
    const aceiteTermos = form.elements.aceiteTermos?.checked ?? false;

    if (!aceiteTermos) {
      formMsg.textContent = "Você precisa aceitar os termos de uso e a política de privacidade.";
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Criar conta cliente";
      return;
    }

    if (senha !== confirmarSenha) {
      formMsg.textContent = "As senhas não conferem.";
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Criar conta cliente";
      return;
    }

    const clienteData = {
      nomeCompleto,
      email,
      telefone,
      senha,
      endereco,
      endereco_texto: enderecoTexto,
      endereco_formatado: enderecoFormatado,
      enderecoAlternativo,
      complemento,
      place_id: placeId,
      lat,
      lng,
      aceiteTermos,
      criadoEm: new Date().toISOString(),
    };

    const sanitizedData = Object.fromEntries(
      Object.entries(clienteData).filter(([, value]) => value !== undefined)
    );

    try {
      await addDoc(collection(db, "clientes"), sanitizedData);

      formMsg.textContent = "Conta criada com sucesso!";
      form.reset();
      btnSubmit.textContent = "Sucesso!";
    } catch (error) {
      console.error("Erro ao salvar no Firebase", error);
      formMsg.textContent = "Ocorreu um problema ao salvar seus dados, tente novamente.";
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Criar conta cliente";
      return;
    }

    btnSubmit.disabled = false;
  });
}
