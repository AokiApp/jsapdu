/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Smart Card MCP Server Type Definitions
 */
import { UserError } from "fastmcp";

import { SmartCard, SmartCardDevice } from "@aokiapp/interface";

/**
 * Card connection information stored in FastMCP session
 */
export interface CardConnectionInfo {
  readerId: string;
  atr: string;
  protocol: "T=0" | "T=1" | "T=CL";
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * FastMCP session structure for Smart Card MCP
 */
export interface SmartCardMcpSessionStruct {
  cardConnection?: CardConnectionInfo;
  device?: SmartCardDevice;
  card?: SmartCard;
  [key: string]: any; // Index signature required by FastMCP
}

/**
 * Context passed to tool functions
 */
export interface SmartCardMcpSessionContext {
  session: SmartCardMcpSessionStruct;
  log: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
}

/**
 * Smart Card MCP specific error
 */
export class SmartcardMcpError extends UserError {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = "SmartcardMcpError";
  }
}

/**
 * APDU Status Code categories
 */
export type StatusCodeCategory = "success" | "warning" | "error";

/**
 * APDU Status Code information
 */
export interface StatusCodeInfo {
  sw: string;
  category: StatusCodeCategory;
  meaning: string;
  action: string;
}

/**
 * Reader information
 */
export interface ReaderInfo {
  id: string;
  name: string;
  isAvailable: boolean;
  hasCard: boolean;
  description?: string;
  isIntegrated?: boolean;
  isRemovable?: boolean;
  supportsApdu?: boolean;
  supportsHce?: boolean;
}

/**
 * APDU command types
 */
export type ApduCommandType = "hex" | "structured";

/**
 * Base APDU command
 */
export interface BaseApduCommand {
  type: ApduCommandType;
}

/**
 * Hex APDU command
 */
export interface HexApduCommand extends BaseApduCommand {
  type: "hex";
  command: string;
}

/**
 * Structured APDU command
 */
export interface StructuredApduCommand extends BaseApduCommand {
  type: "structured";
  cla: number;
  ins: number;
  p1: number;
  p2: number;
  data?: string;
  le?: number;
}

/**
 * APDU command union type
 */
export type ApduCommand = HexApduCommand | StructuredApduCommand;

/**
 * APDU response
 */
export interface ApduResponse {
  success: boolean;
  data: string;
  sw: string;
  timing: number;
}
