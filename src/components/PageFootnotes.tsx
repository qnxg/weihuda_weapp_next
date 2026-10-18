export function PageFootnotes({
  items,
  label = "页面说明",
}: {
  items: readonly string[];
  label?: string;
}) {
  if (!items.length) return null;

  return (
    <aside className="page-footnotes" role="note" aria-label={label}>
      <ul>
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>
            <span className="page-footnotes__marker" aria-hidden="true">
              *
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
