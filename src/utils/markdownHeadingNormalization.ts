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

function tryConsumeListMarker(content: string, startIndex: number): number {
	const unorderedMarker = content[startIndex];
	if (
		(unorderedMarker === "-" || unorderedMarker === "+" || unorderedMarker === "*") &&
		(content[startIndex + 1] === " " || content[startIndex + 1] === "\t")
	) {
		let currentIndex = startIndex + 2;
		while (content[currentIndex] === " " || content[currentIndex] === "\t") {
			currentIndex += 1;
		}

		return currentIndex;
	}

	let currentIndex = startIndex;
	while (content[currentIndex] >= "0" && content[currentIndex] <= "9") {
		currentIndex += 1;
	}

	if (
		currentIndex > startIndex &&
		(content[currentIndex] === "." || content[currentIndex] === ")") &&
		(content[currentIndex + 1] === " " || content[currentIndex + 1] === "\t")
	) {
		currentIndex += 2;
		while (content[currentIndex] === " " || content[currentIndex] === "\t") {
			currentIndex += 1;
		}

		return currentIndex;
	}

	return -1;
}

function findFenceMarkerIndex(lineBody: string): number {
	let currentIndex = skipUpToThreeLeadingSpaces(lineBody);

	while (true) {
		const listMarkerEnd = tryConsumeListMarker(lineBody, currentIndex);
		if (listMarkerEnd < 0) {
			break;
		}

		currentIndex = skipUpToThreeLeadingSpaces(lineBody.slice(listMarkerEnd)) + listMarkerEnd;
	}

	return currentIndex;
}

function getFenceInfo(lineBody: string): { character: string; length: number } | null {
	const markerIndex = findFenceMarkerIndex(lineBody);
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
	const markerIndex = findFenceMarkerIndex(lineBody);
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

function isAtxHeadingLine(lineBody: string): boolean {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	const markerLength = countRepeatedCharacter(lineBody, markerIndex, "#");
	if (markerLength < 1 || markerLength > MAX_MARKDOWN_HEADING_LEVEL) {
		return false;
	}

	const afterMarkerIndex = markerIndex + markerLength;
	return lineBody[afterMarkerIndex] === " " || lineBody[afterMarkerIndex] === "\t";
}

function getSetextHeadingLevel(lineBody: string): 1 | 2 | null {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	const markerCharacter = lineBody[markerIndex];
	if (markerCharacter !== "=" && markerCharacter !== "-") {
		return null;
	}

	const markerLength = countRepeatedCharacter(lineBody, markerIndex, markerCharacter);
	for (
		let currentIndex = markerIndex + markerLength;
		currentIndex < lineBody.length;
		currentIndex += 1
	) {
		const character = lineBody[currentIndex];
		if (character !== " " && character !== "\t") {
			return null;
		}
	}

	return markerCharacter === "=" ? 1 : 2;
}

function isSetextHeadingTextCandidate(lineBody: string): boolean {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	if (lineBody.slice(markerIndex).trim().length === 0) {
		return false;
	}

	return !isAtxHeadingLine(lineBody) && getFenceInfo(lineBody) === null;
}

function normalizeSetextHeadingLine(
	lineBody: string,
	setextHeadingLevel: 1 | 2,
	parentHeadingLevel: number
): string {
	const markerIndex = skipUpToThreeLeadingSpaces(lineBody);
	const normalizedHeadingLevel = Math.min(
		MAX_MARKDOWN_HEADING_LEVEL,
		parentHeadingLevel + setextHeadingLevel
	);
	return `${lineBody.slice(0, markerIndex)}${"#".repeat(normalizedHeadingLevel)} ${lineBody.slice(markerIndex).trim()}`;
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
	let setextCandidateIndex: number | null = null;

	for (const line of lines) {
		if (line.length === 0) {
			continue;
		}

		const { body, newline } = getLineBodyAndNewline(line);
		const setextHeadingLevel = getSetextHeadingLevel(body);
		if (setextHeadingLevel && setextCandidateIndex !== null) {
			const candidateLine = normalizedLines[setextCandidateIndex];
			const { body: candidateBody, newline: candidateNewline } =
				getLineBodyAndNewline(candidateLine);
			normalizedLines[setextCandidateIndex] = `${normalizeSetextHeadingLine(
				candidateBody,
				setextHeadingLevel,
				parentHeadingLevel
			)}${candidateNewline}`;
			setextCandidateIndex = null;
			continue;
		}

		if (isFirstLine && body === "---") {
			isInFrontmatter = true;
			isFirstLine = false;
			normalizedLines.push(line);
			setextCandidateIndex = null;
			continue;
		}
		isFirstLine = false;

		if (isInFrontmatter) {
			normalizedLines.push(line);
			setextCandidateIndex = null;
			if (body === "---") {
				isInFrontmatter = false;
			}
			continue;
		}

		if (currentFence) {
			normalizedLines.push(line);
			setextCandidateIndex = null;
			if (shouldCloseFence(body, currentFence.character, currentFence.length)) {
				currentFence = null;
			}
			continue;
		}

		const fenceInfo = getFenceInfo(body);
		if (fenceInfo) {
			currentFence = fenceInfo;
			normalizedLines.push(line);
			setextCandidateIndex = null;
			continue;
		}

		const normalizedLine = `${normalizeHeadingLine(body, parentHeadingLevel)}${newline}`;
		normalizedLines.push(normalizedLine);
		setextCandidateIndex = isSetextHeadingTextCandidate(body) ? normalizedLines.length - 1 : null;
	}

	return normalizedLines.join("");
}
