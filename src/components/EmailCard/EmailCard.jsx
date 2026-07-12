function EmailCard({ email, onClick }) {
    return (
        <div className="emailCard" onClick={() => onClick(email)}>
            <h3>Subject: {email.subject}</h3>

            <p>From: {email.from}</p>

            <p>AI Summary: {email.aiSummary}</p>
        </div>
    );
    if (emails.length === 0) {
    return <p>No emails to display.</p>;
}
}

export default EmailCard;
