type PlaceholderPageProps = {
  title: string;
  description: string;
};

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle">{description}</p>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>
          This section is scaffolded for navigation. Content will be built in upcoming phases.
        </p>
      </div>
    </div>
  );
}
