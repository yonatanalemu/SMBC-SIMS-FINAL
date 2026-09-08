import { useRef, useState } from "react";

export default function FileUpload({ accept, onFileSelect, label = "Upload a file", hint, value, multiple = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileNames, setFileNames] = useState(value ? [value] : []);

  function handleFiles(files) {
    if (!files || files.length === 0) return;
    if (multiple) {
      const list = Array.from(files);
      setFileNames(list.map((f) => f.name));
      onFileSelect(list);
    } else {
      const file = files[0];
      setFileNames([file.name]);
      onFileSelect(file);
    }
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={`cursor-pointer border-2 border-dashed rounded-xl px-4 py-6 text-center transition-colors
          ${dragOver ? "border-teal-500 bg-teal-100/50" : "border-navy-950/15 dark:border-slate-600 hover:border-teal-500/60"}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {fileNames.length > 0 ? (
          <p className="text-sm font-medium text-teal-600 truncate">
            {fileNames.length > 1 ? `${fileNames.length} files selected` : fileNames[0]}
          </p>
        ) : (
          <>
            <p className="text-sm text-ink dark:text-slate-200">{label}</p>
            <p className="text-xs text-ink-muted dark:text-slate-400 mt-1">
              Drag &amp; drop, or click to browse{multiple ? " (multiple files allowed)" : ""}
            </p>
          </>
        )}
      </div>
      {hint && <p className="text-xs text-ink-muted dark:text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
