import { defaultDebugState } from '@/App/migrations/v2_default';
import { createContext } from "react";

export const DebugContext = createContext(defaultDebugState);
