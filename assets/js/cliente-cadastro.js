/**
 * @fileoverview Lógica para o formulário de cadastro de clientes.
 * @version 2.2
 * @author Brunno Sena <contato@brunnoleitesena.com.br>
 *
 * @description
 * Este arquivo contém a lógica para o formulário de cadastro de clientes,
 * que agora invoca uma Cloud Function para registrar a conta, garantindo
 * que as operações de autenticação e criação de perfil no Firestore
 * ocorram de forma segura no backend.
 *
 * @changelog
 * - 2.2: Garante que as coordenadas de geolocalização (latitude e longitude)
 *        sejam incluídas no payload apenas se forem válidas e não-nulas.
 *        Isso previne o envio de `NaN` ou `null` para o backend, que causava
 *        uma falha silenciosa na criação da conta.
 */

const form = document.getElementById("form-cadastro-cliente");
const btnSubmit = document.getElementById("btnSubmit");
const formMsg = document.getElementById("formMsg");

const FUNCTION_ENDPOINTS = [
  "https://southamerica-east1-nailnow-site.cloudfunctions.net/registerClientAccount",
  "https://southamerica-east1-nailnow-7546c.cloudfunctions.net/registerClientAccount",
  "https://southamerica-east1-nailnow-7546c-53f84.cloudfunctions.net/registerClientAccount",
  "https://southamerica-east1-nailnow-3151a.cloudfunctions.net/registerClientAccount",
];

async function submitToRegisterFunction(payload) {
  const attempts = [];

  for (const endpoint of FUNCTION_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      let parsedBody = null;

      if (text) {
        try {
          parsedBody = JSON.parse(text);
        } catch (parseError) {
          parsedBody = { raw: text };
        }
      }

      if (response.ok) {
        return {
          endpoint,
          body: parsedBody || {},
          response,
        };
      }

      attempts.push({
        endpoint,
        status: response.status,
        body: parsedBody,
      });

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        break;
      }
    } catch (networkError) {
      attempts.push({
        endpoint,
        error: networkError?.message || "network-error",
      });
    }
  }

  const aggregatedError = new Error("all-endpoints-failed");
  aggregatedError.attempts = attempts;
  throw aggregatedError;
}

function parseCoordinate(value) {
  if (!value) {
    return undefined;
  }

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

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  if (data.senha !== data.confirmarSenha) {
    formMsg.textContent = "As senhas não conferem.";
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Criar conta cliente";
    return;
  }

  const enderecoTexto = (data.endereco_text || "").trim();
  const enderecoFormatado = (data.endereco_formatado || "").trim();
  const enderecoAlternativo = (data.endereco || "").trim();
  const complemento = (data.complemento || "").trim();
  const placeId = (data.place_id || "").trim();
  const lat = parseCoordinate(data.lat);
  const lng = parseCoordinate(data.lng);
  const enderecoPrincipal = enderecoTexto || enderecoFormatado || enderecoAlternativo;

  const payload = {
    nome: data.nome?.trim(),
    email: data.email?.trim(),
    telefone: data.telefone?.trim(),
    senha: data.senha,
    endereco: enderecoPrincipal,
    endereco_text: enderecoTexto,
    endereco_formatado: enderecoFormatado,
    enderecoFormatado,
    complemento,
    place_id: placeId,
    placeId,
    ...(lat !== undefined ? { lat } : {}),
    ...(lng !== undefined ? { lng } : {}),
    aceiteTermos: form.elements.aceiteTermos?.checked ?? false,
  };

  try {
    const { body } = await submitToRegisterFunction(payload);

    if (body?.error) {
      throw new Error(body.error);
    }

    formMsg.textContent = "Conta criada com sucesso! Verifique seu e-mail para confirmação.";
    form.reset();
    btnSubmit.textContent = "Sucesso!";

  } catch (error) {
    console.error("Erro detalhado durante o cadastro:", error);
    if (error?.attempts) {
      console.table(error.attempts);
    }
    let errorMessage = "Ocorreu um erro inesperado. Tente novamente.";
    // Tenta extrair a mensagem de erro específica, se disponível
    if (error && typeof error.message === 'string') {
        // Personaliza a mensagem para erros conhecidos
        if (error.message.includes("auth/email-already-in-use")) {
            errorMessage = "Este endereço de e-mail já está em uso.";
        } else {
            errorMessage = error.message;
        }
    }
    formMsg.textContent = errorMessage;
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Criar conta cliente";
  }
  });
}
