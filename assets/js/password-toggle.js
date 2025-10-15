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

    const label = button.querySelector('.password-toggle__label');
    if (label) {
      label.textContent = isHidden ? 'Ocultar senha' : 'Mostrar senha';
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-password-target]').forEach(function (button) {
      button.addEventListener('click', togglePassword);
    });
  });
})();
