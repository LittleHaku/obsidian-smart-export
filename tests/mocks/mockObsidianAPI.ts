import { vi } from "vitest";
import { App, Vault, MetadataCache } from "obsidian";

// Partial mocks to satisfy TypeScript
export const mockVault = {
	getAbstractFileByPath: vi.fn(),
	getFileByPath: vi.fn(),
	cachedRead: vi.fn(),
	getFiles: vi.fn(() => []),
} as unknown as Vault;

export const mockMetadataCache = {
	getCache: vi.fn(),
	getFirstLinkpathDest: vi.fn(),
} as unknown as MetadataCache;

export const mockApp = {
	vault: mockVault,
	metadataCache: mockMetadataCache,
} as unknown as App;
