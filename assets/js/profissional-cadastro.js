/**
 * @fileoverview Lógica para o formulário de cadastro de profissionais NailNow.
 * Replica a abordagem usada no cadastro de clientes para gravar os dados
 * diretamente no Firestore sem depender de múltiplos endpoints externos.
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

const form = document.getElementById("form-cadastro-profissional");
const btnSubmit = document.getElementById("btnSubmitProf");
const formMsg = document.getElementById("formMsgProf");

const DEFAULT_SUBMIT_LABEL = "Cadastrar profissional";

function parseCoordinate(value) {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function setSubmitState({ label = DEFAULT_SUBMIT_LABEL, disabled = false } = {}) {
  if (!btnSubmit) return;
  btnSubmit.disabled = disabled;
  btnSubmit.textContent = label;
}

function setFeedback(message = "") {
  if (!formMsg) return;
  formMsg.textContent = message;
}

function appendStringField(target, key, value) {
  if (!key) return;
  const normalized = (value ?? "").trim();
  if (normalized) {
    target[key] = normalized;
  }
}

function appendNumberField(target, key, value) {
  if (!key || typeof value !== "number" || !Number.isFinite(value)) return;
  target[key] = value;
}

function collectServices(currentForm) {
  if (!currentForm) return [];
  const inputs = currentForm.querySelectorAll("input[name='servicos']:checked");
  return Array.from(inputs, (input) => input.value).filter(Boolean);
}

if (!form) {
  console.warn("[profissional-cadastro] Formulário não encontrado pelo id 'form-cadastro-profissional'.");
} else {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setSubmitState({ label: "Enviando...", disabled: true });
    setFeedback("");

    const nomeCompleto = form.elements.nome?.value?.trim() || "";
    const cpfRaw = form.elements.cpf?.value?.trim() || "";
    const cpf = cpfRaw.replace(/\D/g, "");
    const email = form.elements.email?.value?.trim() || "";
    const telefone = form.elements.telefone?.value?.trim() || "";
    const senha = form.elements.senha?.value || "";
    const confirmarSenha = form.elements.confirmarSenha?.value || "";
    const enderecoTexto = form.elements.endereco_text?.value?.trim() || "";
    const enderecoFormatado = form.elements.endereco_formatado?.value?.trim() || "";
    const enderecoAlternativo = form.elements.endereco?.value?.trim() || "";
    const endereco = enderecoTexto || enderecoFormatado || enderecoAlternativo;
    const placeId = form.elements.place_id?.value?.trim() || "";
    const lat = parseCoordinate(form.elements.lat?.value);
    const lng = parseCoordinate(form.elements.lng?.value);
    const bio = form.elements.bio?.value?.trim() || "";
    const aceiteTermos = form.elements.aceiteTermos?.checked ?? false;
    const servicos = collectServices(form);

    if (!aceiteTermos) {
      setFeedback("Você precisa aceitar os termos de uso e a política de privacidade.");
      setSubmitState();
      return;
    }

    if (senha !== confirmarSenha) {
      setFeedback("As senhas não conferem.");
      setSubmitState();
      return;
    }

    const profissionalData = {
      nomeCompleto,
      cpf,
      email,
      emailLowercase: email.toLowerCase(),
      telefone,
      senha,
      endereco,
      bio,
      servicos,
      aceiteTermos,
      role: "profissional",
      criadoEm: new Date().toISOString(),
    };

    appendStringField(profissionalData, "nome", nomeCompleto);
    appendStringField(profissionalData, "displayName", nomeCompleto);
    appendStringField(profissionalData, "cpfRaw", cpfRaw);
    appendStringField(profissionalData, "documento", cpf);
    appendStringField(profissionalData, "telefonePrincipal", telefone);

    appendStringField(profissionalData, "endereco_texto", enderecoTexto);
    appendStringField(profissionalData, "endereco_formatado", enderecoFormatado);
    appendStringField(profissionalData, "enderecoAlternativo", enderecoAlternativo);
    appendStringField(profissionalData, "place_id", placeId);
    appendNumberField(profissionalData, "lat", lat);
    appendNumberField(profissionalData, "lng", lng);

    if (!servicos.length) {
      delete profissionalData.servicos;
    }

    try {
      await addDoc(collection(db, "profissionais"), profissionalData);
      setFeedback("Cadastro enviado com sucesso!");
      form.reset();
      setSubmitState({ label: "Sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar no Firebase", error);
      setFeedback("Ocorreu um problema ao salvar seus dados, tente novamente.");
      setSubmitState();
      return;
    }

    setSubmitState();
  });
}
