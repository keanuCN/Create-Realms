export type Role = "admin" | "member";

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export type AssetKind = "video" | "image";
export type AssetStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Asset {
  id: string;
  userId: string;
  kind: AssetKind;
  provider: string;
  model: string;
  status: AssetStatus;
  prompt: string;
  params: Record<string, unknown>;
  providerTaskId: string | null;
  storageKey: string | null;
  posterKey: string | null;
  remoteUrl: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  durationSeconds: number | null;
  resolution: string | null;
  aspectRatio: string | null;
  usage: Record<string, unknown> | null;
  isFavorite: boolean;
  isPublic: boolean;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AssetWithUser extends Asset {
  authorName: string;
  authorUsername: string;
  mediaUrl: string | null;
  shareToken: string | null;
}

export interface PromptTemplate {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  kind: "video" | "image" | "any";
  isShared: boolean;
  useCount: number;
  createdAt: string;
  updatedAt: string;
  authorName?: string;
}
