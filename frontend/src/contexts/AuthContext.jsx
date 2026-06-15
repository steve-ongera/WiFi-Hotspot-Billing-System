/**
 * contexts/AuthContext.jsx
 *
 * Re-exports AuthContext and useAuth from App.jsx so components can import
 * from a dedicated context file rather than directly from App.
 *
 * Usage:
 *   import { useAuth } from "../contexts/AuthContext";
 */
export { AuthContext, useAuth } from "../App";