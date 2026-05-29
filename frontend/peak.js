const ROUTINES_KEY = "peak_routines";
const HISTORY_KEY = "peak_workout_history";
const ACTIVE_WORKOUT_KEY = "peak_active_workout";
const FITNESS_SYNC_KEY = "peak_fitness_last_sync";
const SYNC_DEBOUNCE_MS = 500;

let syncTimeoutId;

const defaultRoutines = [
    {
        id: "legs",
        title: "LEGS",
        tag: "Piernas",
        goal: "Fuerza",
        minutes: 75,
        accent: "accent-lime",
        exercises: [
            createExercise("Sentadilla Hack", "Cuadriceps", 135, [[20, 8, true], [40, 8, false], [42.5, 8, false]]),
            createExercise("Peso Muerto", "Posterior", 120, [[60, 6, false], [65, 6, false]]),
            createExercise("Empuje de Caderas", "Gluteos", 90, [[80, 10, false], [90, 8, false]]),
            createExercise("Extension de Cuadriceps", "Cuadriceps", 75, [[35, 12, false], [40, 10, false]])
        ]
    },
    {
        id: "pull",
        title: "PULL",
        tag: "Espalda y biceps",
        goal: "Hipertrofia",
        minutes: 60,
        accent: "accent-blue",
        exercises: [
            createExercise("Dominadas", "Espalda", 120, [[0, 8, false], [0, 8, false], [0, 6, false]]),
            createExercise("Remo en Punta", "Espalda", 105, [[45, 10, false], [50, 8, false]]),
            createExercise("Curl Inclinado", "Biceps", 75, [[12, 10, false], [12, 10, false]])
        ]
    },
    {
        id: "push",
        title: "PUSH",
        tag: "Pecho y triceps",
        goal: "Volumen",
        minutes: 65,
        accent: "accent-rose",
        exercises: [
            createExercise("Press Banca", "Pecho", 120, [[40, 10, true], [70, 6, false], [70, 6, false]]),
            createExercise("Press Inclinado", "Pecho", 100, [[45, 8, false], [47.5, 8, false]]),
            createExercise("Press Militar", "Hombros", 100, [[35, 8, false], [35, 8, false]])
        ]
    }
];

document.addEventListener("DOMContentLoaded", async () => {
    ensureSeedData();
    await syncStateFromApi();

    if (document.querySelector("#dashboard-cards")) {
        renderDashboard();
    }

    if (document.querySelector("#routine-list")) {
        renderRoutines();
        bindRoutineActions();
    }

    if (document.querySelector("#exercise-stack")) {
        startWorkoutScreen();
    }
});

function createExercise(name, label, restSeconds, sets) {
    return {
        id: slugId(name),
        name,
        label,
        restSeconds,
        note: "",
        sets: sets.map(([kg, reps, warmup], index) => ({
            id: `${slugId(name)}-${index + 1}`,
            kg,
            reps,
            warmup,
            done: false
        }))
    };
}

function ensureSeedData() {
    if (!localStorage.getItem(ROUTINES_KEY)) {
        localStorage.setItem(ROUTINES_KEY, JSON.stringify(defaultRoutines));
    }

    if (!localStorage.getItem(HISTORY_KEY)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
    }
}

function getRoutines() {
    return readJson(ROUTINES_KEY, defaultRoutines);
}

function saveRoutines(routines) {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines));
    queueStateSync();
}

function getHistory() {
    return readJson(HISTORY_KEY, []);
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    queueStateSync();
}

