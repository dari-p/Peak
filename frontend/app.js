console.log("Peak iniciado");

const loginButton = document.querySelector("#login-button");
const registerButton = document.querySelector("#register-button");

loginButton?.addEventListener("click", () => {
    window.location.href = "login.html";
});

registerButton?.addEventListener("click", () => {
    window.location.href = "register.html";
});
