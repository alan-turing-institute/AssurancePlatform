import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Setup mock server for testing
export const server = setupServer(...handlers);
