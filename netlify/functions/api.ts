import serverless from "serverless-http";
import { app } from "../../backend/src/aplicacao";

export const handler = serverless(app);
