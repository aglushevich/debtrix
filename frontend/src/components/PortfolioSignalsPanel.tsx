type Props = {
  signals: string[];
};

export default function PortfolioSignalsPanel({ signals }: Props) {

  if (!signals?.length)
    return (
      <div className="panel">
        <div className="panel-title">
          Частые портфельные сигналы
        </div>
        <div className="empty-box">
          Сигналы пока не накоплены
        </div>
      </div>
    );

  return (
    <div className="panel">

      <div className="panel-title">
        Частые портфельные сигналы
      </div>

      {signals.map((s,i)=>(
        <div key={i} className="signal-row">
          {s}
        </div>
      ))}

    </div>
  );
}