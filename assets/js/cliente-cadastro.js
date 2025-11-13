'''
 * @fileoverview Lógica para o formulário de cadastro de clientes.
 * @version 2.0
 * @author Brunno Sena <contato@brunnoleitesena.com.br>
 * 
 * @description
 * Este arquivo contém a lógica para o formulário de cadastro de clientes,
 * que agora invoca uma Cloud Function para registrar a conta, garantindo
 * que as operações de autenticação e criação de perfil no Firestore
 * ocorram de forma segura no backend.
 '''

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
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      complemento: data.complemento,
    },
  };

  try {
    // A URL da sua Cloud Function implantada
    const functionUrl = "https://us-central1-nailnow-3151a.cloudfunctions.net/registerClientAccount";
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }), // O payload deve ser encapsulado em um objeto 'data'
    });

    const result = await response.json();

    if (!response.ok) {
      // A função pode retornar mensagens de erro específicas
      throw new Error(result.error || "Falha ao criar a conta.");
    }

    formMsg.textContent = "Conta criada com sucesso! Verifique seu e-mail para confirmação.";
    form.reset();
    btnSubmit.textContent = "Sucesso!";
    // Opcional: redirecionar para uma página de sucesso ou login
    // window.location.href = '/cliente/login.html';

  } catch (error) {
    console.error("Erro durante o cadastro:", error);
    formMsg.textContent = error.message || "Ocorreu um erro. Tente novamente.";
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Criar conta cliente";
  }
});
