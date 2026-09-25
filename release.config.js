import { execSync } from 'node:child_process';

export default isDryRun() ? getDryRunConfig() : getCIConfig();

function isDryRun() {
	return process.argv.includes('--dry-run');
}

function getDryRunConfig() {
	return {
		repositoryUrl: getLocalRepoUrl(),
		branches: [getCurrentBranch()],
		plugins: [
			[
				'@semantic-release/commit-analyzer',
				{
					preset: 'conventionalcommits',
					releaseRules: [{ type: 'refactor', release: 'patch' }],
				},
			],
			[
				'@semantic-release/release-notes-generator',
				{
					preset: 'conventionalcommits',
					presetConfig: {
						types: [
							{ type: 'feat', section: 'Features' },
							{ type: 'fix', section: 'Bug Fixes' },
							{ type: 'perf', section: 'Performance Improvements' },
							{ type: 'revert', section: 'Reverts' },
							{ type: 'refactor', section: 'Code Refactoring' },
						],
					},
				},
			],
		],
	};
}

function getCIConfig() {
	return {
		repositoryUrl: 'https://github.com/kad-products/shed',
		branches: ['main'],
		plugins: [
			[
				'@semantic-release/commit-analyzer',
				{
					preset: 'conventionalcommits',
					releaseRules: [{ type: 'refactor', release: 'patch' }],
				},
			],
			[
				'@semantic-release/release-notes-generator',
				{
					preset: 'conventionalcommits',
					presetConfig: {
						types: [
							{ type: 'feat', section: 'Features' },
							{ type: 'fix', section: 'Bug Fixes' },
							{ type: 'perf', section: 'Performance Improvements' },
							{ type: 'revert', section: 'Reverts' },
							{ type: 'refactor', section: 'Code Refactoring' },
						],
					},
				},
			],
			'@semantic-release/changelog',
			['@semantic-release/npm', { npmPublish: false }],
			[
				'@semantic-release/git',
				{
					assets: ['package.json', 'pnpm-lock.yaml', 'CHANGELOG.md'],
					// biome-ignore lint/suspicious/noTemplateCurlyInString: this is how semantic-release expects the message to be formatted
					message: 'chore(release): ${nextRelease.version}\n\n${nextRelease.notes}',
				},
			],
			'@semantic-release/github',
		],
	};
}

function getLocalRepoUrl() {
	const topLevelDir = execSync('git rev-parse --show-toplevel').toString().trim();
	return `file://${topLevelDir}/.git`;
}

function getCurrentBranch() {
	return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
}
