
// ================= ENVIRONMENT CONFIGURATION =================

require("dotenv").config({
    path: require("path").resolve(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Patient = require("./models/Patient");
const User = require("./models/User");

const {
    authenticateToken,
    authorizeRoles
} = require("./middleware/auth");

const app = express();

// ================= MIDDLEWARE =================

// CORS FIX: Allow frontend requests from local and deployed websites.
// JWT authentication still protects the API routes.

app.use(cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204
}));

app.use(express.json({ limit: "1mb" }));

// ================= HOME ROUTE =================

app.get("/", (req, res) => {
    res.status(200).json({
        message: "Hospital Management System API is running!",
        status: "success"
    });
});

// ================= DEPARTMENTS =================

const departments = {
    "General Medicine": "General Physician",
    "Heart": "Cardiologist",
    "Skin": "Dermatologist",
    "Bones and Joints": "Orthopedic",
    "Eyes": "Ophthalmologist",
    "Stomach and Digestion": "Gastroenterologist"
};

// ================= LOGIN =================

app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: "JWT_SECRET is missing"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim()
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                specialty: user.specialty || ""
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Login failed"
        });
    }
});

// ================= DEPARTMENT OPTIONS =================

app.get(
    "/api/departments",
    authenticateToken,
    authorizeRoles("receptionist"),
    (req, res) => {
        const result = Object.entries(departments).map(
            ([name, specialty]) => ({
                name,
                specialty
            })
        );

        res.json(result);
    }
);

// ================= DOCTOR DROPDOWN =================

app.get(
    "/api/doctors",
    authenticateToken,
    authorizeRoles("receptionist"),
    async (req, res) => {
        try {
            const { department } = req.query;

            if (!department || !departments[department]) {
                return res.status(400).json({
                    message: "Choose a valid department first"
                });
            }

            const specialty = departments[department];

            const doctors = await User.find({
                role: "doctor",
                specialty: specialty
            }).select("_id name specialty");

            return res.json(doctors);

        } catch (error) {
            console.error("Fetch doctors error:", error);

            return res.status(500).json({
                message: "Failed to fetch doctors"
            });
        }
    }
);

// ================= ALL PATIENTS =================

app.get(
    "/api/patients",
    authenticateToken,
    authorizeRoles("receptionist"),
    async (req, res) => {
        try {
            const patients = await Patient.find()
                .sort({ createdAt: -1 })
                .lean();

            return res.json(patients);

        } catch (error) {
            console.error("Fetch patients error:", error);

            return res.status(500).json({
                message: "Failed to fetch patients"
            });
        }
    }
);

// ================= REGISTER PATIENT =================

app.post(
    "/api/patients",
    authenticateToken,
    authorizeRoles("receptionist"),
    async (req, res) => {
        try {
            const {
                name,
                age,
                gender,
                phone,
                problem,
                department,
                doctorId
            } = req.body;

            if (
                !name?.trim() ||
                age === undefined ||
                !gender ||
                !phone?.trim() ||
                !problem?.trim() ||
                !department ||
                !doctorId
            ) {
                return res.status(400).json({
                    message: "Please fill in all required patient details"
                });
            }

            if (
                !Number.isInteger(Number(age)) ||
                Number(age) < 0 ||
                Number(age) > 120
            ) {
                return res.status(400).json({
                    message: "Please enter a valid patient age"
                });
            }

            if (!["Female", "Male", "Other"].includes(gender)) {
                return res.status(400).json({
                    message: "Please select a valid gender"
                });
            }

            if (!departments[department]) {
                return res.status(400).json({
                    message: "Invalid department"
                });
            }

            if (!mongoose.isValidObjectId(doctorId)) {
                return res.status(400).json({
                    message: "Please select a valid doctor"
                });
            }

            const doctor = await User.findOne({
                _id: doctorId,
                role: "doctor",
                specialty: departments[department]
            });

            if (!doctor) {
                return res.status(400).json({
                    message: "Selected doctor does not match this department"
                });
            }

            const patient = await Patient.create({
                name: name.trim(),
                age: Number(age),
                gender,
                phone: phone.trim(),
                problem: problem.trim(),
                department,
                doctor: doctor.name,
                doctorId: doctor._id,
                status: "Assigned"
            });

            return res.status(201).json({
                message: "Patient registered and doctor assigned successfully",
                patient
            });

        } catch (error) {
            console.error("Register patient error:", error);

            return res.status(400).json({
                message: "Patient registration failed",
                error: error.message
            });
        }
    }
);

// ================= DOCTOR'S ASSIGNED PATIENTS =================

app.get(
    "/api/doctor/patients",
    authenticateToken,
    authorizeRoles("doctor"),
    async (req, res) => {
        try {
            const patients = await Patient.find({
                doctorId: req.user.id
            }).sort({ createdAt: -1 });

            return res.json(patients);

        } catch (error) {
            console.error("Doctor patient list error:", error);

            return res.status(500).json({
                message: "Failed to fetch assigned patients"
            });
        }
    }
);

