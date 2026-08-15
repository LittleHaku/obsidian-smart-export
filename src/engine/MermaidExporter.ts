import { ExportNode } from "../types";
import { isSyntheticExportNode } from "./exportTreeComposition";

const DEPTH_STYLES = [
	{ fill: "#e3f2fd", stroke: "#1565c0" },
	{ fill: "#e8f5e9", stroke: "#2e7d32" },
	{ fill: "#fff3e0", stroke: "#ef6c00" },
	{ fill: "#fce4ec", stroke: "#ad1457" },
	{ fill: "#ede7f6", stroke: "#4527a0" },
	{ fill: "#e0f2f1", stroke: "#00695c" },
	{ fill: "#fffde7", stroke: "#f9a825" },
	{ fill: "#fbe9e7", stroke: "#d84315" },
] as const;

interface MermaidNote {
	node: ExportNode;
	mermaidId: string;
}

interface MermaidEdge {
	source: string;
	target: string;
}

/** Serializes the selected export graph into a Mermaid flowchart. */
export class MermaidExporter {
	public export(rootNode: ExportNode): string {
		const notes = this.flattenTree(rootNode);
		const mermaidNotes = this.createMermaidNotes(notes);
		const mermaidIds = new Map(mermaidNotes.map((note) => [note.node.id, note.mermaidId]));
		const edges = this.createEdges(rootNode, notes, mermaidIds);
		const usedDepths = [...new Set(notes.map((note) => this.getDepth(note.depth)))].sort(
			(a, b) => a - b
		);

		const lines = ["```mermaid", "flowchart TD"];
		for (const { node, mermaidId } of mermaidNotes) {
			lines.push(`    ${mermaidId}["${this.escapeLabel(node.title)}"]`);
		}

		if (edges.length > 0) {
			lines.push("");
			for (const edge of edges) {
				lines.push(`    ${edge.source} --> ${edge.target}`);
			}
		}

		if (usedDepths.length > 0) {
			lines.push("");
			for (const depth of usedDepths) {
				const style = DEPTH_STYLES[depth % DEPTH_STYLES.length];
				lines.push(
					`    classDef depth${depth} fill:${style.fill},stroke:${style.stroke},color:#1f2937`
				);
			}
			for (const { node, mermaidId } of mermaidNotes) {
				lines.push(`    class ${mermaidId} depth${this.getDepth(node.depth)}`);
			}
		}

		lines.push("```");
		return lines.join("\n");
	}

	private flattenTree(rootNode: ExportNode): ExportNode[] {
		const notes: ExportNode[] = [];
		const seenIds = new Set<string>();
		const queue: ExportNode[] = [rootNode];

		for (let index = 0; index < queue.length; index += 1) {
			const node = queue[index];
			if (!isSyntheticExportNode(node) && !seenIds.has(node.id)) {
				seenIds.add(node.id);
				notes.push(node);
			}
			queue.push(...node.children);
		}

		return notes;
	}

	private createMermaidNotes(notes: ExportNode[]): MermaidNote[] {
		const usedIds = new Set<string>();
		return notes.map((node) => {
			const baseId = `note_${this.hash(node.id)}`;
			let mermaidId = baseId;
			let suffix = 2;
			while (usedIds.has(mermaidId)) {
				mermaidId = `${baseId}_${suffix}`;
				suffix += 1;
			}
			usedIds.add(mermaidId);
			return { node, mermaidId };
		});
	}

	private createEdges(
		rootNode: ExportNode,
		notes: ExportNode[],
		mermaidIds: Map<string, string>
	): MermaidEdge[] {
		const hasGraphMetadata = notes.some((node) => Array.isArray(node.outgoingLinks));
		const edges = new Map<string, MermaidEdge>();

		if (hasGraphMetadata) {
			for (const note of notes) {
				for (const targetPath of note.outgoingLinks ?? []) {
					this.addEdge(edges, mermaidIds, note.id, targetPath);
				}
			}
		} else {
			this.addTreeEdges(rootNode, mermaidIds, edges);
		}

		return [...edges.values()];
	}

	private addTreeEdges(
		node: ExportNode,
		mermaidIds: Map<string, string>,
		edges: Map<string, MermaidEdge>
	): void {
		if (!isSyntheticExportNode(node)) {
			for (const child of node.children) {
				if (!isSyntheticExportNode(child)) {
					this.addEdge(edges, mermaidIds, node.id, child.id);
				}
				this.addTreeEdges(child, mermaidIds, edges);
			}
			return;
		}

		for (const child of node.children) this.addTreeEdges(child, mermaidIds, edges);
	}

	private addEdge(
		edges: Map<string, MermaidEdge>,
		mermaidIds: Map<string, string>,
		sourcePath: string,
		targetPath: string
	): void {
		const source = mermaidIds.get(sourcePath);
		const target = mermaidIds.get(targetPath);
		if (!source || !target) return;
		const key = `${source}\u0000${target}`;
		if (!edges.has(key)) edges.set(key, { source, target });
	}

	private getDepth(depth: number): number {
		return Number.isFinite(depth) ? Math.max(0, Math.floor(depth)) : 0;
	}

	private escapeLabel(title: string): string {
		return title
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/[\r\n]+/g, " ");
	}

	private hash(value: string): string {
		let hash = 2166136261;
		for (let index = 0; index < value.length; index += 1) {
			hash ^= value.charCodeAt(index);
			hash = Math.imul(hash, 16777619);
		}
		return (hash >>> 0).toString(16).padStart(8, "0");
	}
}
