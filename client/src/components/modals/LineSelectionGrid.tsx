import { TFL_LINE_IDS, TFL_LINES } from '@railsignal/shared';

export interface LineSelectionGridProps {
  selectedLines: string[];
  onChange: (lines: string[]) => void;
  title?: string;
  helperText?: string;
  onInteraction?: () => void;
}

export function LineSelectionGrid({
  selectedLines,
  onChange,
  title = 'Monitored London Lines',
  helperText,
  onInteraction,
}: LineSelectionGridProps) {
  const allSelected = selectedLines.length === TFL_LINES.length;

  const handleSelectAllToggle = () => {
    onInteraction?.();
    if (allSelected) {
      onChange([]);
    } else {
      onChange([...TFL_LINE_IDS]);
    }
  };

  const toggleLine = (lineId: string) => {
    onInteraction?.();
    onChange(
      selectedLines.includes(lineId)
        ? selectedLines.filter((id) => id !== lineId)
        : [...selectedLines, lineId],
    );
  };

  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="block text-sm font-medium text-slate-300">{title}</span>
          <span className="inline-flex items-center rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-medium text-slate-300">
            {selectedLines.length}/{TFL_LINES.length} lines selected
          </span>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-400 hover:text-blue-300 select-none min-h-[44px]">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleSelectAllToggle}
            aria-label="Select all lines"
            className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
          />
          <span>Select All</span>
        </label>
      </div>

      {helperText && <p className="text-xs text-slate-400 mb-2">{helperText}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 sm:max-h-52 overflow-y-auto overscroll-contain p-1 border border-slate-800 rounded-lg bg-slate-900/40">
        {TFL_LINES.map((line) => {
          const checked = selectedLines.includes(line.id);
          return (
            <label
              key={line.id}
              className="flex items-center gap-2.5 min-h-[44px] px-2.5 py-1.5 rounded hover:bg-slate-800/50 cursor-pointer text-xs font-medium text-slate-200 select-none"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleLine(line.id)}
                aria-label={line.name}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <span
                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  line.id === 'northern' ? 'border border-neutral-500' : ''
                }`}
                style={{ backgroundColor: line.color }}
                aria-hidden="true"
              />
              <span className="truncate">{line.name}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
