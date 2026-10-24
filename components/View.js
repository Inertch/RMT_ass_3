// One shared view per page type, used unchanged by CSR, SSR and SSG so that markup is identical.
// Every repeated item carries data-testid="row" (used by the functional-equivalence check).
export default function View({ page, data }) {
  if (page === 'dashboard') {
    return (
      <section>
        <h2>My courses</h2>
        <div className="grid">
          {data.courses.map((c) => (
            <div key={c.id} className="card" data-testid="row">
              <b>{c.code}</b> {c.title}<br />{c.instructor} · progress {c.progress}%
            </div>
          ))}
        </div>
        <h2>Upcoming deadlines</h2>
        <ul>
          {data.deadlines.map((d) => (<li key={d.id} data-testid="row">{d.title} (due {d.due})</li>))}
        </ul>
      </section>
    );
  }
  if (page === 'gradebook') {
    return (
      <section>
        <h2>Gradebook</h2>
        <table>
          <thead><tr><th>Assignment</th><th>Weight</th><th>Score</th><th>Max</th><th>Date</th></tr></thead>
          <tbody>
            {data.rows.map((g) => (
              <tr key={g.id} data-testid="row">
                <td>{g.assignment}</td><td>{g.weight}</td><td>{g.score}</td><td>{g.max}</td><td>{g.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }
  if (page === 'quiz') {
    return (
      <section>
        <h2>Quiz</h2>
        {data.questions.map((q) => (
          <div key={q.id} className="card" data-testid="row">
            <p><b>{q.id}.</b> {q.text}</p>
            {q.options.map((o, i) => (<label key={i}><input type="radio" name={`q${q.id}`} /> {o}<br /></label>))}
          </div>
        ))}
      </section>
    );
  }
  return (
    <section>
      <h2>Discussion forum</h2>
      {data.posts.map((p) => (
        <div key={p.id} className="card" data-testid="row">
          <b>{p.author}</b> · {p.replies} replies<p>{p.text}</p>
        </div>
      ))}
    </section>
  );
}
