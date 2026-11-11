
const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true,
        min: 0,
        max: 120
    },
    gender: {
        type: String,
        enum: ["Female", "Male", "Other"],
        required: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    problem: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true,
        trim: true
    },
    doctor: {
        type: String,
        required: true,
        trim: true
    },
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    status: {
        type: String,
        enum: [
            "Assigned",
            "In Consultation",
            "Prescription Ready",
            "Medicine Dispensed",
            "Completed"
        ],
        default: "Assigned"
    },
    diagnosis: {
        type: String,
        default: ""
    },
    prescription: [{
        medicine: {
            type: String,
            trim: true
        },
        dosage: {
            type: String,
            trim: true
        },
        instructions: {
            type: String,
            trim: true
        },
        dispensed: {
            type: Boolean,
            default: false
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model("Patient", patientSchema);