async function syncStateFromApi() {
    const token = getAuthToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/fitness/state`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!response.ok) {
            return;
        }

        const state = await response.json();
        const remoteRoutines = JSON.parse(state.routinesJson || "[]");
        const remoteHistory = JSON.parse(state.historyJson || "[]");

        if (Array.isArray(remoteRoutines) && remoteRoutines.length) {
            localStorage.setItem(ROUTINES_KEY, JSON.stringify(remoteRoutines));
        } else if (getRoutines().length) {
            queueStateSync();
        }

        if (Array.isArray(remoteHistory)) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(remoteHistory));
        }

        localStorage.setItem(FITNESS_SYNC_KEY, state.updatedAt || new Date().toISOString());
    } catch {
        // Local state remains usable when the API is unavailable.
    }
}

function queueStateSync() {
    if (!getAuthToken()) {
        return;
    }

    window.clearTimeout(syncTimeoutId);
    syncTimeoutId = window.setTimeout(pushStateToApi, SYNC_DEBOUNCE_MS);
}

async function pushStateToApi() {
    const token = getAuthToken();

    if (!token) {
        return;
    }

    try {
        const response = await fetch(`${getApiBaseUrl()}/fitness/state`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                routinesJson: JSON.stringify(getRoutines()),
                historyJson: JSON.stringify(getHistory())
            })
        });

        if (response.ok) {
            const state = await response.json();
            localStorage.setItem(FITNESS_SYNC_KEY, state.updatedAt || new Date().toISOString());
        }
    } catch {
        // The next local change will retry syncing.
    }
}

function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function renderDashboard() {
    const cards = document.querySelector("#dashboard-cards");
    const routines = getRoutines();
    const history = getHistory();
    const lastWorkout = history[0];
    const thisWeek = history.filter((workout) => isThisWeek(workout.finishedAt));
    const weeklyGoal = 4;
    const progress = Math.min(100, Math.round((thisWeek.length / weeklyGoal) * 100));
    const nextRoutine = routines[0];
    const bestSet = getBestSet(history);

    cards.innerHTML = `
        <div class="card">
            <h3>Rutina sugerida</h3>
            <p>${escapeHtml(nextRoutine?.title ?? "Sin rutinas")}</p>
            <a class="card-action" href="routines.html">Ver rutinas</a>
        </div>
        <div class="card">
            <h3>Ultimo entreno</h3>
            <p>${lastWorkout ? `${escapeHtml(lastWorkout.title)} - ${formatDuration(lastWorkout.durationSeconds)}` : "Todavia no registraste entrenos."}</p>
        </div>
        <div class="card">
            <h3>Mejor serie</h3>
            <p>${bestSet ? `${escapeHtml(bestSet.exercise)}: ${bestSet.kg}kg x ${bestSet.reps}` : "Completa series para ver marcas."}</p>
        </div>
        <div class="card">
            <h3>Entrenamientos</h3>
            <p>${history.length} totales</p>
            <p>${thisWeek.length} esta semana</p>
        </div>
        <div class="card large">
            <h3>Progreso semanal</h3>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <p>${progress}% del objetivo semanal completado.</p>
        </div>
    `;
}

function renderRoutines() {
    const routines = getRoutines();
    const list = document.querySelector("#routine-list");
    const count = document.querySelector("#routine-count");

    count.textContent = `${routines.length} ${routines.length === 1 ? "rutina activa" : "rutinas activas"}`;

    if (!routines.length) {
        list.innerHTML = `<article class="routine-card empty-state"><h3>Sin rutinas</h3><p>Crea una rutina para empezar a entrenar.</p></article>`;
        return;
    }

    list.innerHTML = routines.map((routine) => {
        const exerciseNames = routine.exercises.map((exercise) => exercise.name).slice(0, 4).join(", ");

        return `
            <article class="routine-card ${escapeHtml(routine.accent || "accent-blue")}" data-routine-id="${escapeHtml(routine.id)}">
                <div class="routine-card-header">
                    <div>
                        <span class="routine-tag">${escapeHtml(routine.tag)}</span>
                        <h3>${escapeHtml(routine.title)}</h3>
                    </div>
                    <button type="button" class="more-button" data-delete-routine="${escapeHtml(routine.id)}" aria-label="Eliminar rutina">x</button>
                </div>
                <p>${escapeHtml(exerciseNames || "Rutina vacia")}</p>
                <div class="routine-meta">
                    <span>${routine.exercises.length} ejercicios</span>
                    <span>${routine.minutes || estimateMinutes(routine)} min</span>
                    <span>${escapeHtml(routine.goal)}</span>
                </div>
                <button type="button" class="primary-routine-button" data-start-routine="${escapeHtml(routine.id)}">Empezar rutina</button>
            </article>
        `;
    }).join("");

    document.querySelectorAll("[data-start-routine]").forEach((button) => {
        button.addEventListener("click", () => {
            const routine = getRoutines().find((item) => item.id === button.dataset.startRoutine);
            if (!routine) {
                return;
            }

            localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(createWorkoutFromRoutine(routine)));
            window.location.href = `workout.html?routine=${encodeURIComponent(routine.id)}`;
        });
    });

    document.querySelectorAll("[data-delete-routine]").forEach((button) => {
        button.addEventListener("click", () => {
            const routines = getRoutines();
            const routine = routines.find((item) => item.id === button.dataset.deleteRoutine);

            if (!routine || !confirm(`Eliminar ${routine.title}?`)) {
                return;
            }

            saveRoutines(routines.filter((item) => item.id !== routine.id));
            renderRoutines();
        });
    });
}

function bindRoutineActions() {
    document.querySelector("#create-routine-button")?.addEventListener("click", () => {
        const title = prompt("Nombre de la rutina", "FULL BODY");
        if (!title?.trim()) {
            return;
        }

        const tag = prompt("Grupo o categoria", "General") || "General";
        const routines = getRoutines();

        routines.unshift({
            id: uniqueId(title),
            title: title.trim().toUpperCase(),
            tag: tag.trim(),
            goal: "Personal",
            minutes: 45,
            accent: "accent-blue",
            exercises: []
        });

        saveRoutines(routines);
        renderRoutines();
    });

    document.querySelector("#add-template-button")?.addEventListener("click", () => {
        const routines = getRoutines();
        const template = {
            id: uniqueId("upper"),
            title: "UPPER",
            tag: "Torso",
            goal: "Fuerza",
            minutes: 55,
            accent: "accent-lime",
            exercises: [
                createExercise("Press Inclinado", "Pecho", 105, [[40, 8, false], [45, 8, false]]),
                createExercise("Remo Mancuerna", "Espalda", 90, [[28, 10, false], [30, 8, false]]),
                createExercise("Laterales", "Hombros", 60, [[8, 12, false], [10, 10, false]])
            ]
        };

        routines.unshift(template);
        saveRoutines(routines);
        renderRoutines();
    });

    document.querySelector("#reset-routines-button")?.addEventListener("click", () => {
        if (confirm("Restaurar las rutinas iniciales?")) {
            saveRoutines(defaultRoutines);
            renderRoutines();
        }
    });
}

function startWorkoutScreen() {
    let workout = getOrCreateActiveWorkout();

    renderWorkout(workout);
    bindWorkoutActions();

    setInterval(() => {
        workout = readJson(ACTIVE_WORKOUT_KEY, workout);
        updateWorkoutStats(workout);
    }, 1000);
}

function getOrCreateActiveWorkout() {
    const query = new URLSearchParams(window.location.search);
    const current = readJson(ACTIVE_WORKOUT_KEY, null);

    if (query.get("empty") === "1") {
        const emptyWorkout = createEmptyWorkout();
        localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(emptyWorkout));
        return emptyWorkout;
    }

    const routineId = query.get("routine");
    if (routineId) {
        const routine = getRoutines().find((item) => item.id === routineId);
        const workout = routine ? createWorkoutFromRoutine(routine) : createEmptyWorkout();
        localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
        return workout;
    }

    if (current) {
        return current;
    }

    const firstRoutine = getRoutines()[0];
    const workout = firstRoutine ? createWorkoutFromRoutine(firstRoutine) : createEmptyWorkout();
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
    return workout;
}

function createWorkoutFromRoutine(routine) {
    return {
        id: uniqueId("workout"),
        routineId: routine.id,
        title: routine.title,
        startedAt: new Date().toISOString(),
        exercises: routine.exercises.map((exercise) => ({
            ...exercise,
            sets: exercise.sets.map((set) => ({ ...set, done: false }))
        }))
    };
}

function createEmptyWorkout() {
    return {
        id: uniqueId("workout"),
        routineId: null,
        title: "Libre",
        startedAt: new Date().toISOString(),
        exercises: []
    };
}

function renderWorkout(workout) {
    document.querySelector("#workout-title").textContent = workout.title;
    renderExercises(workout);
    updateWorkoutStats(workout);
}

function renderExercises(workout) {
    const stack = document.querySelector("#exercise-stack");

    if (!workout.exercises.length) {
        stack.innerHTML = `
            <article class="exercise-block empty-state">
                <h2>Entreno vacio</h2>
                <p class="next-copy">Agrega ejercicios para empezar a registrar series.</p>
            </article>
        `;
        return;
    }

    stack.innerHTML = workout.exercises.map((exercise, exerciseIndex) => `
        <article class="exercise-block" data-exercise-index="${exerciseIndex}">
            <div class="exercise-header">
                <div class="exercise-avatar">${escapeHtml(initials(exercise.name))}</div>
                <div>
                    <span class="exercise-label">${escapeHtml(exercise.label)}</span>
                    <h2>${escapeHtml(exercise.name)}</h2>
                </div>
                <button type="button" class="more-button" data-remove-exercise="${exerciseIndex}" aria-label="Eliminar ejercicio">x</button>
            </div>
            <button type="button" class="note-button" data-note-exercise="${exerciseIndex}">
                ${exercise.note ? escapeHtml(exercise.note) : "Agregar notas aqui..."}
            </button>
            <div class="rest-chip">Descanso: ${formatRest(exercise.restSeconds)}</div>
            <div class="sets-table" role="table" aria-label="Series de ${escapeHtml(exercise.name)}">
                <div class="sets-row sets-head" role="row">
                    <span>Serie</span>
                    <span>Anterior</span>
                    <span>Kg</span>
                    <span>Reps</span>
                    <span></span>
                </div>
                ${exercise.sets.map((set, setIndex) => `
                    <div class="sets-row ${set.warmup ? "warmup" : ""} ${!set.done && isCurrentSet(exercise, setIndex) ? "current" : ""}" role="row">
                        <span>${set.warmup ? "W" : setIndex + 1}</span>
                        <span>${set.kg} x ${set.reps}</span>
                        <input type="number" min="0" step="0.5" value="${set.kg}" data-kg="${exerciseIndex}:${setIndex}" aria-label="Kg">
                        <input type="number" min="0" step="1" value="${set.reps}" data-reps="${exerciseIndex}:${setIndex}" aria-label="Reps">
                        <button type="button" class="set-check ${set.done ? "done" : ""}" data-toggle-set="${exerciseIndex}:${setIndex}" aria-label="Marcar serie">&#10003;</button>
                    </div>
                `).join("")}
            </div>
            <button type="button" class="add-set-button" data-add-set="${exerciseIndex}">+ Agregar serie</button>
        </article>
    `).join("");

    bindExerciseActions();
}

function bindWorkoutActions() {
    document.querySelector("#add-exercise-button")?.addEventListener("click", () => {
        const name = prompt("Ejercicio", "Nuevo ejercicio");
        if (!name?.trim()) {
            return;
        }

        const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());
        workout.exercises.push(createExercise(name.trim(), "Personal", 90, [[0, 10, false]]));
        saveActiveWorkout(workout);
        renderWorkout(workout);
    });

    document.querySelector("#finish-workout-top")?.addEventListener("click", finishWorkout);
    document.querySelector("#finish-workout-bottom")?.addEventListener("click", finishWorkout);
}

function bindExerciseActions() {
    document.querySelectorAll("[data-toggle-set]").forEach((button) => {
        button.addEventListener("click", () => {
            const [exerciseIndex, setIndex] = button.dataset.toggleSet.split(":").map(Number);
            const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());
            workout.exercises[exerciseIndex].sets[setIndex].done = !workout.exercises[exerciseIndex].sets[setIndex].done;
            saveActiveWorkout(workout);
            renderWorkout(workout);
        });
    });

    document.querySelectorAll("[data-kg], [data-reps]").forEach((input) => {
        input.addEventListener("change", () => {
            const key = input.dataset.kg ?? input.dataset.reps;
            const [exerciseIndex, setIndex] = key.split(":").map(Number);
            const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());
            const value = Number(input.value) || 0;

            if (input.dataset.kg) {
                workout.exercises[exerciseIndex].sets[setIndex].kg = value;
            } else {
                workout.exercises[exerciseIndex].sets[setIndex].reps = value;
            }

            saveActiveWorkout(workout);
            updateWorkoutStats(workout);
        });
    });

    document.querySelectorAll("[data-add-set]").forEach((button) => {
        button.addEventListener("click", () => {
            const exerciseIndex = Number(button.dataset.addSet);
            const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());
            const exercise = workout.exercises[exerciseIndex];
            const previous = exercise.sets.at(-1) ?? { kg: 0, reps: 10 };

            exercise.sets.push({
                id: uniqueId("set"),
                kg: previous.kg,
                reps: previous.reps,
                warmup: false,
                done: false
            });

            saveActiveWorkout(workout);
            renderWorkout(workout);
        });
    });

    document.querySelectorAll("[data-note-exercise]").forEach((button) => {
        button.addEventListener("click", () => {
            const exerciseIndex = Number(button.dataset.noteExercise);
            const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());
            const current = workout.exercises[exerciseIndex].note || "";
            const note = prompt("Nota del ejercicio", current);

            if (note === null) {
                return;
            }

            workout.exercises[exerciseIndex].note = note.trim();
            saveActiveWorkout(workout);
            renderWorkout(workout);
        });
    });

    document.querySelectorAll("[data-remove-exercise]").forEach((button) => {
        button.addEventListener("click", () => {
            const exerciseIndex = Number(button.dataset.removeExercise);
            const workout = readJson(ACTIVE_WORKOUT_KEY, createEmptyWorkout());

            workout.exercises.splice(exerciseIndex, 1);
            saveActiveWorkout(workout);
            renderWorkout(workout);
        });
    });
}

function finishWorkout() {
    const workout = readJson(ACTIVE_WORKOUT_KEY, null);

    if (!workout) {
        window.location.href = "dashboard.html";
        return;
    }

    const completedSets = workout.exercises.flatMap((exercise) =>
        exercise.sets.filter((set) => set.done).map((set) => ({ ...set, exercise: exercise.name }))
    );

    if (!completedSets.length && !confirm("Terminar sin series completadas?")) {
        return;
    }

    const finishedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((finishedAt - new Date(workout.startedAt)) / 1000));
    const history = getHistory();

    history.unshift({
        ...workout,
        finishedAt: finishedAt.toISOString(),
        durationSeconds,
        volume: calculateVolume(workout),
        completedSets: completedSets.length
    });

    saveHistory(history.slice(0, 50));
    localStorage.removeItem(ACTIVE_WORKOUT_KEY);
    window.location.href = "dashboard.html";
}

function updateWorkoutStats(workout) {
    const durationSeconds = Math.max(0, Math.round((new Date() - new Date(workout.startedAt)) / 1000));
    const completedSets = workout.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.done));
    const completedExercises = workout.exercises.filter((exercise) => exercise.sets.some((set) => set.done)).length;
    const totalExercises = workout.exercises.length;
    const progress = totalExercises ? Math.round((completedExercises / totalExercises) * 100) : 0;
    const ring = document.querySelector("#workout-progress-ring");

    document.querySelector("#workout-duration").textContent = formatDuration(durationSeconds);
    document.querySelector("#workout-volume").textContent = `${formatNumber(calculateVolume(workout))} kg`;
    document.querySelector("#workout-sets").textContent = completedSets.length;
    document.querySelector("#workout-progress-copy").textContent = `${completedExercises} de ${totalExercises} ejercicios`;
    ring.textContent = `${progress}%`;
    ring.setAttribute("aria-label", `${progress} por ciento completado`);
    ring.style.background = `radial-gradient(circle at center, #11151a 58%, transparent 60%), conic-gradient(#a3e635 ${progress}%, rgba(255,255,255,0.1) 0)`;
}

function saveActiveWorkout(workout) {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(workout));
}

