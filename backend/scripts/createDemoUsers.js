
require("dotenv").config({
    path: require("path").resolve(__dirname, "../.env")
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createDemoUsers() {
    try {
        // Check MongoDB connection string
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing in backend/.env");
        }

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connected successfully");

        // Demo login accounts
        const demoUsers = [
            {
                name: "Receptionist",
                email: "reception@hospital.test",
                password: "Reception@123",
                role: "receptionist"
            },
            {
                name: "Doctor",
                email: "doctor@hospital.test",
                password: "Doctor@123",
                role: "doctor",
                specialty: "General Physician"
            },
            {
                name: "Pharmacy",
                email: "pharmacy@hospital.test",
                password: "Pharmacy@123",
                role: "pharmacy"
            }
        ];

        // Create or update users
        for (const item of demoUsers) {

            const hashedPassword = await bcrypt.hash(
                item.password,
                12
            );

            const userData = {
                name: item.name,
                email: item.email.toLowerCase().trim(),
                password: hashedPassword,
                role: item.role
            };

            // Add specialty for doctor
            if (item.role === "doctor") {
                userData.specialty = item.specialty;
            }

            await User.findOneAndUpdate(
                {
                    email: item.email.toLowerCase().trim()
                },
                {
                    $set: userData
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    runValidators: true,
                    setDefaultsOnInsert: true
                }
            );

            console.log("User created/updated:", item.email);
        }

        console.log("--------------------------------");
        console.log("All demo users are ready!");
        console.log("--------------------------------");

    } catch (error) {
        console.error("User creation failed:", error.message);

    } finally {
        await mongoose.disconnect();
        console.log("MongoDB disconnected");
    }
}

createDemoUsers();
