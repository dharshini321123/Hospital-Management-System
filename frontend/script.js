
const API_URL = "https://hospital-management-system-k93c.onrender.com";

const $ = (id) => document.getElementById(id);

let currentUser = null;
let departments = [];

async function apiRequest(endpoint, options = {}) {
    const token = sessionStorage.getItem("hospitalToken");
    const headers = { ...(options.headers || {}) };

    if (options.body) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || `Request failed (${response.status})`);
    }

    return data;
}

function message(id, text, type = "") {
    $(id).textContent = text;
    $(id).className = `message ${type}`;
}

function makeText(tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text ?? "";
    if (className) element.className = className;
    return element;
}

function showNotice(text) {
    $("notice").textContent = text;
    $("notice").classList.remove("hidden");
}

function hideNotice() {
    $("notice").textContent = "";
    $("notice").classList.add("hidden");
}

// ---------------- LOGIN ----------------
$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    message("loginMessage", "Signing in...");

    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email: $("email").value.trim(),
                password: $("password").value
            })
        });

        if (!result.token || !result.user) {
            throw new Error("Invalid login response");
        }

        if (!["receptionist", "doctor", "pharmacy"].includes(result.user.role)) {
            throw new Error("Unsupported staff role");
        }

        sessionStorage.setItem("hospitalToken", result.token);
        currentUser = result.user;
        $("loginForm").reset();
        await showDashboard();
    } catch (error) {
        message("loginMessage", error.message, "error");
    }
});

// ---------------- DASHBOARD ----------------
async function showDashboard() {
    hideNotice();
    $("loginSection").classList.add("hidden");
    $("dashboardSection").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");

    ["receptionPanel", "doctorPanel", "pharmacyPanel"].forEach((id) => {
        $(id).classList.add("hidden");
    });

    const role = currentUser.role;
    $("dashboardTitle").textContent =
        role.charAt(0).toUpperCase() + role.slice(1) + " Dashboard";
    $("roleBadge").textContent = role;
    $("welcomeText").textContent = `Welcome, ${currentUser.name || role}`;

    try {
        if (role === "receptionist") {
            $("receptionPanel").classList.remove("hidden");
            await loadDepartments();
            await loadPatients();
        } else if (role === "doctor") {
            $("doctorPanel").classList.remove("hidden");
            await loadDoctorPatients();
        } else if (role === "pharmacy") {
            $("pharmacyPanel").classList.remove("hidden");
            await loadPrescriptions();
        }
    } catch (error) {
        showNotice(error.message);
    }
}

// ---------------- DEPARTMENT AND DOCTOR DROPDOWNS ----------------
async function loadDepartments() {
    departments = await apiRequest("/departments");

    const select = $("department");
    select.replaceChildren(new Option("Select problem category", ""));

    departments.forEach((department) => {
        select.add(new Option(department.name, department.name));
    });

    $("doctorSelect").replaceChildren(
        new Option("Select category first", "")
    );
    $("doctorSelect").disabled = true;
}

$("department").addEventListener("change", async () => {
    const department = $("department").value;
    const doctorSelect = $("doctorSelect");

    doctorSelect.replaceChildren(new Option("Loading doctors...", ""));
    doctorSelect.disabled = true;

    if (!department) {
        doctorSelect.replaceChildren(new Option("Select category first", ""));
        return;
    }

    try {
        const doctors = await apiRequest(
            `/doctors?department=${encodeURIComponent(department)}`
        );

        doctorSelect.replaceChildren();

        if (doctors.length === 0) {
            doctorSelect.add(new Option("No matching doctor available", ""));
            return;
        }

        doctorSelect.add(new Option("Select doctor", ""));

        doctors.forEach((doctor) => {
            doctorSelect.add(new Option(
                `${doctor.name} — ${doctor.specialty}`,
                doctor._id
            ));
        });

        doctorSelect.disabled = false;
    } catch (error) {
        doctorSelect.replaceChildren(new Option("Could not load doctors", ""));
        message("patientMessage", error.message, "error");
    }
});

