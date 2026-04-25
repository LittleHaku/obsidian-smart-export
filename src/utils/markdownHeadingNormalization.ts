const MAX_MARKDOWN_HEADING_LEVEL = 6;

function countRepeatedCharacter(content: string, startIndex: number, character: string): number {
	let currentIndex = startIndex;
	while (content[currentIndex] === character) {
		currentIndex += 1;
	}

	return currentIndex - startIndex;
}

function getLineBodyAndNewline(line: string): { body: string; newline: string } {
	if (line.endsWith("\r\n")) {
		return {
			body: line.slice(0, -2),
			newline: "\r\n",
		};
	}

	if (line.endsWith("\n")) {
		return {
			body: line.slice(0, -1),
			newline: "\n",
		};
	}

	return {
		body: line,
		newline: "",
	};
}

function skipUpToThreeLeadingSpaces(content: string): number {
	let currentIndex = 0;
	let indentation = 0;
	while (indentation < 3 && content[currentIndex] === " ") {
		currentIndex += 1;
		indentation += 1;
	}

	return currentIndex;
}

function getFenceInfo(lineBody: string): { character: string; length: number } | null {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	const fenceCharacter = lineBody[markerIndex];
	if (fenceCharacter !== "`" && fenceCharacter !== "~") {
		return null;
	}

	const fenceLength = countRepeatedCharacter(lineBody, markerIndex, fenceCharacter);
	if (fenceLength < 3) {
		return null;
	}

	return {
		character: fenceCharacter,
		length: fenceLength,
	};
}

function shouldCloseFence(lineBody: string, fenceCharacter: string, fenceLength: number): boolean {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	if (lineBody[markerIndex] !== fenceCharacter) {
		return false;
	}

	const markerLength = countRepeatedCharacter(lineBody, markerIndex, fenceCharacter);
	if (markerLength < fenceLength) {
		return false;
	}

	for (
		let currentIndex = markerIndex + markerLength;
		currentIndex < lineBody.length;
		currentIndex += 1
	) {
		const character = lineBody[currentIndex];
		if (character !== " " && character !== "\t") {
			return false;
		}
	}

	return true;
}

function normalizeHeadingLine(lineBody: string, parentHeadingLevel: number): string {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	const markerLength = countRepeatedCharacter(lineBody, markerIndex, "#");
	if (markerLength < 1 || markerLength > MAX_MARKDOWN_HEADING_LEVEL) {
		return lineBody;
	}

	const afterMarkerIndex = markerIndex + markerLength;
	if (lineBody[afterMarkerIndex] !== " " && lineBody[afterMarkerIndex] !== "\t") {
		return lineBody;
	}

	const normalizedHeadingLevel = Math.min(
		MAX_MARKDOWN_HEADING_LEVEL,
		parentHeadingLevel + markerLength
	);
	return `${lineBody.slice(0, markerIndex)}${"#".repeat(normalizedHeadingLevel)}${lineBody.slice(afterMarkerIndex)}`;
}

/**
 * Shifts included note content headings below the generated note title heading.
 * Frontmatter and fenced code blocks are preserved because their leading # text is not document structure.
 */
export function normalizeMarkdownHeadingsBelowParent(
	content: string,
	parentHeadingLevel: number
): string {
	if (content.length === 0) {
		return content;
	}

	const lines = content.match(/.*(?:\r?\n|$)/g) as string[];
	const normalizedLines: string[] = [];
	let isInFrontmatter = false;
	let isFirstLine = true;
	let currentFence: { character: string; length: number } | null = null;

	for (const line of lines) {
		if (line.length === 0) {
			continue;
		}

		const { body, newline } = getLineBodyAndNewline(line);

		if (isFirstLine && body === "---") {
			isInFrontmatter = true;
			isFirstLine = false;
			normalizedLines.push(line);
			continue;
		}
		isFirstLine = false;

		if (isInFrontmatter) {
			normalizedLines.push(line);
			if (body === "---") {
				isInFrontmatter = false;
			}
			continue;
		}

		if (currentFence) {
			normalizedLines.push(line);
			if (shouldCloseFence(body, currentFence.character, currentFence.length)) {
				currentFence = null;
			}
			continue;
		}

		const fenceInfo = getFenceInfo(body);
		if (fenceInfo) {
			currentFence = fenceInfo;
			normalizedLines.push(line);
			continue;
		}

		normalizedLines.push(`${normalizeHeadingLine(body, parentHeadingLevel)}${newline}`);
	}

	return normalizedLines.join("");
}
