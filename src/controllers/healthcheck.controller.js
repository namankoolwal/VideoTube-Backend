import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (req, res) => {
    
    // check database connection status
    const dbStatus = mongoose.connection.readyState === 1 ? "db Connected" : "db Disconnected";

    // health check object
    const healthCheck = {
        dbStatus,
        uptime: process.uptime(),
        message: "OK",
        timestamp: Date.now(),
        hrtime: process.hrtime(),
    };

    try {
        // throw error if database is disconnected
        if (dbStatus === "db Disconnected") {
            throw new Error("Database is disconnected");
        }

        // set server status
        healthCheck.serverStatus = `Server is running on port no ${process.env.PORT}`;
        // return health check response
        return res.status(200).json(new ApiResponse(200, healthCheck, "Health Check Successful"));
    } catch (error) {
        // set error message if health check fails
        healthCheck.error = error.message;
        // return health check response
        return res.status(500).json(new ApiResponse(500, healthCheck, "Health Check Failed"));
    }
});

export { healthcheck };
