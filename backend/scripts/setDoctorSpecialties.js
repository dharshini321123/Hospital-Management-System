
require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const doctors = [
    {
        name: "General Physician",
        email: "doctor@hospital.test",
        password: "Doctor@123",
        specialty: "General Physician"
    },
    {
        name: "Heart Specialist",
        email: "doctor.heart@hospital.test",
        password: "Heart@123",
        specialty: "Cardiologist"
    },
    {
        name: "Skin Specialist",
        email: "doctor.skin@hospital.test",
        password: "Skin@123",
        specialty: "Dermatologist"
    },
    {
        name: "Bone Specialist",
        email: "doctor.orthopedic@hospital.test",
        password: "Bone@123",
        specialty: "Orthopedic"
    },
    {
        name: "Eye Specialist",
        email: "doctor.eyes@hospital.test",
        password: "Eyes@123",
        specialty: "Ophthalmologist"
    },
    {
        name: "Digestive Health Specialist",
        email: "doctor.gastro@hospital.test",
        password: "Digest@123",
        specialty: "Gastroenterologist"
    }
];

async function setupDoctors() {
    let connected = false;

    try {
        // Check MongoDB connection string
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing in backend/.env");
        }

        // Connect to MongoDB Atlas
        await mongoose.connect(process.env.MONGO_URI);

        connected = true;

        console.log("MongoDB connected successfully");
        console.log("--------------------------------");

        // Create or update all doctor accounts
        for (const doctor of doctors) {

            const email = doctor.email.toLowerCase().trim();

            // Check whether email already exists
            const existingUser = await User.findOne({ email });

            // Do not overwrite another user role
            if (existingUser && existingUser.role !== "doctor") {
                console.log("Skipped: Account belongs to another role:", email);
                continue;
            }

            // Hash password every time to ensure the latest password works
            const hashedPassword = await bcrypt.hash(
                doctor.password,
                12
            );

            const userData = {
                name: doctor.name,
                email: email,
                password: hashedPassword,
                role: "doctor",
                specialty: doctor.specialty
            };

            // Create new account or update existing doctor
            await User.findOneAndUpdate(
                { email },
                { $set: userData },
                {
                    upsert: true,
                    returnDocument: "after",
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            console.log("Doctor ready:", email);
        }

        console.log("--------------------------------");
        console.log("All doctor accounts are ready!");
        console.log("--------------------------------");

    } catch (error) {
        console.error("Doctor setup failed:", error.message);
        process.exitCode = 1;

    } finally {
        if (connected) {
            await mongoose.disconnect();
            console.log("MongoDB disconnected");
        }
    }
}

setupDoctors();
