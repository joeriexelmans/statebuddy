import { defaultDebugState } from '@/App/migrations/v1_default';
import { createContext } from "react";

export const DebugContext = createContext(defaultDebugState);
