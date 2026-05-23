const API_URL = "http://localhost:5150";
const TOKEN_KEY = "peak_token";

const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const welcomeTitle = document.querySelector("#welcome-title");
const logoutButton = document.querySelector("#logout-button");

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.querySelector("#login-email").value;
    const password = document.querySelector("#login-password").value;
    const message = document.querySelector("#login-message");

    await submitAuthForm({
        endpoint: "/auth/login",
        email,
        password,
        message,
        loadingText: "Entrando..."
    });
});

registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.querySelector("#register-name").value;
    const email = document.querySelector("#register-email").value;
    const password = document.querySelector("#register-password").value;
    const age = Number(document.querySelector("#register-age").value);
    const weightKg = Number(document.querySelector("#register-weight").value);
    const heightCm = Number(document.querySelector("#register-height").value);
    const sex = document.querySelector("#register-sex").value;
    const message = document.querySelector("#register-message");

    await submitAuthForm({
        endpoint: "/auth/register",
        email,
        password,
        profile: {
            name,
            age,
            weightKg,
            heightCm,
            sex
        },
        message,
        loadingText: "Creando cuenta..."
    });
});

if (welcomeTitle) {
    loadCurrentUser();
}

logoutButton?.addEventListener("click", () => {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "login.html";
});

async function submitAuthForm({ endpoint, email, password, profile = {}, message, loadingText }) {
    setMessage(message, loadingText);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password, ...profile })
        });

        if (!response.ok) {
            const error = await readError(response);
            setMessage(message, error);
            return;
        }

        const data = await response.json();
        localStorage.setItem(TOKEN_KEY, data.token);
        window.location.href = "dashboard.html";
    } catch {
        setMessage(message, "No se pudo conectar con el servidor.");
    }
}

async function loadCurrentUser() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            localStorage.removeItem(TOKEN_KEY);
            redirectToLogin();
            return;
        }

        const user = await response.json();
        welcomeTitle.textContent = `Hola ${user.name || user.email}`;
        document.body.classList.add("auth-ready");
    } catch {
        localStorage.removeItem(TOKEN_KEY);
        redirectToLogin();
    }
}

async function readError(response) {
    try {
        const data = await response.json();
        return data.message ?? "No se pudo completar la accion.";
    } catch {
        return "No se pudo completar la accion.";
    }
}

function setMessage(element, text) {
    if (element) {
        element.textContent = text;
    }
}

function redirectToLogin() {
    window.location.href = "login.html";
}
