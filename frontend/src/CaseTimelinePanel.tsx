type Props = {
  timeline: any;
};

export default function CaseTimelinePanel({ timeline }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">Хронология дела</div>

      <div className="timeline-list">
        {timeline?.items?.length ? (
          timeline.items.map((item: any) => (
            <div className="timeline-item" key={item.id}>
              <div className="timeline-item-top">
                <strong>{item.title}</strong>
                <span className="muted small">{item.created_at}</span>
              </div>
              <div>{item.details}</div>
            </div>
          ))
        ) : (
          <div className="empty-box">История дела пока пуста.</div>
        )}
      </div>
    </section>
  );
}