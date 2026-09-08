export function DigitSlots({
	length,
	value,
	disabled,
	onChange,
	onSubmit,
}: {
	length: number;
	value: string;
	disabled: boolean;
	onChange: (digits: string) => void;
	onSubmit: () => void;
}) {
	return (
		<div>
			<div className="mb-2 flex gap-1 font-mono" aria-hidden="true">
				{["a", "b", "c", "d", "e"].slice(0, length).map((id, index) => (
					<span
						key={id}
						className="flex h-10 w-8 items-center justify-center border border-zinc-400 text-lg dark:border-zinc-600"
					>
						{value[index] ?? ""}
					</span>
				))}
			</div>
			<input
				aria-label="Port digits"
				inputMode="numeric"
				autoComplete="off"
				maxLength={length}
				value={value}
				disabled={disabled}
				className="font-mono"
				onChange={(event) => {
					onChange(event.target.value.replace(/\D/g, "").slice(0, length));
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						onSubmit();
					}
				}}
			/>
		</div>
	);
}
