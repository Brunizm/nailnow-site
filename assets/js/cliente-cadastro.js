function setupClientRegistrationForm() {
    const form = document.getElementById("formCliente");
    if (!form) {
        console.error("[NailNow] Registration form not found.");
        return;
    }

    const msg = document.getElementById("formMsg");
    const btn = document.getElementById("btnSubmit");

    const setStatus = (text, color = "#555") => {
        if (!msg) return;
        msg.textContent = text;
        msg.style.color = color;
        msg.style.display = "block";
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        const formData = {
            nome: form.nome.value.trim(),
            email: form.email.value.trim(),
            telefone: form.telefone.value.trim(),
            senha: form.senha.value,
            confirmarSenha: form.confirmarSenha.value,
            endereco: form.endereco_text.value.trim(),
            complemento: form.complemento.value.trim(),
            aceiteTermos: form.aceiteTermos.checked,
            // Hidden fields for Google Places
            endereco_formatado: form.endereco_formatado.value,
            place_id: form.place_id.value,
            lat: form.lat.value,
            lng: form.lng.value,
            // Add origin to align with documentation
            origem: "cliente-cadastro-web",
        };

        if (!formData.nome || !formData.email || !formData.telefone || !formData.senha || !formData.endereco) {
            return setStatus("Preencha os campos obrigatórios (*).", "red");
        }
        if (formData.senha.length < 6) {
            return setStatus("A senha precisa ter no mínimo 6 caracteres.", "red");
        }
        if (formData.senha !== formData.confirmarSenha) {
            return setStatus("As senhas não coincidem.", "red");
        }
        if (!formData.aceiteTermos) {
            return setStatus("Você precisa aceitar os Termos de Uso para continuar.", "red");
        }

        const originalButtonText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Enviando...";
        setStatus("Criando sua conta...", "#555");

        try {
            // The URL for the Cloud Function
            const functionUrl = "https://southamerica-east1-nailnow-7546c.cloudfunctions.net/registerClientAccount";

            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            const result = await response.json();

            if (!response.ok) {
                let friendlyMessage = "Ocorreu um erro. Tente novamente.";
                if (result.error === 'email-already-in-use') {
                    friendlyMessage = "Este e-mail já está em uso. Tente fazer login.";
                } else if (result.error === 'invalid-payload') {
                    friendlyMessage = "Alguns dados estão faltando. Verifique o formulário.";
                }
                throw new Error(friendlyMessage);
            }
            
            setStatus("Conta criada com sucesso! Verifique seu e-mail para confirmar.", "green");
            btn.textContent = "✅ Sucesso!";
            form.reset();

        } catch (error) {
            console.error("Error during sign-up:", error);
            setStatus(error.message || "Ocorreu um erro inesperado. Tente mais tarde.", "red");
            btn.disabled = false;
            btn.textContent = originalButtonText;
        }
    });
}

// Wait for the DOM to be fully loaded before setting up the form
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupClientRegistrationForm);
} else {
    setupClientRegistrationForm();
}
