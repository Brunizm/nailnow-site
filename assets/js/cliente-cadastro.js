/**
 * @fileoverview Lógica para o formulário de cadastro de clientes.
 * @version 2.1
 * @author Brunno Sena <contato@brunnoleitesena.com.br>
 *
 * @description
 * Este arquivo contém a lógica para o formulário de cadastro de clientes,
 * que agora invoca uma Cloud Function para registrar a conta, garantindo
 * que as operações de autenticação e criação de perfil no Firestore
 * ocorram de forma segura no backend.
 *
 * @changelog
 * - 2.1: Corrige o bug em que `parseFloat` em um campo de endereço vazio
 *        resultava em `NaN`, causando falha na chamada da função.
 *        Agora, o valor é explicitamente convertido para `null` se estiver vazio.
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

  const payload = {
    nome: data.nome,
    email: data.email,
    telefone: data.telefone,
    senha: data.senha,
    endereco: {
      texto: data.endereco_text,
      formatado: data.endereco_formatado,
      placeId: data.place_id,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      complemento: data.complemento,
    },
  };

  try {
    const functionUrl = "https://us-central1-nailnow-3151a.cloudfunctions.net/registerClientAccount";
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
    console.error("Erro durante o cadastro:", error);
    formMsg.textContent = error.message || "Ocorreu um erro. Tente novamente.";
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Criar conta cliente";
  }
});