function calculateVolume(workout) {
    return workout.exercises.reduce((total, exercise) => {
        return total + exercise.sets.reduce((exerciseTotal, set) => {
            return exerciseTotal + (set.done ? Number(set.kg) * Number(set.reps) : 0);
        }, 0);
    }, 0);
}

function getBestSet(history) {
    return history
        .flatMap((workout) => workout.exercises.flatMap((exercise) =>
            exercise.sets
                .filter((set) => set.done)
                .map((set) => ({ ...set, exercise: exercise.name, score: Number(set.kg) * Number(set.reps) }))
        ))
        .sort((a, b) => b.score - a.score)[0];
}

function isCurrentSet(exercise, setIndex) {
    return exercise.sets.findIndex((set) => !set.done) === setIndex;
}

function isThisWeek(dateValue) {
    const date = new Date(dateValue);
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
}

function estimateMinutes(routine) {
    return Math.max(15, routine.exercises.length * 12);
}

function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatRest(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds ? `${minutes}min ${remainingSeconds}s` : `${minutes}min`;
}

function formatNumber(value) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function initials(text) {
    return text
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function uniqueId(text) {
    return `${slugId(text)}-${Date.now().toString(36)}`;
}

function slugId(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "item";
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getAuthToken() {
    return localStorage.getItem("peak_token");
}

function getApiBaseUrl() {
    const host = window.location.hostname;

    if (host === "127.0.0.1" || host === "localhost") {
        return `${window.location.protocol}//${host}:5150`;
    }

    return "http://localhost:5150";
}
