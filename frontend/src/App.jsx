import { useEffect, useState } from "react";

function App() {
  const [debts, setDebts] = useState([]);

  useEffect(() => {
    fetch("http://localhost:8000/debts")
      .then((res) => res.json())
      .then((data) => setDebts(data.items));
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Debtrix — Реестр задолженности</h1>

      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>Должник</th>
            <th>Сумма</th>
            <th>Дней просрочки</th>
            <th>Статус</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {debts.map((debt, index) => (
            <tr key={index}>
              <td>{debt.debtor}</td>
              <td>{debt.amount}</td>
              <td>{debt.days_overdue}</td>
              <td>{debt.status.title}</td>
              <td>
                {debt.actions.map((action, i) => (
                  <div key={i}>{action.title}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;