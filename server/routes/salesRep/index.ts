import express from "express";
import salesRepsRouter from "./salesReps";

const router = express.Router();

// Mount sales reps router at the root
router.use("/", salesRepsRouter);

export default router;