// ================= DOCTOR ADDS PRESCRIPTION =================

app.patch(
    "/api/doctor/patients/:id/prescription",
    authenticateToken,
    authorizeRoles("doctor"),
    async (req, res) => {
        try {
            const { diagnosis, prescription } = req.body;

            if (!diagnosis?.trim()) {
                return res.status(400).json({
                    message: "Diagnosis is required"
                });
            }

            if (!Array.isArray(prescription) || prescription.length === 0) {
                return res.status(400).json({
                    message: "Add at least one prescription item"
                });
            }

            const validItems = prescription.every(item =>
                item &&
                typeof item.medicine === "string" &&
                item.medicine.trim() &&
                typeof item.dosage === "string" &&
                item.dosage.trim()
            );

            if (!validItems) {
                return res.status(400).json({
                    message: "Each medicine needs a name and dosage"
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid patient ID"
                });
            }

            const patient = await Patient.findOne({
                _id: req.params.id,
                doctorId: req.user.id
            });

            if (!patient) {
                return res.status(404).json({
                    message: "Assigned patient not found"
                });
            }

            patient.diagnosis = diagnosis.trim();

            patient.prescription = prescription.map(item => ({
                medicine: item.medicine.trim(),
                dosage: item.dosage.trim(),
                instructions: (item.instructions || "").trim(),
                dispensed: false
            }));

            patient.status = "Prescription Ready";

            await patient.save();

            return res.json({
                message: "Prescription saved successfully",
                patient
            });

        } catch (error) {
            console.error("Prescription error:", error);

            return res.status(400).json({
                message: "Failed to save prescription",
                error: error.message
            });
        }
    }
);

// ================= PHARMACY PRESCRIPTIONS =================

app.get(
    "/api/pharmacy/prescriptions",
    authenticateToken,
    authorizeRoles("pharmacy"),
    async (req, res) => {
        try {
            const patients = await Patient.find({
                prescription: { $exists: true, $ne: [] }
            }).sort({ updatedAt: -1 });

            return res.json(patients);

        } catch (error) {
            console.error("Pharmacy fetch error:", error);

            return res.status(500).json({
                message: "Failed to fetch prescriptions"
            });
        }
    }
);

// ================= MARK MEDICINE AS DISPENSED =================

app.patch(
    "/api/pharmacy/patients/:id/dispense",
    authenticateToken,
    authorizeRoles("pharmacy"),
    async (req, res) => {
        try {
            const { medicineIndex } = req.body;

            if (
                !Number.isInteger(medicineIndex) ||
                medicineIndex < 0
            ) {
                return res.status(400).json({
                    message: "Invalid medicine selection"
                });
            }

            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid patient ID"
                });
            }

            const patient = await Patient.findById(req.params.id);

            if (!patient) {
                return res.status(404).json({
                    message: "Patient not found"
                });
            }

            if (
                !patient.prescription ||
                !patient.prescription[medicineIndex]
            ) {
                return res.status(404).json({
                    message: "Prescription item not found"
                });
            }

            patient.prescription[medicineIndex].dispensed = true;

            const allDispensed =
                patient.prescription.length > 0 &&
                patient.prescription.every(item => item.dispensed);

            patient.status = allDispensed
                ? "Medicine Dispensed"
                : "Prescription Ready";

            await patient.save();

            return res.json({
                message: "Medicine dispensing status updated",
                patient
            });

        } catch (error) {
            console.error("Dispense medicine error:", error);

            return res.status(400).json({
                message: "Failed to update dispensing status",
                error: error.message
            });
        }
    }
);

// ================= DELETE PATIENT =================

app.delete(
    "/api/patients/:id",
    authenticateToken,
    authorizeRoles("receptionist"),
    async (req, res) => {
        try {
            if (!mongoose.isValidObjectId(req.params.id)) {
                return res.status(400).json({
                    message: "Invalid patient ID"
                });
            }

            const patient = await Patient.findByIdAndDelete(
                req.params.id
            );

            if (!patient) {
                return res.status(404).json({
                    message: "Patient not found"
                });
            }

            return res.json({
                message: "Patient deleted successfully"
            });

        } catch (error) {
            console.error("Delete patient error:", error);

            return res.status(400).json({
                message: "Failed to delete patient"
            });
        }
    }
);

// ================= ERROR HANDLING =================

app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    return res.status(500).json({
        message: "Internal server error"
    });
});

// ================= START SERVER =================

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error(
                "MONGO_URI is missing in environment variables"
            );
        }

        if (!process.env.JWT_SECRET) {
            throw new Error(
                "JWT_SECRET is missing in environment variables"
            );
        }

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000
        });

        console.log("MongoDB connected successfully");

        app.listen(PORT, "0.0.0.0", () => {
            console.log(`Server running on port ${PORT}`);
        });

    } catch (error) {
        console.error("Server startup failed:", error.message);
        process.exit(1);
    }
}

startServer();
