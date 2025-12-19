"use client";

export default function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group w-full h-full block">
      {children}

      {text && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 
                     hidden group-hover:block
                     bg-black text-white text-xs px-3 py-1 rounded shadow-lg 
                     whitespace-pre-line max-w-[240px] z-50"
        >
          {text}
        </div>
      )}
    </div>
  );
}
