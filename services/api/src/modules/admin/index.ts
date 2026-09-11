import { Router } from "express";
import { adminAuthRouter } from "./admin-auth.router.js";
import { adminDashboardRouter } from "./admin-dashboard.router.js";
import { adminContentRouter } from "./admin-content.router.js";
import { adminHomeRouter } from "./admin-home.router.js";
import { adminUsersRouter } from "./admin-users.router.js";
import { adminBillingRouter } from "./admin-billing.router.js";
import { adminAdminsRouter } from "./admin-admins.router.js";

export const adminRouter = Router();

adminRouter.use("/auth", adminAuthRouter);
adminRouter.use("/dashboard", adminDashboardRouter);
adminRouter.use("/content", adminContentRouter);
adminRouter.use("/home", adminHomeRouter);
adminRouter.use("/users", adminUsersRouter);
adminRouter.use("/billing", adminBillingRouter);
adminRouter.use("/admins", adminAdminsRouter);