// ---------------- REGISTER PATIENT ----------------
$("patientForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = event.submitter;
    if (submitButton) submitButton.disabled = true;

    const patient = {
        name: $("patientName").value.trim(),
        age: Number($("patientAge").value),
        gender: $("patientGender").value,
        phone: $("patientPhone").value.trim(),
        problem: $("patientProblem").value.trim(),
        department: $("department").value,
        doctorId: $("doctorSelect").value
    };

    try {
        const result = await apiRequest("/patients", {
            method: "POST",
            body: JSON.stringify(patient)
        });

        message(
            "patientMessage",
            result.message || "Patient registered successfully",
            "success"
        );

        $("patientForm").reset();
        await loadDepartments();
        await loadPatients();
    } catch (error) {
        message("patientMessage", error.message, "error");
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
});

// ---------------- RECEPTIONIST PATIENT LIST ----------------
$("refreshPatients").addEventListener("click", loadPatients);

async function loadPatients() {
    const list = $("patientList");
    list.textContent = "Loading patients...";

    try {
        const patients = await apiRequest("/patients");
        list.replaceChildren();

        if (!patients.length) {
            list.appendChild(makeText("p", "No patients registered yet.", "muted"));
            return;
        }

        patients.forEach((patient) => {
            const card = makeText("article", "", "patient-item");
            card.appendChild(makeText("h3", patient.name));
            card.appendChild(makeText("p", `Age: ${patient.age} | Gender: ${patient.gender}`));
            card.appendChild(makeText("p", `Phone: ${patient.phone}`));
            card.appendChild(makeText("p", `Problem: ${patient.problem}`));
            card.appendChild(makeText("p", `Department: ${patient.department}`));
            card.appendChild(makeText("p", `Assigned Doctor: ${patient.doctor}`));
            card.appendChild(makeText("p", `Status: ${patient.status}`));

            const deleteButton = makeText("button", "Delete patient", "btn btn-outline");
            deleteButton.addEventListener("click", async () => {
                if (!window.confirm(`Delete patient ${patient.name}?`)) return;

                try {
                    await apiRequest(`/patients/${encodeURIComponent(patient._id)}`, {
                        method: "DELETE"
                    });
                    await loadPatients();
                } catch (error) {
                    showNotice(error.message);
                }
            });

            card.appendChild(deleteButton);
            list.appendChild(card);
        });
    } catch (error) {
        list.textContent = "";
        list.appendChild(makeText("p", error.message, "message error"));
    }
}

// ---------------- DOCTOR PATIENTS ----------------
$("refreshDoctorPatients").addEventListener("click", loadDoctorPatients);

async function loadDoctorPatients() {
    const list = $("doctorPatientList");
    list.textContent = "Loading assigned patients...";

    try {
        const patients = await apiRequest("/doctor/patients");
        list.replaceChildren();

        if (!patients.length) {
            list.appendChild(makeText("p", "No patients assigned to you yet.", "muted"));
            return;
        }

        patients.forEach((patient) => {
            const card = makeText("article", "", "patient-item");
            card.appendChild(makeText("h3", patient.name));
            card.appendChild(makeText("p", `Age: ${patient.age} | Gender: ${patient.gender}`));
            card.appendChild(makeText("p", `Phone: ${patient.phone}`));
            card.appendChild(makeText("p", `Problem: ${patient.problem}`));
            card.appendChild(makeText("p", `Department: ${patient.department}`));
            card.appendChild(makeText("p", `Status: ${patient.status}`));

            const form = document.createElement("form");
            form.appendChild(makeText("h3", "Consultation & Prescription"));

            const diagnosisLabel = makeText("label", "Diagnosis");
            const diagnosis = document.createElement("textarea");
            diagnosis.required = true;
            diagnosis.rows = 2;
            diagnosis.maxLength = 2000;
            diagnosis.placeholder = "Enter clinical diagnosis";
            diagnosis.value = patient.diagnosis || "";

            const medicineLabel = makeText("label", "Medicine name");
            const medicine = document.createElement("input");
            medicine.required = true;
            medicine.maxLength = 200;
            medicine.placeholder = "Medicine name";

            const dosageLabel = makeText("label", "Dosage");
            const dosage = document.createElement("input");
            dosage.required = true;
            dosage.maxLength = 200;
            dosage.placeholder = "As prescribed by the clinician";

            const instructionsLabel = makeText("label", "Instructions");
            const instructions = document.createElement("input");
            instructions.maxLength = 500;
            instructions.placeholder = "Instructions, if any";

            const submit = makeText("button", "Save Prescription", "btn btn-primary");
            submit.type = "submit";

            form.append(
                diagnosisLabel, diagnosis,
                medicineLabel, medicine,
                dosageLabel, dosage,
                instructionsLabel, instructions,
                submit
            );

            form.addEventListener("submit", async (event) => {
                event.preventDefault();
                submit.disabled = true;

                try {
                    const existingItems = patient.prescription || [];
                    const items = [
                        ...existingItems.map((item) => ({
                            medicine: item.medicine,
                            dosage: item.dosage,
                            instructions: item.instructions || ""
                        })),
                        {
                            medicine: medicine.value.trim(),
                            dosage: dosage.value.trim(),
                            instructions: instructions.value.trim()
                        }
                    ];

                    await apiRequest(
                        `/doctor/patients/${encodeURIComponent(patient._id)}/prescription`,
                        {
                            method: "PATCH",
                            body: JSON.stringify({
                                diagnosis: diagnosis.value.trim(),
                                prescription: items
                            })
                        }
                    );

                    showNotice("Prescription saved successfully.");
                    await loadDoctorPatients();
                } catch (error) {
                    showNotice(error.message);
                } finally {
                    submit.disabled = false;
                }
            });

            card.appendChild(form);
            list.appendChild(card);
        });
    } catch (error) {
        list.textContent = "";
        list.appendChild(makeText("p", error.message, "message error"));
    }
}

