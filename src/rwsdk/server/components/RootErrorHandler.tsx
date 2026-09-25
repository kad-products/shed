export default function RootErrorHandler({ error }: { error: Error }): React.ReactNode {
	const causes: string[] = [];
	let cause: unknown = error.cause;
	while (cause instanceof Error) {
		causes.push(cause.message);
		cause = cause.cause;
	}
	if (cause !== undefined) {
		causes.push(String(cause));
	}

	return (
		<div style={{ padding: '2rem', backgroundColor: '#ffe6e6' }}>
			<h1>Something went terribly wrong</h1>
			<p>{error.message}</p>
			{causes.length > 0 && (
				<>
					<p>
						<strong>Caused by:</strong>
					</p>
					<ul>
						{causes.map((msg, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: stable list, no reordering
							<li key={i}>{msg}</li>
						))}
					</ul>
				</>
			)}
			<ul>
				{Object.entries(error).map(([key, value]) => (
					<li key={key}>
						<strong>{key}:</strong> {JSON.stringify(value)}
					</li>
				))}
			</ul>
		</div>
	);
}
