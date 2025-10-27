(function () {
  function togglePassword(event) {
    const button = event.currentTarget;
    const inputId = button.getAttribute('data-password-target');
    const input = inputId ? document.getElementById(inputId) : null;

    if (!input) {
      return;
    }

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
    button.classList.toggle('password-toggle--visible', isHidden);

    const nextLabel = isHidden ? 'Ocultar senha' : 'Mostrar senha';
    button.setAttribute('aria-label', nextLabel);
    button.setAttribute('title', nextLabel);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-password-target]').forEach(function (button) {
      button.addEventListener('click', togglePassword);
    });
  });
})();
