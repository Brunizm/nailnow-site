
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFLccZ3khmT8uqoye6n6kfbqMFRzeXybE",
    authDomain: "nailnow-7546c.firebaseapp.com",
    projectId: "nailnow-7546c",
    storageBucket: "nailnow-7546c.firebasestorage.app",
    messagingSenderId: "413820353687",
    appId: "1:413820353687:web:ad92108dbea59f7749fdd2",
    measurementId: "G-2YEGPEG0E1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function setupClientRegistrationForm() {
    const form = document.getElementById("formCliente");
    if (!form) {
        console.error("[NailNow] Client registration form not found.");
        return;
    }
    if (form.dataset.listenerAttached === "true") {
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

        const nome = form.nome.value.trim();
        const email = form.email.value.trim();
        const telefone = form.telefone.value.trim();
        const senha = form.senha.value;
        const confirmar = form.confirmarSenha.value;
        const endereco = form.endereco_text.value.trim();
        const complemento = form.complemento.value.trim();
        const termos = form.aceiteTermos.checked;

        // Basic Validations
        if (!nome || !email || !telefone || !senha || !endereco) {
            return setStatus("Preencha os campos obrigatórios (*).", "red");
        }
        if (senha.length < 6) {
            return setStatus("A senha precisa ter no mínimo 6 caracteres.", "red");
        }
        if (senha !== confirmar) {
            return setStatus("As senhas não coincidem.", "red");
        }
        if (!termos) {
            return setStatus("Você precisa aceitar os Termos de Uso para continuar.", "red");
        }

        const originalButtonText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Enviando...";
        setStatus("Criando sua conta...", "#555");

        try {
            // Step 1: Create Firebase Auth user
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;

            // Step 2: Create user profile in Firestore
            const profilePayload = {
                uid: user.uid,
                nome,
                email,
                telefone,
                endereco,
                complemento,
                aceiteTermos: termos,
                criadoEm: serverTimestamp(),
                atualizadoEm: serverTimestamp(),
            };
            await setDoc(doc(db, "clientes", user.uid), profilePayload);

            setStatus("Conta criada com sucesso! Você já pode fazer login.", "green");
            btn.textContent = "✅ Sucesso!";
            form.reset();
            
            // Optional: Redirect after a short delay
            // setTimeout(() => { window.location.href = '/cliente/dashboard.html'; }, 2000);

        } catch (error) {
            console.error("Error during sign-up:", error);
            const errorCode = error.code;
            let friendlyMessage = "Ocorreu um erro inesperado. Por favor, tente novamente.";
            
            if (errorCode === 'auth/email-already-in-use') {
                friendlyMessage = "Este e-mail já está cadastrado. Tente fazer login.";
            } else if (errorCode === 'auth/weak-password') {
                friendlyMessage = "Sua senha é muito fraca. Por favor, use uma senha mais forte.";
            } else if (errorCode === 'auth/invalid-email') {
                friendlyMessage = "O e-mail informado não é válido.";
            }
            
            setStatus(friendlyMessage, "red");
            btn.disabled = false;
            btn.textContent = originalButtonText;
        }
        // 'finally' is not used to re-enable the button, to prevent users from re-submitting a successful form.
    });

    form.dataset.listenerAttached = "true";
}

// Wait for the DOM to be fully loaded before setting up the form
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupClientRegistrationForm);
} else {
    setupClientRegistrationForm();
}
