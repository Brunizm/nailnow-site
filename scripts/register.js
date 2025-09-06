function handleSignup(event) {
  event.preventDefault();
  const role = event.target.dataset.role || "usuário";
  alert(`Cadastro de ${role} - integração com Firebase em breve.`);
}

// Attach handler if forms exist
const forms = document.querySelectorAll("form[data-role]");
forms.forEach((form) => {
  form.addEventListener("submit", handleSignup);
});
