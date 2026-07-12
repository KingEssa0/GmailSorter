function SummaryCard({ title, value }) {
  return <div className="summaryCard"><h3>{title}:</h3><p>{value}</p></div>
}

<SummaryCard title="Unread Emails" value="18" />

<SummaryCard title="Needs Reply" value="5" />

<SummaryCard title="Bills" value="2" />