// ---------------- PHARMACY ----------------
$("refreshPrescriptions").addEventListener("click", loadPrescriptions);

async function loadPrescriptions() {
    const list = $("prescriptionList");
    list.textContent = "Loading prescriptions...";

    try {
        const patients = await apiRequest("/pharmacy/prescriptions");
        list.replaceChildren();

        if (!patients.length) {
            list.appendChild(makeText("p", "No prescriptions available.", "muted"));
            return;
        }

        patients.forEach((patient) => {
            const card = makeText("article", "", "patient-item");
            card.appendChild(makeText("h3", patient.name));
            card.appendChild(makeText("p", `Doctor: ${patient.doctor}`));
            card.appendChild(makeText("p", `Diagnosis: ${patient.diagnosis || "Not provided"}`));

            (patient.prescription || []).forEach((item, index) => {
                const row = makeText(
                    "div",
                    `${item.medicine} — ${item.dosage}${item.instructions ? ` (${item.instructions})` : ""}`
                );
                card.appendChild(row);

                if (item.dispensed) {
                    card.appendChild(makeText("p", "Dispensed ✓", "message success"));
                } else {
                    const button = makeText("button", "Mark as dispensed", "btn btn-outline");
                    button.type = "button";

                    button.addEventListener("click", async () => {
                        button.disabled = true;

                        try {
                            await apiRequest(
                                `/pharmacy/patients/${encodeURIComponent(patient._id)}/dispense`,
                                {
                                    method: "PATCH",
                                    body: JSON.stringify({ medicineIndex: index })
                                }
                            );

                            await loadPrescriptions();
                        } catch (error) {
                            showNotice(error.message);
                            button.disabled = false;
                        }
                    });

                    card.appendChild(button);
                }
            });

            card.appendChild(makeText("p", `Status: ${patient.status}`));
            list.appendChild(card);
        });
    } catch (error) {
        list.textContent = "";
        list.appendChild(makeText("p", error.message, "message error"));
    }
}

// ---------------- LOGOUT ----------------
$("logoutBtn").addEventListener("click", logout);

function logout() {
    sessionStorage.removeItem("hospitalToken");
    currentUser = null;

    $("dashboardSection").classList.add("hidden");
    $("loginSection").classList.remove("hidden");
    $("logoutBtn").classList.add("hidden");

    ["receptionPanel", "doctorPanel", "pharmacyPanel"].forEach((id) => {
        $(id).classList.add("hidden");
    });

    $("loginForm").reset();
    message("loginMessage", "");
    hideNotice();
}
