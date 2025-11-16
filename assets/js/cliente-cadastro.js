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

const form = document.getElementById("formCliente");
const btnSubmit = document.getElementById("btnSubmit");
const formMsg = document.getElementById("formMsg");

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

  // Constrói o objeto de endereço de forma segura
  const enderecoPayload = {
    texto: data.endereco_text || "",
    formatado: data.endereco_formatado || "",
    placeId: data.place_id || "",
    complemento: data.complemento || "",
  };

  // Adiciona lat/lng apenas se forem valores válidos
  if (data.lat && data.lng) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);
    if (!isNaN(lat) && !isNaN(lng)) {
      enderecoPayload.lat = lat;
      enderecoPayload.lng = lng;
    }
  }

  const payload = {
    nome: data.nome,
    email: data.email,
    telefone: data.telefone,
    senha: data.senha,
    endereco: enderecoPayload,
  };

  try {
    const functionUrl = "https://southamerica-east1-nailnow-3151a.cloudfunctions.net/registerClientAccount";
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Falha ao criar a conta.");
    }

    formMsg.textContent = "Conta criada com sucesso! Verifique seu e-mail para confirmação.";
    form.reset();
    btnSubmit.textContent = "Sucesso!";

  } catch (error) {
    console.error("Erro detalhado durante o cadastro:", error);
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
